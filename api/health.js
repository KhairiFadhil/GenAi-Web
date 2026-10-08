import { db } from './_lib/db.js'
import { json } from './_lib/http.js'

// Uptime check: app and database
export async function GET() {
  const sql = db()
  if (!sql) return json({ ok: true, database: 'not_configured' })
  try {
    await sql`select 1`
    return json({ ok: true, database: 'connected' })
  } catch {
    return json({ ok: false, database: 'unreachable' }, 503)
  }
}
