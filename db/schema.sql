-- ORI database schema (PostgreSQL 15+). Safe to re-run.

create table if not exists products (
  id          text primary key check (id ~ '^ORI-[A-Z0-9]+(-[A-Z0-9]+)+$'),
  brand       text not null,
  name        text not null,
  category    text not null,
  price       integer not null check (price > 0),
  sizes       text[] not null check (cardinality(sizes) > 0),
  stock       integer not null default 0 check (stock >= 0),
  condition   text not null check (condition in ('BNIB', 'Pre-Owned')),
  color       text,
  description text,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  number         text not null unique,
  customer_name  text not null check (char_length(customer_name) between 2 and 80),
  email          text not null check (email = lower(email) and char_length(email) <= 120),
  phone          text check (char_length(phone) <= 20),
  address        text not null check (char_length(address) between 5 and 300),
  city           text not null check (char_length(city) between 2 and 60),
  postal_code    text not null check (postal_code ~ '^[0-9]{5}$'),
  payment_method text not null check (payment_method in ('card', 'ewallet', 'transfer')),
  subtotal       integer not null check (subtotal >= 0),
  shipping_fee   integer not null default 0 check (shipping_fee >= 0),
  total          integer not null check (total >= 0),
  status         text not null default 'pending' check (status in ('pending', 'paid', 'shipped', 'cancelled')),
  created_at     timestamptz not null default now()
);
create index if not exists orders_created_at_idx on orders (created_at desc);

create table if not exists order_items (
  order_id   uuid not null references orders (id) on delete cascade,
  product_id text not null references products (id),
  size       text not null,
  qty        integer not null check (qty between 1 and 10),
  unit_price integer not null check (unit_price > 0),
  primary key (order_id, product_id, size)
);

create table if not exists newsletter_subscribers (
  email      text primary key check (email = lower(email) and char_length(email) <= 120),
  created_at timestamptz not null default now()
);

create table if not exists verification_events (
  id         bigint generated always as identity primary key,
  code       text not null check (char_length(code) <= 40),
  product_id text references products (id),
  created_at timestamptz not null default now()
);
create index if not exists verification_events_product_idx on verification_events (product_id, created_at);

-- No direct table access except through the functions below
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table newsletter_subscribers enable row level security;
alter table verification_events enable row level security;

-- Live price and stock for the storefront
create or replace function api_inventory()
returns table (id text, price integer, stock integer, active boolean)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.id, p.price, p.stock, p.active from products p order by p.id
$$;

-- Atomic checkout; prices always come from the database
create or replace function api_place_order(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  c          jsonb := p -> 'customer';
  v_items    jsonb := p -> 'items';
  v_req      record;
  v_stock    integer;
  v_short    jsonb := '[]';
  v_subtotal integer;
  v_order    uuid;
  v_number   text;
  v_created  timestamptz;
  v_try      integer := 0;
begin
  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) not between 1 and 20 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_items) l
    where case
      when jsonb_typeof(l -> 'id') = 'string' and jsonb_typeof(l -> 'size') = 'string' and jsonb_typeof(l -> 'qty') = 'number'
        then (l ->> 'qty')::numeric not between 1 and 10 or (l ->> 'qty')::numeric <> trunc((l ->> 'qty')::numeric)
      else true
    end
  ) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  -- Lock each product once, in id order
  for v_req in
    select l ->> 'id' as id, sum((l ->> 'qty')::integer)::integer as qty
    from jsonb_array_elements(v_items) l
    group by 1
    order by 1
  loop
    select pr.stock into v_stock from products pr where pr.id = v_req.id and pr.active for update;
    if not found then
      raise exception 'unknown_product' using errcode = '22023', detail = v_req.id;
    end if;
    if v_stock < v_req.qty then
      v_short := v_short || jsonb_build_object('id', v_req.id, 'stock', v_stock);
    end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(v_items) l
    join products pr on pr.id = l ->> 'id'
    where not (l ->> 'size' = any (pr.sizes))
  ) then
    raise exception 'invalid_size' using errcode = '22023';
  end if;

  if jsonb_array_length(v_short) > 0 then
    return jsonb_build_object('error', 'out_of_stock', 'items', v_short);
  end if;

  select sum(pr.price * x.qty)::integer into v_subtotal
  from (select l ->> 'id' as id, sum((l ->> 'qty')::integer) as qty from jsonb_array_elements(v_items) l group by 1) x
  join products pr on pr.id = x.id;

  -- Order number like ORI-261008-3FA9C (WIB date)
  loop
    v_try := v_try + 1;
    v_number := 'ORI-' || to_char(timezone('UTC', now()) + interval '7 hours', 'YYMMDD') || '-'
      || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    begin
      insert into orders (number, customer_name, email, phone, address, city, postal_code, payment_method, subtotal, shipping_fee, total)
      values (
        v_number, trim(c ->> 'name'), lower(trim(c ->> 'email')), nullif(trim(c ->> 'phone'), ''),
        trim(c ->> 'address'), trim(c ->> 'city'), trim(c ->> 'postal'), p ->> 'payment', v_subtotal, 0, v_subtotal
      )
      returning id, created_at into v_order, v_created;
      exit;
    exception when unique_violation then
      if v_try >= 5 then raise; end if;
    end;
  end loop;

  insert into order_items (order_id, product_id, size, qty, unit_price)
  select v_order, x.id, x.size, x.qty, pr.price
  from (
    select l ->> 'id' as id, l ->> 'size' as size, sum((l ->> 'qty')::integer)::integer as qty
    from jsonb_array_elements(v_items) l group by 1, 2
  ) x
  join products pr on pr.id = x.id;

  update products pr set stock = pr.stock - x.qty, updated_at = now()
  from (select l ->> 'id' as id, sum((l ->> 'qty')::integer)::integer as qty from jsonb_array_elements(v_items) l group by 1) x
  where pr.id = x.id;

  return jsonb_build_object(
    'number', v_number,
    'subtotal', v_subtotal,
    'shipping', 0,
    'total', v_subtotal,
    'created_at', v_created,
    'items', (
      select jsonb_agg(jsonb_build_object('id', oi.product_id, 'size', oi.size, 'qty', oi.qty, 'price', oi.unit_price) order by oi.product_id, oi.size)
      from order_items oi where oi.order_id = v_order
    ),
    'stock', (
      select jsonb_agg(jsonb_build_object('id', pr.id, 'stock', pr.stock) order by pr.id)
      from products pr where pr.id in (select l ->> 'id' from jsonb_array_elements(v_items) l)
    )
  );
