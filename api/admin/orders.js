import { HttpError, json, readJson, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

const STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled']
const short = (v, max) => v === undefined || v === null || (typeof v === 'string' && v.length <= max)

// List with status filter, search (number, name, email, city) and paging
export const GET = route(async (request, sql) => {
  const token = requireSession(request)
  const q = new URL(request.url).searchParams
  const status = STATUSES.includes(q.get('status')) ? q.get('status') : ''
  const page = Math.max(0, Number.parseInt(q.get('page') ?? '0', 10) || 0)
  const [{ data }] = await sql`select api_admin_orders(${token}, ${status}, ${(q.get('q') ?? '').slice(0, 80)}, 25, ${page * 25}) as data`
  return json(data)
})

// Move an order along: pending → paid → shipped (courier + waybill) → delivered, or cancel (restocks)
export const POST = route(async (request, sql) => {
  const token = requireSession(request)
  const { number, status, courier, waybill, note } = await readJson(request, 2048)
  if (typeof number !== 'string' || number.length > 40 || !STATUSES.includes(status) || !short(courier, 40) || !short(waybill, 40) || !short(note, 200)) {
    throw new HttpError(400, 'invalid_input')
  }
  const [{ data }] = await sql`select api_admin_order_update(${token}, ${sql.json({ number, status, courier, waybill, note })}::jsonb) as data`
  return json(data)
})
