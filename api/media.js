import { db } from './_lib/db.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Uploaded product photo. Content never changes for an id, so it can be cached forever.
export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id') ?? ''
  const sql = db()
  if (!sql || !UUID.test(id)) return new Response(null, { status: 404 })
  const [row] = await sql`select mime, data from api_media_get(${id}::uuid)`
  if (!row) return new Response(null, { status: 404 })
  return new Response(row.data, {
    headers: { 'content-type': row.mime, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
  })
}
