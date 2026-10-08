-- Generated from src/data/products.json by scripts/db.mjs. Re-running resets stock.
insert into products (id, brand, name, category, price, sizes, stock, condition, color, description) values
  ('ORI-NK-AF1-001', 'Nike', 'Air Force 1 ''07 White', 'Sneakers', 1549000, array['40', '41', '42', '43', '44']::text[], 12, 'BNIB', 'White', 'The clean all-white icon. Crisp leather upper, perforated toe box and the classic Air cushioning that started it all.'),
  ('ORI-NK-AJ1-001', 'Nike', 'Air Jordan 1 High "Chicago"', 'Sneakers', 3299000, array['41', '42', '43']::text[], 3, 'BNIB', 'Red / White / Black', 'The colorway that defined a generation. Premium leather in the original 1985 red, white and black blocking.'),
  ('ORI-AD-SMB-001', 'Adidas', 'Samba OG', 'Sneakers', 1700000, array['40', '41', '42', '43', '44']::text[], 9, 'BNIB', 'White / Black / Gum', 'Terrace classic turned street staple. Soft leather upper, suede T-toe overlay and a gum rubber outsole.'),
  ('ORI-AD-YZY-001', 'Adidas', 'Yeezy Boost 350 V2 Zebra', 'Sneakers', 4200000, array['41', '42', '43']::text[], 2, 'Pre-Owned', 'White / Core Black', 'Primeknit upper in the zebra pattern over full-length Boost cushioning. Lightly worn, cleaned and checked.'),
  ('ORI-NB-550-001', 'New Balance', '550 White Green', 'Sneakers', 1899000, array['40', '41', '42', '43', '44']::text[], 7, 'BNIB', 'White / Green', 'A 1989 basketball silhouette brought back for the street. Leather upper with green accents and a chunky cupsole.'),
  ('ORI-NB-990-001', 'New Balance', '990v6 Grey', 'Sneakers', 3499000, array['42', '43', '44']::text[], 4, 'BNIB', 'Grey', 'The dad shoe, perfected. Pigskin suede and mesh in signature grey with FuelCell cushioning.'),
  ('ORI-CV-CHK-001', 'Converse', 'Chuck 70 High Black', 'Sneakers', 1099000, array['39', '40', '41', '42', '43']::text[], 15, 'BNIB', 'Black', 'Heavier canvas, cushioned insole and vintage details. The archive version of an all-time classic.'),
  ('ORI-VN-OSK-001', 'Vans', 'Old Skool Black/White', 'Sneakers', 999000, array['39', '40', '41', '42', '43', '44']::text[], 20, 'BNIB', 'Black / White', 'Suede and canvas skate shoe with the iconic side stripe and waffle outsole.'),
  ('ORI-OT-M66-001', 'Onitsuka Tiger', 'Mexico 66 Yellow', 'Sneakers', 1650000, array['40', '41', '42', '43']::text[], 6, 'BNIB', 'Yellow / Black', 'Slim 1966 silhouette in bold yellow with black Tiger stripes. Lightweight and low to the ground.'),
  ('ORI-ES-HOD-001', 'Essentials', 'Essentials Hoodie', 'Apparel', 1850000, array['S', 'M', 'L', 'XL']::text[], 8, 'BNIB', 'Dark Oatmeal', 'Relaxed, heavyweight fleece hoodie with rubberized chest logo and dropped shoulders.'),
  ('ORI-ST-TEE-001', 'Stüssy', 'Basic Tee', 'Apparel', 750000, array['S', 'M', 'L', 'XL']::text[], 0, 'BNIB', 'Black', 'Cotton tee with the signature script logo. A streetwear basic since the 80s.')
on conflict (id) do update set
  brand = excluded.brand, name = excluded.name, category = excluded.category, price = excluded.price,
  sizes = excluded.sizes, stock = excluded.stock, condition = excluded.condition, color = excluded.color,
  description = excluded.description, active = true, updated_at = now();
