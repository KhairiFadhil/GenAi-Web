import { HttpError, json, readJson, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

// One order with customer, shipping and line items
export const GET = route(async (request, sql) => {
  const token = requireSession(request)
  const number = new URL(request.url).searchParams.get('number') ?? ''
  if (!number || number.length > 40) throw new HttpError(400, 'invalid_input')
  const [{ data }] = await sql`select api_admin_order(${token}, ${number}) as data`
  return json(data)
})

// Add a tracking update (shipped orders, the customer sees it) or an internal note (admin only)
export const POST = route(async (request, sql) => {
  const token = requireSession(request)
  const { number, text, place, internal } = await readJson(request, 2048)
  if (typeof number !== 'string' || number.length > 40 || typeof text !== 'string' || !text.trim() || text.length > 200 ||
      !(place == null || (typeof place === 'string' && place.length <= 80)) || !(internal === undefined || typeof internal === 'boolean')) {
    throw new HttpError(400, 'invalid_input')
  }
  const [{ data }] = await sql`select api_admin_order_event(${token}, ${sql.json({ number, text, place, internal })}::jsonb) as data`
  return json(data, 201)
})
