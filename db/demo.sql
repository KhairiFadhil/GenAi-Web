-- ORI demo data for the last 30 days: orders, customer accounts, support reports, newsletter sign-ups, verification checks.
-- Run after schema.sql and seed.sql. Deterministic (fixed random seed) and dated relative to now().
-- Safe to re-run: replaces only its own rows (orders numbered -S0001..., customers and reports @example.com),
-- never touches real orders or admin accounts, never changes stock.
-- Demo customer login: demo@example.com / demo1234

do $$
declare
  first_names text[] := array['Raka', 'Nadia', 'Bima', 'Salsa', 'Dimas', 'Ayu', 'Fajar', 'Citra', 'Rizky', 'Putri', 'Galih', 'Intan', 'Yoga', 'Laras', 'Arya', 'Dewi'];
  last_names  text[] := array['Pratama', 'Saputra', 'Wijaya', 'Lestari', 'Hidayat', 'Kusuma', 'Nugroho', 'Permata', 'Santoso', 'Maharani'];
  -- city, postal code
  cities      text[] := array[
    ['Jakarta Selatan', '12190'], ['Jakarta Barat', '11470'], ['Bandung', '40115'], ['Surabaya', '60271'],
    ['Bandar Lampung', '35132'], ['Yogyakarta', '55223'], ['Semarang', '50241'], ['Medan', '20152'],
    ['Denpasar', '80234'], ['Makassar', '90111'], ['Malang', '65145'], ['Tangerang Selatan', '15412']];
  streets     text[] := array['Jl. Sudirman', 'Jl. Gatot Subroto', 'Jl. Diponegoro', 'Jl. Ahmad Yani', 'Jl. Merdeka', 'Jl. Pemuda', 'Jl. Gajah Mada', 'Jl. Imam Bonjol'];
  payments    text[] := array['card', 'ewallet', 'transfer'];
  bad_codes   text[] := array['ORI-XXXX-999', 'ORI-NK-AF1-999', 'ORI-AD-YZY-404', 'ORI-FAKE-001'];
  v_order   uuid;
  v_created timestamptz;
  v_status  text;
  v_first   text;
  v_last    text;
  v_city    int;
  v_age     interval;
  v_total   int;
  v_product text;
  v_demo    uuid;
  -- scrypt hash of 'demo1234' (same format as api/_lib/auth.js)
  v_hash    text := 'scrypt$16384$8$1$SSc48WBAo31207MGzy9EOw==$WIxFpVnhxKiR4lQBGs609qmfaKV7thF99DxlwbA+fi0=';
