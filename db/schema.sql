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