end
$$;

-- Log a verification and return its history
create or replace function api_verify(p_code text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_code   text := upper(trim(p_code));
  v_id     text;
  v_checks bigint;
  v_first  timestamptz;
begin
  if v_code is null or char_length(v_code) not between 1 and 40 then
    raise exception 'invalid_code' using errcode = '22023';
  end if;
  select pr.id into v_id from products pr where pr.id = v_code;
  insert into verification_events (code, product_id) values (v_code, v_id);
  if v_id is null then
    return jsonb_build_object('found', false, 'code', v_code);
  end if;
  select count(*), min(e.created_at) into v_checks, v_first from verification_events e where e.product_id = v_id;
  return jsonb_build_object('found', true, 'id', v_id, 'checks', v_checks, 'first_checked_at', v_first);
end
$$;

-- Newsletter sign-up, idempotent per email
create or replace function api_subscribe(p_email text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
  v_rows  integer;
begin
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' or char_length(v_email) > 120 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  insert into newsletter_subscribers (email) values (v_email) on conflict (email) do nothing;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('subscribed', true, 'new', v_rows = 1);
end
$$;

-- Least-privilege role for the API (login is optional, see docs)
do $$
begin
  if not exists (select from pg_roles where rolname = 'ori_api') then
    create role ori_api nologin;
  end if;
end
$$;
grant usage on schema public to ori_api;
revoke all on function api_inventory(), api_place_order(jsonb), api_verify(text), api_subscribe(text) from public;
grant execute on function api_inventory(), api_place_order(jsonb), api_verify(text), api_subscribe(text) to ori_api;

-- Supabase-style public roles get nothing
do $$
begin
  if exists (select from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'revoke execute on function api_inventory(), api_place_order(jsonb), api_verify(text), api_subscribe(text) from anon, authenticated';
  end if;
end
$$;

-- ------------------------- Accounts, sessions, support reports, admin -------------------------
-- Passwords are scrypt-hashed in the API; sessions store only SHA-256(token). Customer and admin functions
-- take that hash and resolve the account here, and admin functions check the role here too, so the API
-- role can never act as someone else or as an admin on its own.

create table if not exists accounts (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique check (email = lower(email) and char_length(email) <= 120),
  name          text not null check (char_length(name) between 2 and 80),
  password_hash text not null check (char_length(password_hash) <= 200),
  role          text not null default 'customer' check (role in ('customer', 'admin')),
  created_at    timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  account_id uuid not null references accounts (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_account_idx on sessions (account_id);

create table if not exists login_attempts (
  email      text not null,
  ok         boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_email_idx on login_attempts (email, created_at);

alter table orders add column if not exists account_id uuid references accounts (id) on delete set null;
create index if not exists orders_account_idx on orders (account_id, created_at desc);

create table if not exists reports (
  id           bigint generated always as identity primary key,
  account_id   uuid references accounts (id) on delete set null,
  email        text not null check (char_length(email) <= 120),
  type         text not null check (type in ('order', 'verification', 'product', 'other')),
  subject      text not null check (char_length(subject) between 3 and 120),
  message      text not null check (char_length(message) between 10 and 2000),
  order_number text check (char_length(order_number) <= 40),
  product_code text check (char_length(product_code) <= 40),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_note   text check (char_length(admin_note) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists reports_status_idx on reports (status, created_at desc);

-- Fulfilment: courier + waybill, a timestamp per step, and an event log shown to the admin and (minus internal
-- notes) to the customer. A courier API integration would append 'update' events here.
alter table orders add column if not exists courier text check (char_length(courier) <= 40);
alter table orders add column if not exists waybill text check (char_length(waybill) <= 40);
alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists shipped_at timestamptz;
alter table orders add column if not exists delivered_at timestamptz;
alter table orders add column if not exists cancelled_at timestamptz;
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (status in ('pending', 'paid', 'shipped', 'delivered', 'cancelled'));

create table if not exists order_events (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references orders (id) on delete cascade,
  kind       text not null check (kind in ('paid', 'shipped', 'update', 'delivered', 'cancelled', 'note')),
  text       text not null check (char_length(text) between 1 and 200),
  place      text check (char_length(place) <= 80),
  internal   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on order_events (order_id, created_at);
alter table order_events enable row level security;

-- Products created/edited in the admin: storefront media (photos, 3D spec, hotspots, swatch) lives in media;
-- uploaded photos are stored here and served by /api/media
alter table products add column if not exists media jsonb not null default '{}'::jsonb;
create table if not exists product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id text not null references products (id) on delete cascade,
  mime       text not null check (mime in ('image/webp', 'image/jpeg', 'image/png')),
  data       bytea not null check (octet_length(data) between 1 and 3000000),
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on product_images (product_id);
alter table product_images enable row level security;

-- User management
alter table accounts add column if not exists disabled boolean not null default false;
alter table accounts add column if not exists last_login_at timestamptz;

-- Outgoing email (support replies). Sent by api/_lib/mail.js once SMTP_* is configured; queued until then.
create table if not exists email_outbox (
  id         bigint generated always as identity primary key,
  to_email   text not null check (char_length(to_email) <= 120),
  subject    text not null check (char_length(subject) <= 200),
  body       text not null check (char_length(body) <= 5000),
  status     text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  attempts   integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index if not exists email_outbox_status_idx on email_outbox (status, id);
alter table email_outbox enable row level security;

-- Support chat: each report is a conversation thread
alter table reports add column if not exists admin_seen_at timestamptz;
alter table reports add column if not exists customer_seen_at timestamptz;
alter table reports add column if not exists last_message_at timestamptz;
create table if not exists report_messages (
  id          bigint generated always as identity primary key,
  report_id   bigint not null references reports (id) on delete cascade,
  author      text not null check (author in ('customer', 'admin')),
  author_name text check (char_length(author_name) <= 80),
  body        text not null check (char_length(body) between 1 and 2000),
  email_id    bigint references email_outbox (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists report_messages_report_idx on report_messages (report_id, id);
alter table report_messages enable row level security;
-- The old single reply field becomes the first admin message (idempotent)
insert into report_messages (report_id, author, author_name, body, created_at)
select r.id, 'admin', 'ORI support', r.admin_note, r.updated_at from reports r
where r.admin_note is not null and not exists (select 1 from report_messages m where m.report_id = r.id);
update reports set last_message_at = coalesce(last_message_at, updated_at), admin_note = null where admin_note is not null;

alter table accounts enable row level security;
alter table sessions enable row level security;
alter table login_attempts enable row level security;
alter table reports enable row level security;

-- Private helpers (not granted to the API role)
create or replace function ori_session_account(p_token text)
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select s.account_id from sessions s join accounts a on a.id = s.account_id
  where s.token_hash = p_token and s.expires_at > now() and not a.disabled
$$;

create or replace function ori_require_account(p_token text)
returns uuid
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v uuid := ori_session_account(p_token);
begin
  if v is null then raise exception 'unauthorized' using errcode = '28000'; end if;
  return v;
end
$$;

create or replace function ori_require_admin(p_token text)
returns uuid
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v uuid := ori_require_account(p_token);
begin
  if not exists (select 1 from accounts a where a.id = v and a.role = 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v;
end
$$;

-- Auth
create or replace function api_auth_register(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v accounts;
begin
  insert into accounts (email, name, password_hash)
  values (lower(trim(p ->> 'email')), trim(p ->> 'name'), p ->> 'hash')
  returning * into v;
  return jsonb_build_object('id', v.id, 'email', v.email, 'name', v.name, 'role', v.role);
exception when unique_violation then
  return jsonb_build_object('error', 'email_taken');
end
$$;

-- Account (with hash, verified in the API) and recent failed attempts for rate limiting
create or replace function api_auth_lookup(p_email text)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'account', (select jsonb_build_object('id', a.id, 'email', a.email, 'name', a.name, 'role', a.role, 'hash', a.password_hash, 'disabled', a.disabled)
                from accounts a where a.email = lower(trim(p_email))),
    'failures', (select count(*) from login_attempts l
                 where l.email = lower(trim(p_email)) and not l.ok and l.created_at > now() - interval '15 minutes')
  )
$$;

create or replace function api_auth_attempt(p_email text, p_ok boolean)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  delete from login_attempts where created_at < now() - interval '1 day';
  insert into login_attempts (email, ok) values (left(lower(trim(p_email)), 120), p_ok);
$$;

create or replace function api_session_create(p_account uuid, p_token text, p_days integer)
returns timestamptz
language sql security definer
set search_path = public, pg_temp
as $$
  update accounts set last_login_at = now() where id = p_account;
  delete from sessions where account_id = p_account and expires_at < now();
  insert into sessions (token_hash, account_id, expires_at)
  values (p_token, p_account, now() + make_interval(days => least(greatest(p_days, 1), 90)))
  returning expires_at;
$$;

create or replace function api_session_get(p_token text)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('id', a.id, 'email', a.email, 'name', a.name, 'role', a.role, 'created_at', a.created_at)
  from accounts a where a.id = ori_session_account(p_token)
$$;

create or replace function api_session_delete(p_token text)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  delete from sessions where token_hash = p_token
$$;

-- Customer: own orders and reports only
create or replace function api_account_orders(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v uuid := ori_require_account(p_token);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'number', o.number, 'status', o.status, 'total', o.total, 'created_at', o.created_at, 'city', o.city,
      'payment', o.payment_method, 'courier', o.courier, 'waybill', o.waybill,
      'paid_at', o.paid_at, 'shipped_at', o.shipped_at, 'delivered_at', o.delivered_at, 'cancelled_at', o.cancelled_at,
      'events', coalesce((select jsonb_agg(jsonb_build_object('at', e.created_at, 'kind', e.kind, 'text', e.text, 'place', e.place) order by e.created_at)
                          from order_events e where e.order_id = o.id and not e.internal), '[]'),
      'items', (select jsonb_agg(jsonb_build_object('id', i.product_id, 'size', i.size, 'qty', i.qty, 'price', i.unit_price) order by i.product_id)
                from order_items i where i.order_id = o.id)
    ) order by o.created_at desc)
    from orders o where o.account_id = v), '[]');
end
$$;

create or replace function api_account_reports(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v uuid := ori_require_account(p_token);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'type', r.type, 'subject', r.subject, 'message', r.message, 'order_number', r.order_number,
      'product_code', r.product_code, 'status', r.status, 'created_at', r.created_at, 'updated_at', r.updated_at,
      'last_at', coalesce(r.last_message_at, r.created_at),
      'last', (select jsonb_build_object('author', m.author, 'body', m.body) from report_messages m where m.report_id = r.id order by m.id desc limit 1),
      'unread', (select count(*) from report_messages m where m.report_id = r.id and m.author = 'admin'
                 and m.created_at > coalesce(r.customer_seen_at, '-infinity'))
    ) order by coalesce(r.last_message_at, r.created_at) desc)
    from reports r where r.account_id = v), '[]');
end
$$;

create or replace function api_report_create(p_token text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v       uuid := ori_require_account(p_token);
  v_order text := nullif(upper(trim(p ->> 'order_number')), '');
  v_id    bigint;
begin
  if v_order is not null and not exists (select 1 from orders o where o.number = v_order and o.account_id = v) then
    raise exception 'unknown_order' using errcode = '22023';
  end if;
  insert into reports (account_id, email, type, subject, message, order_number, product_code)
  select v, a.email, p ->> 'type', trim(p ->> 'subject'), trim(p ->> 'message'), v_order, nullif(upper(trim(p ->> 'product_code')), '')
  from accounts a where a.id = v
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'open');
end
$$;

-- Checkout links a just-placed order to the signed-in account (resolved from the session, never from the request)
create or replace function api_order_link(p_number text, p_token text)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update orders set account_id = ori_session_account(p_token)
  where number = p_number and account_id is null and created_at > now() - interval '5 minutes'
$$;

-- Admin
create or replace function api_admin_overview(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  perform ori_require_admin(p_token);
  return jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'revenue_30d', coalesce(sum(o.total) filter (where o.created_at >= now() - interval '30 days'), 0),
        'revenue_prev_30d', coalesce(sum(o.total) filter (where o.created_at < now() - interval '30 days'), 0),
        'orders_30d', count(*) filter (where o.created_at >= now() - interval '30 days'),
        'orders_prev_30d', count(*) filter (where o.created_at < now() - interval '30 days'),
        'aov_30d', coalesce(round(avg(o.total) filter (where o.created_at >= now() - interval '30 days')), 0),
        'pending', (select count(*) from orders where status = 'pending'),
        'to_ship', (select count(*) from orders where status = 'paid'),
        'low_stock', (select count(*) from products where active and stock <= 3),
        'open_reports', (select count(*) from reports where status in ('open', 'in_progress')),
        'customers', (select count(*) from accounts where role = 'customer'),
        'subscribers', (select count(*) from newsletter_subscribers),
        'checks_30d', (select count(*) from verification_events where created_at >= now() - interval '30 days'),
        'unknown_checks_30d', (select count(*) from verification_events where product_id is null and created_at >= now() - interval '30 days')
      )
      from orders o where o.status <> 'cancelled' and o.created_at >= now() - interval '60 days'
    ),
    'daily', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'revenue', coalesce(x.revenue, 0), 'orders', coalesce(x.n, 0)) order by d.day)
      from (select (v_today - g)::date as day from generate_series(0, 29) g) d
      left join (
        select (o.created_at at time zone 'Asia/Jakarta')::date as day, sum(o.total) as revenue, count(*) as n
        from orders o where o.status <> 'cancelled' and o.created_at >= now() - interval '31 days' group by 1
      ) x on x.day = d.day
    ),
    'top_products', coalesce((
      select jsonb_agg(t) from (
        select i.product_id as id, p.name, sum(i.qty)::int as qty, sum(i.qty * i.unit_price)::bigint as revenue
        from order_items i join orders o on o.id = i.order_id join products p on p.id = i.product_id
        where o.status <> 'cancelled' and o.created_at >= now() - interval '30 days'
        group by 1, 2 order by revenue desc limit 5
      ) t), '[]'),
    'recent_orders', coalesce((
      select jsonb_agg(t) from (
        select o.number, o.customer_name, o.total, o.status, o.created_at from orders o order by o.created_at desc limit 6
      ) t), '[]'),
    'low_stock_items', coalesce((
      select jsonb_agg(t) from (select p.id, p.name, p.stock from products p where p.active and p.stock <= 3 order by p.stock, p.id) t), '[]')
  );
end
$$;

create or replace function api_admin_orders(p_token text, p_status text, p_q text, p_limit integer, p_offset integer)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_q text := '%' || replace(replace(coalesce(trim(p_q), ''), '%', '\%'), '_', '\_') || '%';
begin
  perform ori_require_admin(p_token);
  return jsonb_build_object(
    'counts', coalesce((select jsonb_object_agg(s.status, s.n) from (select status, count(*) as n from orders group by 1) s), '{}'),
    'total', (select count(*) from orders o
              where (coalesce(p_status, '') = '' or o.status = p_status)
                and (o.number ilike v_q or o.customer_name ilike v_q or o.email ilike v_q or o.city ilike v_q)),
    'items', coalesce((
      select jsonb_agg(t) from (
        select o.number, o.customer_name, o.email, o.city, o.payment_method, o.total, o.status, o.created_at, o.courier, o.waybill,
               (select sum(i.qty) from order_items i where i.order_id = o.id)::int as item_count,
               (select jsonb_agg(distinct i.product_id) from order_items i where i.order_id = o.id) as product_ids
        from orders o
        where (coalesce(p_status, '') = '' or o.status = p_status)
          and (o.number ilike v_q or o.customer_name ilike v_q or o.email ilike v_q or o.city ilike v_q)
        order by o.created_at desc
        limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0)
      ) t), '[]')
  );
end
$$;

create or replace function api_admin_order(p_token text, p_number text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v jsonb;
begin
  perform ori_require_admin(p_token);
  select jsonb_build_object(
    'number', o.number, 'status', o.status, 'created_at', o.created_at, 'customer_name', o.customer_name, 'email', o.email,
    'phone', o.phone, 'address', o.address, 'city', o.city, 'postal_code', o.postal_code, 'payment_method', o.payment_method,
    'subtotal', o.subtotal, 'shipping_fee', o.shipping_fee, 'total', o.total,
    'account', (select a.email from accounts a where a.id = o.account_id),
    'courier', o.courier, 'waybill', o.waybill,
    'paid_at', o.paid_at, 'shipped_at', o.shipped_at, 'delivered_at', o.delivered_at, 'cancelled_at', o.cancelled_at,
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'at', e.created_at, 'kind', e.kind, 'text', e.text, 'place', e.place, 'internal', e.internal) order by e.created_at)
                        from order_events e where e.order_id = o.id), '[]'),
    'items', (select jsonb_agg(jsonb_build_object('id', i.product_id, 'name', p.name, 'size', i.size, 'qty', i.qty, 'price', i.unit_price) order by i.product_id)
              from order_items i join products p on p.id = i.product_id where i.order_id = o.id),
    'reports', (select count(*) from reports r where r.order_number = o.number)
  ) into v
  from orders o where o.number = upper(trim(p_number));
  if v is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  return v;
