import { json, route } from './_lib/http.js'

// Live catalog: price, stock, visibility, admin-edited details and admin-created products
export const GET = route(async (_request, sql) => {
  const [{ items }] = await sql`select api_catalog() as items`
  return json({ items }, 200, { 'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120' })
})
