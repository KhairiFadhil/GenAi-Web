import { json, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

// Accounts with order totals, and newsletter subscribers
export const GET = route(async (request, sql) => {
  const [{ data }] = await sql`select api_admin_people(${requireSession(request)}) as data`
  return json(data)
})
