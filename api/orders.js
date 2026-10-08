import { EMAIL, HttpError, json, readJson, route } from './_lib/http.js'
import { sessionHash } from './_lib/auth.js'

const ID = /^ORI-[A-Z0-9]+(-[A-Z0-9]+)+$/
const PAYMENTS = new Set(['qris', 'card', 'ewallet', 'transfer'])
const text = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max

// Field messages shown under the form
function validate({ customer: c = {}, payment, items }) {
  const fields = {}
  if (!text(c.name, 2, 80)) fields.name = 'Enter your full name.'
  if (!text(c.email, 5, 120) || !EMAIL.test(c.email.trim())) fields.email = 'Enter a valid email address.'
  if (c.phone && !(typeof c.phone === 'string' && /^[0-9+()\-\s]{6,20}$/.test(c.phone.trim()))) fields.phone = 'Enter a valid phone number.'
  if (!text(c.address, 5, 300)) fields.address = 'Enter your street address.'
  if (!text(c.city, 2, 60)) fields.city = 'Enter your city.'
  if (!(typeof c.postal === 'string' && /^[0-9]{5}$/.test(c.postal.trim()))) fields.postal = 'Enter a 5-digit postal code.'
  if (!PAYMENTS.has(payment)) fields.payment = 'Choose a payment method.'
  const itemsOk = Array.isArray(items) && items.length >= 1 && items.length <= 20 && items.every((i) =>
    i && typeof i.id === 'string' && ID.test(i.id) && typeof i.size === 'string' && i.size.length <= 8 &&
    Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 10)
  if (!itemsOk) fields.items = 'Your bag could not be read. Refresh and try again.'
  return fields
}

// Place an order; totals are computed server-side
export const POST = route(async (request, sql) => {
  const body = await readJson(request)
  const fields = validate(body)
  if (Object.keys(fields).length) throw new HttpError(400, 'invalid_input', { fields })
  const c = body.customer
  const order = {
    customer: {
      name: c.name.trim(), email: c.email.trim().toLowerCase(), phone: c.phone?.trim() || null,
      address: c.address.trim(), city: c.city.trim(), postal: c.postal.trim(),
    },
    payment: body.payment,
    items: body.items.map(({ id, size, qty }) => ({ id, size, qty })),
  }
  const [{ result }] = await sql`select api_place_order(${sql.json(order)}::jsonb) as result`
  const session = sessionHash(request)
  if (session && result.number) await sql`select api_order_link(${result.number}, ${session})` // show it in the account
  return json(result, result.error === 'out_of_stock' ? 409 : 201)
})
