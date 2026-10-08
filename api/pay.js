import { EMAIL, HttpError, json, readJson, route } from './_lib/http.js'
import { sessionHash } from './_lib/auth.js'

// Simulated payment until a gateway is integrated. Owner (session) or guest (order email) only.
const METHODS = ['qris', 'card', 'ewallet', 'transfer']
const NUMBER = /^ORI-[A-Z0-9]+(-[A-Z0-9]+)+$/

function who(request, number, email) {
  if (typeof number !== 'string' || !NUMBER.test(number.trim().toUpperCase())) throw new HttpError(400, 'invalid_input')
  if (!(email == null || email === '' || (typeof email === 'string' && email.length <= 120 && EMAIL.test(email.trim())))) throw new HttpError(400, 'invalid_input')
  return { number, email: email ?? '', session: sessionHash(request) ?? '' }
}

// Bill for /pay/<number>
export const GET = route(async (request, sql) => {
  const q = new URL(request.url).searchParams
  const [{ data }] = await sql`select api_order_lookup(${sql.json(who(request, q.get('number'), q.get('email')))}::jsonb) as data`
  return json(data)
})

// "I've paid" → order becomes paid, returns the summary for the invoice
export const POST = route(async (request, sql) => {
  const { number, email, method } = await readJson(request, 1024)
  if (!METHODS.includes(method)) throw new HttpError(400, 'invalid_input')
  const [{ data }] = await sql`select api_order_pay(${sql.json({ ...who(request, number, email), method })}::jsonb) as data`
  return json(data)
})
