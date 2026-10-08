import { json, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

// Recent checks, most-checked products and unknown (possibly counterfeit) codes
export const GET = route(async (request, sql) => {
  const [{ data }] = await sql`select api_admin_verifications(${requireSession(request)}) as data`
  return json(data)
})
