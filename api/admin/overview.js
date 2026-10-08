import { json, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

// KPIs, 30-day revenue, top products, recent orders, low stock (admin role is checked in the database)
export const GET = route(async (request, sql) => {
  const [{ data }] = await sql`select api_admin_overview(${requireSession(request)}) as data`
  return json(data)
})