end
$$;

-- pending -> paid | cancelled, paid -> shipped (courier + waybill) | cancelled, shipped -> delivered.
-- Every step is timestamped and logged; cancelling puts the stock back.
drop function if exists api_admin_order_status(text, text, text);
create or replace function api_admin_order_update(p_token text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  o         orders;
  v_status  text := p ->> 'status';
  v_courier text := nullif(trim(p ->> 'courier'), '');
  v_waybill text := nullif(upper(trim(p ->> 'waybill')), '');
  v_note    text := nullif(trim(p ->> 'note'), '');
begin
  perform ori_require_admin(p_token);
  select * into o from orders where number = upper(trim(p ->> 'number')) for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (v_status = any (case o.status
      when 'pending' then array['paid', 'cancelled']
      when 'paid' then array['shipped', 'cancelled']
      when 'shipped' then array['delivered']
      else array[]::text[] end)) then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  if v_status = 'shipped' and (v_courier is null or v_waybill is null) then
    raise exception 'courier_required' using errcode = '22023';
  end if;
  if v_status = 'cancelled' then
    update products pr set stock = pr.stock + x.qty, updated_at = now()
    from (select product_id, sum(qty) as qty from order_items where order_id = o.id group by 1) x
    where pr.id = x.product_id;
  end if;
  update orders set
    status = v_status,
    paid_at = case when v_status = 'paid' then now() else paid_at end,
    shipped_at = case when v_status = 'shipped' then now() else shipped_at end,
    delivered_at = case when v_status = 'delivered' then now() else delivered_at end,
    cancelled_at = case when v_status = 'cancelled' then now() else cancelled_at end,
    courier = case when v_status = 'shipped' then v_courier else courier end,
    waybill = case when v_status = 'shipped' then v_waybill else waybill end
  where id = o.id;
  insert into order_events (order_id, kind, text, place)
  values (
    o.id, v_status,
    coalesce(v_note, case v_status
      when 'paid' then 'Payment confirmed'
      when 'shipped' then 'Handed to ' || v_courier || ', waybill ' || v_waybill
      when 'delivered' then 'Delivered, received by customer'
      else 'Order cancelled' end),
    case v_status when 'shipped' then 'ORI warehouse, Jakarta' when 'delivered' then o.city end
  );
  return jsonb_build_object('number', o.number, 'status', v_status);
end
$$;

-- Tracking update (shipped orders, visible to the customer) or internal note (any order, admin only)
create or replace function api_admin_order_event(p_token text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  o          orders;
  v_internal boolean := coalesce((p ->> 'internal')::boolean, false);
  v_id       bigint;
begin
  perform ori_require_admin(p_token);
  select * into o from orders where number = upper(trim(p ->> 'number'));
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not v_internal and o.status <> 'shipped' then
    raise exception 'not_in_transit' using errcode = '22023';
  end if;
  insert into order_events (order_id, kind, text, place, internal)
  values (o.id, case when v_internal then 'note' else 'update' end, trim(p ->> 'text'), nullif(trim(p ->> 'place'), ''), v_internal)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end
$$;

create or replace function api_admin_products(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform ori_require_admin(p_token);
  return coalesce((
    select jsonb_agg(t order by t.brand, t.name) from (
      select p.id, p.brand, p.name, p.category, p.condition, p.color, p.description, to_jsonb(p.sizes) as sizes,
             p.price, p.stock, p.active, p.media, p.updated_at,
             exists (select 1 from order_items i where i.product_id = p.id) as has_orders,
             coalesce((select sum(i.qty) from order_items i join orders o on o.id = i.order_id
                       where i.product_id = p.id and o.status <> 'cancelled' and o.created_at >= now() - interval '30 days'), 0)::int as sold_30d
      from products p
    ) t), '[]');
end
$$;

create or replace function api_admin_product_update(p_token text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v products;
begin
  perform ori_require_admin(p_token);
  update products pr set
    brand = case when p ? 'brand' then trim(p ->> 'brand') else pr.brand end,
    name = case when p ? 'name' then trim(p ->> 'name') else pr.name end,
    category = case when p ? 'category' then trim(p ->> 'category') else pr.category end,
    condition = case when p ? 'condition' then p ->> 'condition' else pr.condition end,
    color = case when p ? 'color' then nullif(trim(p ->> 'color'), '') else pr.color end,
    description = case when p ? 'description' then nullif(trim(p ->> 'description'), '') else pr.description end,
    sizes = case when p ? 'sizes' then array(select jsonb_array_elements_text(p -> 'sizes')) else pr.sizes end,
    media = case when p ? 'media' then p -> 'media' else pr.media end,
    price = coalesce((p ->> 'price')::integer, pr.price),
    stock = coalesce((p ->> 'stock')::integer, pr.stock),
    active = coalesce((p ->> 'active')::boolean, pr.active),
    updated_at = now()
  where pr.id = p ->> 'id'
  returning * into v;
  if v.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', v.id, 'brand', v.brand, 'name', v.name, 'category', v.category, 'condition', v.condition,
    'color', v.color, 'description', v.description, 'sizes', to_jsonb(v.sizes), 'media', v.media,
    'price', v.price, 'stock', v.stock, 'active', v.active, 'updated_at', v.updated_at);
end
$$;

create or replace function api_admin_reports(p_token text, p_status text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform ori_require_admin(p_token);
  return jsonb_build_object(
    'counts', coalesce((select jsonb_object_agg(s.status, s.n) from (select status, count(*) as n from reports group by 1) s), '{}'),
    'items', coalesce((
      select jsonb_agg(t) from (
        select r.id, r.type, r.subject, r.message, r.email, r.order_number, r.product_code, r.status, r.created_at, r.updated_at,
               coalesce(r.last_message_at, r.created_at) as last_at,
               (select a.name from accounts a where a.id = r.account_id) as name,
               (select jsonb_build_object('author', m.author, 'body', m.body) from report_messages m where m.report_id = r.id order by m.id desc limit 1) as last,
               (case when r.admin_seen_at is null then 1 else 0 end) + (select count(*) from report_messages m
                 where m.report_id = r.id and m.author = 'customer' and m.created_at > coalesce(r.admin_seen_at, '-infinity'))::int as unread
        from reports r where coalesce(p_status, '') = '' or r.status = p_status
        order by (r.status in ('open', 'in_progress')) desc, coalesce(r.last_message_at, r.created_at) desc
        limit 200
      ) t), '[]')
  );
end
$$;

create or replace function api_admin_report_update(p_token text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v jsonb;
begin
  perform ori_require_admin(p_token);
  update reports r set
    status = coalesce(p ->> 'status', r.status),
    updated_at = now()
  where r.id = (p ->> 'id')::bigint
  returning jsonb_build_object('id', r.id, 'status', r.status, 'updated_at', r.updated_at) into v;
  if v is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  -- a note from this older status endpoint becomes an admin chat message (no email)
  if nullif(trim(p ->> 'note'), '') is not null then
    insert into report_messages (report_id, author, author_name, body)
    select (p ->> 'id')::bigint, 'admin', a.name, trim(p ->> 'note') from accounts a where a.id = ori_require_admin(p_token);
    update reports set last_message_at = now() where id = (p ->> 'id')::bigint;
  end if;
  return v;
end
$$;

create or replace function api_admin_verifications(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform ori_require_admin(p_token);
  return jsonb_build_object(
    'recent', coalesce((
      select jsonb_agg(t) from (
        select e.code, e.product_id, p.name, e.created_at
        from verification_events e left join products p on p.id = e.product_id
        order by e.created_at desc limit 40
      ) t), '[]'),
    'by_product', coalesce((
      select jsonb_agg(t) from (
        select e.product_id as id, p.name, count(*)::int as checks
        from verification_events e join products p on p.id = e.product_id
        where e.created_at >= now() - interval '30 days' group by 1, 2 order by checks desc limit 10
      ) t), '[]'),
    'unknown', coalesce((
      select jsonb_agg(t) from (
        select e.code, count(*)::int as checks, max(e.created_at) as last_seen
        from verification_events e
        where e.product_id is null and e.created_at >= now() - interval '30 days' group by 1 order by checks desc limit 10
      ) t), '[]')
  );
end
$$;

create or replace function api_admin_people(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform ori_require_admin(p_token);
  return jsonb_build_object(
    'accounts', coalesce((
      select jsonb_agg(t) from (
        select a.email, a.name, a.role, a.created_at, a.disabled, a.last_login_at,
               (select count(*) from orders o where o.account_id = a.id)::int as orders,
               (select coalesce(sum(o.total), 0) from orders o where o.account_id = a.id and o.status <> 'cancelled')::bigint as spent
        from accounts a order by a.created_at desc
      ) t), '[]'),
    'subscribers', coalesce((
      select jsonb_agg(t) from (select s.email, s.created_at from newsletter_subscribers s order by s.created_at desc) t), '[]'),
    -- Guest checkouts: order emails with no account, grouped
    'guests', coalesce((
      select jsonb_agg(t) from (
        select o.email, (array_agg(o.customer_name order by o.created_at desc))[1] as name,
               (array_agg(o.city order by o.created_at desc))[1] as city,
               count(*)::int as orders, coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0)::bigint as spent,
               min(o.created_at) as first_order_at, max(o.created_at) as last_order_at
        from orders o
        where o.account_id is null and not exists (select 1 from accounts a where a.email = o.email)
        group by o.email order by max(o.created_at) desc
      ) t), '[]')
  );
end
$$;

-- Grants: helpers stay private, api_* go to the API role only
revoke all on function ori_session_account(text), ori_require_account(text), ori_require_admin(text) from public;
revoke all on function api_auth_register(jsonb), api_auth_lookup(text), api_auth_attempt(text, boolean), api_session_create(uuid, text, integer),
  api_session_get(text), api_session_delete(text), api_account_orders(text), api_account_reports(text), api_report_create(text, jsonb),
  api_order_link(text, text), api_admin_overview(text), api_admin_orders(text, text, text, integer, integer), api_admin_order(text, text),
  api_admin_order_update(text, jsonb), api_admin_order_event(text, jsonb), api_admin_products(text), api_admin_product_update(text, jsonb), api_admin_reports(text, text),
  api_admin_report_update(text, jsonb), api_admin_verifications(text), api_admin_people(text) from public;
grant execute on function api_auth_register(jsonb), api_auth_lookup(text), api_auth_attempt(text, boolean), api_session_create(uuid, text, integer),
  api_session_get(text), api_session_delete(text), api_account_orders(text), api_account_reports(text), api_report_create(text, jsonb),
  api_order_link(text, text), api_admin_overview(text), api_admin_orders(text, text, text, integer, integer), api_admin_order(text, text),
  api_admin_order_update(text, jsonb), api_admin_order_event(text, jsonb), api_admin_products(text), api_admin_product_update(text, jsonb), api_admin_reports(text, text),
  api_admin_report_update(text, jsonb), api_admin_verifications(text), api_admin_people(text) to ori_api;

-- Storefront catalog: live price/stock/visibility plus admin-edited details and admin-created products
create or replace function api_catalog()
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'brand', p.brand, 'name', p.name, 'category', p.category, 'price', p.price, 'sizes', to_jsonb(p.sizes),
    'stock', p.stock, 'condition', p.condition, 'color', p.color, 'description', p.description, 'active', p.active, 'media', p.media
  ) order by p.id), '[]') from products p
$$;

create or replace function api_media_get(p_id uuid)
returns table (mime text, data bytea)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select i.mime, i.data from product_images i where i.id = p_id
$$;

create or replace function api_admin_media_add(p_token text, p_product text, p_mime text, p_data bytea)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v uuid;
begin
  perform ori_require_admin(p_token);
  if not exists (select 1 from products where id = p_product) then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into product_images (product_id, mime, data) values (p_product, p_mime, p_data) returning id into v;
  return jsonb_build_object('id', v, 'url', '/api/media?id=' || v);
end
$$;

-- New product; the ID is derived from brand + name (ORI-NK-DUN-001)
create or replace function api_admin_product_create(p_token text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_brand text := trim(p ->> 'brand');
  v_name  text := trim(p ->> 'name');
  v_base  text := 'ORI-' || coalesce(nullif(upper(left(regexp_replace(v_brand, '[^A-Za-z]', '', 'g'), 2)), ''), 'XX')
                  || '-' || coalesce(nullif(upper(left(regexp_replace(v_name, '[^A-Za-z0-9]', '', 'g'), 3)), ''), 'NEW');
  v_id    text;
  n       integer := 1;
begin
  perform ori_require_admin(p_token);
  loop
    v_id := v_base || '-' || lpad(n::text, 3, '0');
    exit when not exists (select 1 from products where id = v_id);
    n := n + 1;
  end loop;
  insert into products (id, brand, name, category, price, sizes, stock, condition, color, description, active, media)
  values (v_id, v_brand, v_name, trim(p ->> 'category'), (p ->> 'price')::integer,
          array(select jsonb_array_elements_text(p -> 'sizes')), coalesce((p ->> 'stock')::integer, 0), p ->> 'condition',
          nullif(trim(p ->> 'color'), ''), nullif(trim(p ->> 'description'), ''), coalesce((p ->> 'active')::boolean, false),
          coalesce(p -> 'media', '{}'::jsonb));
  return jsonb_build_object('id', v_id);
end
$$;

-- Only products that were never ordered can be deleted; others should be hidden instead
create or replace function api_admin_product_delete(p_token text, p_id text)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform ori_require_admin(p_token);
  if exists (select 1 from order_items where product_id = p_id) then raise exception 'has_orders' using errcode = '22023'; end if;
  delete from products where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', p_id, 'deleted', true);
end
$$;

-- Support chat, customer side
create or replace function ori_thread(p_report bigint)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_array(jsonb_build_object('id', 0, 'author', 'customer', 'author_name', coalesce(a.name, r.email), 'body', r.message, 'at', r.created_at))
    || coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'author', m.author, 'author_name', m.author_name, 'body', m.body, 'at', m.created_at,
                   'email', (select e.status from email_outbox e where e.id = m.email_id)) order by m.id)
                 from report_messages m where m.report_id = r.id), '[]')
  from reports r left join accounts a on a.id = r.account_id where r.id = p_report