begin
  perform setseed(0.42);

  delete from reports where email like '%@example.com';
  delete from accounts where email like '%@example.com' and role = 'customer'; -- sessions cascade

  -- Orders: 36 over 30 days, weighted toward recent days; older ones shipped, recent ones paid or pending
  delete from orders where number ~ '-S[0-9]{4}$'; -- cascades to order_items
  for i in 1..36 loop
    v_age     := power(random(), 1.8) * interval '30 days';
    v_created := now() - v_age;
    v_status  := case
      when v_age > interval '7 days' then case when random() < 0.08 then 'cancelled' else 'shipped' end
      when v_age > interval '2 days' then case when random() < 0.6 then 'paid' else 'shipped' end
      else case when random() < 0.5 then 'pending' else 'paid' end
    end;
    v_first := first_names[floor(random() * cardinality(first_names))::int + 1];
    v_last  := last_names[floor(random() * cardinality(last_names))::int + 1];
    v_city  := floor(random() * array_length(cities, 1))::int + 1;

    insert into orders (number, customer_name, email, phone, address, city, postal_code, payment_method,
                        subtotal, shipping_fee, total, status, created_at)
    values (
      'ORI-' || to_char(timezone('UTC', v_created) + interval '7 hours', 'YYMMDD') || '-S' || lpad(i::text, 4, '0'),
      v_first || ' ' || v_last,
      lower(v_first || '.' || v_last || i || '@example.com'),
      '08' || lpad(floor(random() * 1e10)::bigint::text, 10, '0'),
      streets[floor(random() * cardinality(streets))::int + 1] || ' No. ' || (floor(random() * 150)::int + 1),
      cities[v_city][1], cities[v_city][2],
      payments[floor(random() * 3)::int + 1],
      0, 0, 0, v_status, v_created
    )
    returning id into v_order;

    -- 1-3 different products, qty mostly 1, price as listed
    insert into order_items (order_id, product_id, size, qty, unit_price)
    select v_order, p.id, p.sizes[floor(random() * cardinality(p.sizes))::int + 1], case when random() < 0.2 then 2 else 1 end, p.price
    from (select id, sizes, price from products where active order by random() limit floor(random() * 3)::int + 1) p;

    select sum(qty * unit_price)::int into v_total from order_items where order_id = v_order;
    update orders set subtotal = v_total, total = v_total where id = v_order;
  end loop;

  -- Fulfilment history: shipped more than 3 days ago means delivered; every step gets a timestamp and an event
  update orders set status = 'delivered' where number ~ '-S[0-9]{4}$' and status = 'shipped' and created_at < now() - interval '3 days';
  update orders set paid_at = created_at + interval '25 minutes'
  where number ~ '-S[0-9]{4}$' and status in ('paid', 'shipped', 'delivered');
  update orders set
    shipped_at = created_at + interval '20 hours',
    courier = (array['JNE REG', 'SiCepat REG', 'J&T Express', 'AnterAja'])[1 + abs(hashtext(number)) % 4],
    waybill = (array['JN', 'SC', 'JX', 'AA'])[1 + abs(hashtext(number)) % 4] || upper(substr(md5(number), 1, 10))
  where number ~ '-S[0-9]{4}$' and status in ('shipped', 'delivered');
  update orders set delivered_at = created_at + interval '64 hours' where number ~ '-S[0-9]{4}$' and status = 'delivered';
  update orders set cancelled_at = created_at + interval '2 hours' where number ~ '-S[0-9]{4}$' and status = 'cancelled';
  insert into order_events (order_id, kind, text, place, created_at)
  select id, 'paid', 'Payment confirmed', null, paid_at from orders where number ~ '-S[0-9]{4}$' and paid_at is not null
  union all
  select id, 'shipped', 'Handed to ' || courier || ', waybill ' || waybill, 'ORI warehouse, Jakarta', shipped_at
  from orders where number ~ '-S[0-9]{4}$' and shipped_at is not null
  union all
  select o.id, 'update', l.text, coalesce(l.place, o.city), o.shipped_at + l.after
  from orders o
  cross join (values ('Departed sorting center', 'Jakarta', interval '10 hours'),
                     ('Arrived at destination hub', null, interval '26 hours'),
                     ('Out for delivery', null, interval '38 hours')) as l(text, place, after)
  where o.number ~ '-S[0-9]{4}$' and o.shipped_at is not null and o.shipped_at + l.after < coalesce(o.delivered_at, now())
  union all
  select id, 'delivered', 'Delivered, received by customer', city, delivered_at from orders where number ~ '-S[0-9]{4}$' and delivered_at is not null
  union all
  select id, 'cancelled', 'Order cancelled', null, cancelled_at from orders where number ~ '-S[0-9]{4}$' and cancelled_at is not null;
  insert into order_events (order_id, kind, text, internal, created_at)
  select id, 'note', 'Customer asked to gift-wrap the box.', true, created_at + interval '1 hour'
  from orders where number ~ '-S000[3-4]$';

  -- Accounts: the demo customer owns orders 1-5; six other customers get accounts for their orders
  insert into accounts (email, name, password_hash, created_at)
  values ('demo@example.com', 'Demo Customer', v_hash, now() - interval '40 days')
  returning id into v_demo;
  update orders set account_id = v_demo, customer_name = 'Demo Customer', email = 'demo@example.com'
  where number ~ '-S000[1-5]$';
  update orders set account_id = v_demo where email = 'demo@example.com' and account_id is null; -- real orders placed with the demo login
  insert into accounts (email, name, password_hash, created_at)
  select distinct on (o.email) o.email, o.customer_name, v_hash, o.created_at - interval '2 days'
  from orders o where o.number ~ '-S00(0[6-9]|1[01])$'
  on conflict (email) do nothing;
  update orders o set account_id = a.id from accounts a
  where a.email = o.email and o.number ~ '-S[0-9]{4}$' and o.account_id is null;

  -- Support reports: a mix of topics and states for the admin queue
  insert into reports (account_id, email, type, subject, message, order_number, product_code, status, admin_note, created_at, updated_at)
  select
    (select a.id from accounts a where a.email = coalesce(src.email, 'demo@example.com')),
    coalesce(src.email, 'demo@example.com'),
    r.type, r.subject, r.message,
    (select o.number from orders o where o.number like '%-S' || r.ord),
    r.code, r.status, r.note, now() - r.age, now() - r.age * 0.4
  from (values
    (true,  null::text, 'order',        'Package not received yet',                'Tracking has not updated for three days. Could you check where my package is?',                          '0001', null::text,       'open',        null::text,                                                         interval '20 hours'),
    (true,  null,       'verification', 'Verification shows a different colorway',  'The certificate for my pair says Chicago but the box label looks slightly different. Is this normal?',  null,   'ORI-NK-AJ1-001', 'in_progress', 'Checking the batch with the warehouse, we will reply within 24 hours.', interval '3 days'),
    (true,  null,       'product',      'Size advice for Samba OG',                  'I usually wear EU 42 in Nike. Which size should I pick for the Samba OG?',                               null,   'ORI-AD-SMB-001', 'resolved',    'Samba runs true to size, we recommend your usual EU 42.',           interval '9 days'),
    (false, '0010',     'order',        'Wrong size delivered',                      'I ordered EU 42 but the box contains EU 41. Please advise on an exchange.',                               '0010', null,             'open',        null,                                                               interval '2 days'),
    (false, '0014',     'verification', 'Code from a reseller is not found',          'A reseller gave me the code ORI-FAKE-001 for a pair of sneakers. Your site says not found. Is it fake?',  null,   'ORI-FAKE-001',   'open',        null,                                                               interval '1 day'),
    (false, '0012',     'order',        'Change shipping address',                   'Please ship to my office address instead: Jl. Pemuda No. 12. Order has not shipped yet.',                '0012', null,             'resolved',    'Address updated before dispatch.',                                 interval '6 days'),
    (false, '0020',     'other',        'Receipt for company reimbursement',         'Could you send a receipt with my company name on it for reimbursement?',                                 '0020', null,             'closed',      'Receipt sent by email.',                                           interval '14 days'),
    (false, '0016',     'verification', 'QR on the box leads to an unknown code',    'Scanning the QR on the box opens ORI-AD-YZY-404 which is not found. Bought from a marketplace.',         null,   'ORI-AD-YZY-404', 'in_progress', 'Flagged as a likely counterfeit listing, asking for photos.',        interval '4 days'),
    (false, '0008',     'product',      'Restock date for Basic Tee?',               'The Stussy Basic Tee is sold out in size M. Will it be restocked soon?',                                  null,   'ORI-ST-TEE-001', 'open',        null,                                                               interval '7 hours')
  ) as r(mine, src_ord, type, subject, message, ord, code, status, note, age)
  left join lateral (select o.email from orders o where o.number like '%-S' || r.src_ord) src on true;

  -- Newsletter: 18 sign-ups (existing emails are left alone)
  for i in 1..18 loop
    insert into newsletter_subscribers (email, created_at)
    values (
      lower(first_names[(i - 1) % cardinality(first_names) + 1] || '.' || last_names[(i * 3) % cardinality(last_names) + 1] || '@example.com'),
      now() - random() * interval '30 days'
    )
    on conflict (email) do nothing;
  end loop;

  -- Verification checks: 140 over 30 days, ~8% unknown codes; only on an empty log so real history is never mixed
  if not exists (select 1 from verification_events) then
    for i in 1..140 loop
      if random() < 0.08 then
        insert into verification_events (code, product_id, created_at)
        values (bad_codes[floor(random() * cardinality(bad_codes))::int + 1], null, now() - random() * interval '30 days');
      else
        select id into v_product from products where active order by random() limit 1;
        insert into verification_events (code, product_id, created_at)
        values (v_product, v_product, now() - random() * interval '30 days');
      end if;
    end loop;
  end if;
end
$$;
