import { HttpError, json, readJson, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

const TYPES = ['order', 'verification', 'product', 'other']
const text = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max
const optional = (v, max) => v == null || v === '' || (typeof v === 'string' && v.trim().length <= max)

// The customer's support reports
export const GET = route(async (request, sql) => {
  const [{ items }] = await sql`select api_account_reports(${requireSession(request)}) as items`
  return json({ items })
})

// File a new report (order problem, suspected counterfeit, product question…)
export const POST = route(async (request, sql) => {
  const token = requireSession(request)
  const { type, subject, message, order_number, product_code } = await readJson(request, 4096)
  const fields = {}
  if (!TYPES.includes(type)) fields.type = 'Choose a topic.'
  if (!text(subject, 3, 120)) fields.subject = 'Add a short subject (3–120 characters).'
  if (!text(message, 10, 2000)) fields.message = 'Describe the issue (at least 10 characters).'
  if (!optional(order_number, 40)) fields.order_number = 'Order number is too long.'
  if (!optional(product_code, 40)) fields.product_code = 'Product code is too long.'
  if (Object.keys(fields).length) throw new HttpError(400, 'invalid_input', { fields })
  const [{ report }] = await sql`select api_report_create(${token}, ${sql.json({ type, subject, message, order_number, product_code })}::jsonb) as report`
  return json(report, 201)
})
