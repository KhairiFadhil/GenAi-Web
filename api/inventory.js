import { json, route } from './_lib/http.js'

// Live price and stock per product
export const GET = route(async (_request, sql) => {
  const items = await sql`select id, price, stock, active from api_inventory()`
  return json({ items }, 200, { 'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120' })
})