$$;

create or replace function api_report_thread(p_token text, p_id bigint)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v uuid := ori_require_account(p_token);
  r reports;
begin
  select * into r from reports where id = p_id and account_id = v;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  update reports set customer_seen_at = now() where id = r.id;
  return jsonb_build_object('id', r.id, 'subject', r.subject, 'type', r.type, 'status', r.status, 'order_number', r.order_number,
    'product_code', r.product_code, 'created_at', r.created_at, 'messages', ori_thread(r.id));
end
$$;

create or replace function api_report_message(p_token text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v uuid := ori_require_account(p_token);
  r reports;
  m report_messages;
begin
  select * into r from reports where id = (p ->> 'id')::bigint and account_id = v for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into report_messages (report_id, author, author_name, body)
  select r.id, 'customer', a.name, trim(p ->> 'body') from accounts a where a.id = v
  returning * into m;
  update reports set
    status = case when status in ('resolved', 'closed') then 'open' else status end, -- a new message reopens it
    last_message_at = m.created_at, customer_seen_at = m.created_at, updated_at = now()
  where id = r.id;
  return jsonb_build_object('id', m.id, 'author', m.author, 'author_name', m.author_name, 'body', m.body, 'at', m.created_at);
end
$$;

-- Support chat, admin side
create or replace function api_admin_report_thread(p_token text, p_id bigint)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare r reports;
begin
  perform ori_require_admin(p_token);
  select * into r from reports where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  update reports set admin_seen_at = now() where id = r.id;
  return jsonb_build_object('id', r.id, 'subject', r.subject, 'type', r.type, 'status', r.status, 'email', r.email,
    'order_number', r.order_number, 'product_code', r.product_code, 'created_at', r.created_at,
    'customer', (select jsonb_build_object('name', a.name, 'email', a.email, 'disabled', a.disabled, 'since', a.created_at,
                   'orders', (select count(*) from orders o where o.account_id = a.id))
                 from accounts a where a.id = r.account_id),
    'order', (select jsonb_build_object('number', o.number, 'status', o.status, 'total', o.total, 'courier', o.courier, 'waybill', o.waybill)
              from orders o where o.number = r.order_number),
    'messages', ori_thread(r.id));
end
$$;

-- Reply (queues an email to the customer) and optionally change the status
create or replace function api_admin_report_message(p_token text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := ori_require_admin(p_token);
  r       reports;
  m       report_messages;
  v_mail  bigint;
  v_name  text := (select a.name from accounts a where a.id = v_admin);
begin
  select * into r from reports where id = (p ->> 'id')::bigint for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if coalesce((p ->> 'email')::boolean, true) then
    insert into email_outbox (to_email, subject, body)
    values (r.email, left('Re: ' || r.subject || ' [ORI support #' || r.id || ']', 200),
            left(trim(p ->> 'body') || E'\n\n-- ' || v_name || E', ORI Support\nReply or follow the conversation: ' || coalesce(p ->> 'link', '/account?view=support'), 5000))
    returning id into v_mail;
  end if;
  insert into report_messages (report_id, author, author_name, body, email_id)
  values (r.id, 'admin', v_name, trim(p ->> 'body'), v_mail)
  returning * into m;
  update reports set
    status = coalesce(p ->> 'status', case when status = 'open' then 'in_progress' else status end),
    last_message_at = m.created_at, admin_seen_at = m.created_at, updated_at = now()
  where id = r.id;
  return jsonb_build_object('id', m.id, 'author', m.author, 'author_name', m.author_name, 'body', m.body, 'at', m.created_at,
    'email', case when v_mail is null then null else 'queued' end,
    'status', (select status from reports where id = r.id));
end
$$;

-- Email outbox worker (api/_lib/mail.js)
create or replace function api_mail_claim(p_limit integer)
returns jsonb
language sql security definer
set search_path = public, pg_temp
as $$
  with picked as (
    select id from email_outbox
    where status = 'queued' or (status in ('failed', 'sending') and attempts < 5 and created_at < now() - interval '1 minute')
    order by id limit least(greatest(p_limit, 1), 50) for update skip locked
  ), claimed as (
    update email_outbox e set status = 'sending', attempts = e.attempts + 1 from picked where e.id = picked.id
    returning jsonb_build_object('id', e.id, 'to', e.to_email, 'subject', e.subject, 'body', e.body) as j
  )
  select coalesce(jsonb_agg(j), '[]') from claimed
$$;

create or replace function api_mail_done(p_id bigint, p_ok boolean, p_error text)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  update email_outbox set status = case when p_ok then 'sent' else 'failed' end,
    sent_at = case when p_ok then now() end, last_error = left(p_error, 500) where id = p_id
$$;

-- User management
create or replace function api_admin_account(p_token text, p_email text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare a accounts;
begin
  perform ori_require_admin(p_token);
  select * into a from accounts where email = lower(trim(p_email));
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object('email', a.email, 'name', a.name, 'role', a.role, 'disabled', a.disabled,
    'created_at', a.created_at, 'last_login_at', a.last_login_at,
    'sessions', (select count(*) from sessions s where s.account_id = a.id and s.expires_at > now()),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('number', o.number, 'status', o.status, 'total', o.total, 'created_at', o.created_at) order by o.created_at desc)
                        from orders o where o.account_id = a.id), '[]'),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'subject', r.subject, 'status', r.status, 'created_at', r.created_at) order by r.created_at desc)
                         from reports r where r.account_id = a.id), '[]'),
    'spent', (select coalesce(sum(o.total), 0) from orders o where o.account_id = a.id and o.status <> 'cancelled'));
