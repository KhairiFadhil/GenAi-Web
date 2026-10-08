import { json, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

// Orders placed while signed in to this account
export const GET = route(async (request, sql) => {
  const [{ items }] = await sql`select api_account_orders(${requireSession(request)}) as items`
  return json({ items })
})
