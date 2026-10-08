// Database tasks: `node scripts/db.mjs setup | demo | admin | seed-sql`
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

function connect() {
  for (const f of ['.env.local', '.env']) if (fs.existsSync(new URL(f, root))) process.loadEnvFile(new URL(f, root))
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) {
    console.error('DATABASE_URL is missing. Put it in .env.local (see .env.example).')
    process.exit(1)
  }
  // No TLS for local or private-network databases (localhost, or ?sslmode=disable e.g. a VPS/Docker host)
  const ssl = /@(localhost|127\.0\.0\.1)[:/]|sslmode=disable/.test(url) ? false : 'require'
  return postgres(url, { prepare: false, max: 1, ssl, onnotice: () => {} })
}

const task = process.argv[2]
if (task === 'seed-sql') {
  fs.writeFileSync(new URL('db/seed.sql', root), seedSql())
  console.log('wrote db/seed.sql')
} else if (task === 'setup' || task === 'demo') {
  const sql = connect()
  try {
    if (task === 'setup') {
      await sql.unsafe(read('db/schema.sql'))
      await sql.unsafe(seedSql())
      const [{ n }] = await sql`select count(*)::int as n from products`
      console.log(`schema applied, ${n} products seeded`)
    } else {
      await sql.unsafe(read('db/demo.sql'))
      const [r] = await sql`select (select count(*) from orders)::int as orders, (select count(*) from newsletter_subscribers)::int as subscribers, (select count(*) from verification_events)::int as checks`
      console.log(`demo data loaded: ${r.orders} orders, ${r.subscribers} subscribers, ${r.checks} verification checks`)
    }
  } catch (e) {
    console.error(`database ${task} failed: ${e.message}`)
    process.exitCode = 1
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {})
  }
} else if (task === 'admin') {
  // Creates or promotes an admin: ADMIN_EMAIL, ADMIN_PASSWORD (8+ chars), optional ADMIN_NAME
  const { hashPassword } = await import('../api/_lib/auth.js')
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password || password.length < 8) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters).')
    process.exit(1)
  }
  const sql = connect()
  try {
    const hash = await hashPassword(password)
    await sql`insert into accounts (email, name, password_hash, role) values (${email}, ${process.env.ADMIN_NAME || 'ORI Admin'}, ${hash}, 'admin')
      on conflict (email) do update set password_hash = excluded.password_hash, role = 'admin'`
    await sql`delete from sessions where account_id = (select id from accounts where email = ${email})` // new password signs out old sessions
    console.log(`admin ready: ${email}`)
  } catch (e) {
    console.error(`admin setup failed: ${e.message}`)
    process.exitCode = 1
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {})
  }
} else {
  console.log('usage: node scripts/db.mjs setup | demo | admin | seed-sql')
}