end
$$;

-- Role / name / disable. An admin can't demote or disable themselves (no lock-out).
create or replace function api_admin_account_update(p_token text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_me accounts;
  a    accounts;
begin
  select * into v_me from accounts where id = ori_require_admin(p_token);
  select * into a from accounts where email = lower(trim(p ->> 'email')) for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if a.id = v_me.id and ((p ->> 'role') = 'customer' or coalesce((p ->> 'disabled')::boolean, false)) then
    raise exception 'cannot_change_self' using errcode = '22023';
  end if;
  update accounts set
    role = coalesce(p ->> 'role', role),
    name = case when p ? 'name' then trim(p ->> 'name') else name end,
    disabled = coalesce((p ->> 'disabled')::boolean, disabled)
  where id = a.id
  returning * into a;
  if a.disabled then delete from sessions where account_id = a.id; end if;
  return jsonb_build_object('email', a.email, 'name', a.name, 'role', a.role, 'disabled', a.disabled);
end
$$;

-- New password (hashed in the API); signs the account out everywhere
create or replace function api_admin_account_password(p_token text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v uuid;
begin
  perform ori_require_admin(p_token);
  update accounts set password_hash = p ->> 'hash' where email = lower(trim(p ->> 'email')) returning id into v;
  if v is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  delete from sessions where account_id = v;
  return jsonb_build_object('email', lower(trim(p ->> 'email')), 'reset', true);
end
$$;

create or replace function api_admin_account_create(p_token text, p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare a accounts;
begin
  perform ori_require_admin(p_token);
  insert into accounts (email, name, password_hash, role)
  values (lower(trim(p ->> 'email')), trim(p ->> 'name'), p ->> 'hash', coalesce(p ->> 'role', 'customer'))
  returning * into a;
  -- an admin creating the account vouches for the email, so its guest orders move into the account
  update orders set account_id = a.id where email = a.email and account_id is null;
  return jsonb_build_object('email', a.email, 'name', a.name, 'role', a.role);
exception when unique_violation then
  return jsonb_build_object('error', 'email_taken');
end
$$;

revoke all on function ori_thread(bigint) from public;
revoke all on function api_catalog(), api_media_get(uuid), api_admin_media_add(text, text, text, bytea), api_admin_product_create(text, jsonb),
  api_admin_product_delete(text, text), api_report_thread(text, bigint), api_report_message(text, jsonb), api_admin_report_thread(text, bigint),
  api_admin_report_message(text, jsonb), api_mail_claim(integer), api_mail_done(bigint, boolean, text), api_admin_account(text, text),
  api_admin_account_update(text, jsonb), api_admin_account_password(text, jsonb), api_admin_account_create(text, jsonb) from public;
grant execute on function api_catalog(), api_media_get(uuid), api_admin_media_add(text, text, text, bytea), api_admin_product_create(text, jsonb),
  api_admin_product_delete(text, text), api_report_thread(text, bigint), api_report_message(text, jsonb), api_admin_report_thread(text, bigint),
  api_admin_report_message(text, jsonb), api_mail_claim(integer), api_mail_done(bigint, boolean, text), api_admin_account(text, text),
  api_admin_account_update(text, jsonb), api_admin_account_password(text, jsonb), api_admin_account_create(text, jsonb) to ori_api;

-- Simulated payment (no gateway yet): the customer opens /pay/<number>, picks a method and confirms.
-- Access: the signed-in owner, or whoever knows the order's email (guest checkout).
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check check (payment_method in ('card', 'ewallet', 'transfer', 'qris'));

create or replace function ori_order_for(p jsonb)
returns orders
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare o orders;
begin
  select * into o from orders where number = upper(trim(p ->> 'number'));
  if not found or not (
       (o.account_id is not null and o.account_id = ori_session_account(p ->> 'session'))
    or (nullif(trim(p ->> 'email'), '') is not null and o.email = lower(trim(p ->> 'email')))) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return o;
end
$$;

create or replace function ori_order_summary(o orders)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('number', o.number, 'status', o.status, 'total', o.total, 'subtotal', o.subtotal, 'shipping', o.shipping_fee,
    'payment_method', o.payment_method, 'name', o.customer_name, 'email', o.email, 'city', o.city, 'created_at', o.created_at, 'paid_at', o.paid_at,
    'items', (select jsonb_agg(jsonb_build_object('id', i.product_id, 'name', p.name, 'size', i.size, 'qty', i.qty, 'price', i.unit_price) order by i.product_id)
              from order_items i join products p on p.id = i.product_id where i.order_id = o.id))
$$;

create or replace function api_order_lookup(p jsonb)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select ori_order_summary(ori_order_for(p))
$$;

create or replace function api_order_pay(p jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  o        orders := ori_order_for(p);
  v_method text := p ->> 'method';
begin
  if o.status <> 'pending' then raise exception 'not_payable' using errcode = '22023'; end if;
  update orders set status = 'paid', paid_at = now(), payment_method = coalesce(v_method, payment_method)
  where id = o.id returning * into o;
  insert into order_events (order_id, kind, text)
  values (o.id, 'paid', 'Payment confirmed (' || case o.payment_method when 'qris' then 'QRIS' when 'card' then 'card'
                                                      when 'ewallet' then 'e-wallet' else 'bank transfer' end || ')');
  return ori_order_summary(o);
end
$$;

revoke all on function ori_order_for(jsonb), ori_order_summary(orders) from public;
revoke all on function api_order_lookup(jsonb), api_order_pay(jsonb) from public;
grant execute on function api_order_lookup(jsonb), api_order_pay(jsonb) to ori_api;

-- One guest (no account): their orders by email
create or replace function api_admin_guest(p_token text, p_email text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_email text := lower(trim(p_email));
begin
  perform ori_require_admin(p_token);
  if not exists (select 1 from orders where email = v_email and account_id is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return (
    select jsonb_build_object('email', v_email, 'guest', true,
      'name', (array_agg(o.customer_name order by o.created_at desc))[1],
      'phone', (array_agg(o.phone order by o.created_at desc) filter (where o.phone is not null))[1],
      'city', (array_agg(o.city order by o.created_at desc))[1],
      'has_account', exists (select 1 from accounts a where a.email = v_email),
      'spent', coalesce(sum(o.total) filter (where o.status <> 'cancelled'), 0),
      'orders', jsonb_agg(jsonb_build_object('number', o.number, 'status', o.status, 'total', o.total, 'created_at', o.created_at) order by o.created_at desc))
    from orders o where o.email = v_email and o.account_id is null);
end
$$;

revoke all on function api_admin_guest(text, text) from public;
grant execute on function api_admin_guest(text, text) to ori_api;
