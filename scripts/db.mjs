// Database tasks: `node scripts/db.mjs setup | seed-sql`
import fs from 'node:fs'
import postgres from 'postgres'

const root = new URL('../', import.meta.url)
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8')

// Seed SQL from the storefront catalog
function seedSql() {
  const q = (v) => (v == null ? 'null' : `'${String(v).replaceAll("'", "''")}'`)
  const rows = JSON.parse(read('src/data/products.json')).map((p) =>
    `  (${[q(p.id), q(p.brand), q(p.name), q(p.category), p.price, `array[${p.sizes.map(q).join(', ')}]::text[]`, p.stock, q(p.condition), q(p.color), q(p.description)].join(', ')})`)
  return `-- Generated from src/data/products.json by scripts/db.mjs. Re-running resets stock.
insert into products (id, brand, name, category, price, sizes, stock, condition, color, description) values
${rows.join(',\n')}
on conflict (id) do update set
  brand = excluded.brand, name = excluded.name, category = excluded.category, price = excluded.price,
  sizes = excluded.sizes, stock = excluded.stock, condition = excluded.condition, color = excluded.color,
  description = excluded.description, active = true, updated_at = now();
`
}

const task = process.argv[2]
if (task === 'seed-sql') {
  fs.writeFileSync(new URL('db/seed.sql', root), seedSql())
  console.log('wrote db/seed.sql')
} else if (task === 'setup') {
  for (const f of ['.env.local', '.env']) if (fs.existsSync(new URL(f, root))) process.loadEnvFile(new URL(f, root))
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) {
    console.error('DATABASE_URL is missing. Put it in .env.local (see .env.example).')
    process.exit(1)
  }
  const sql = postgres(url, { prepare: false, max: 1, ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : 'require', onnotice: () => {} })
  try {
    await sql.unsafe(read('db/schema.sql'))
    await sql.unsafe(seedSql())
    const [{ n }] = await sql`select count(*)::int as n from products`
    console.log(`schema applied, ${n} products seeded`)
  } catch (e) {
    console.error(`database setup failed: ${e.message}`)
    process.exitCode = 1
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {})
  }
} else {
  console.log('usage: node scripts/db.mjs setup | seed-sql')
}
