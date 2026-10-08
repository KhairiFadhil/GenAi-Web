import { HttpError, json, readJson, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

const int = (v, min, max) => v === undefined || (Number.isInteger(v) && v >= min && v <= max)

export const GET = route(async (request, sql) => {
  const [{ items }] = await sql`select api_admin_products(${requireSession(request)}) as items`
  return json({ items })
})

// Update price, stock or visibility of one product
export const POST = route(async (request, sql) => {
  const token = requireSession(request)
  const { id, price, stock, active } = await readJson(request, 1024)
  if (typeof id !== 'string' || id.length > 40 || !int(price, 1, 1_000_000_000) || !int(stock, 0, 100_000) || !(active === undefined || typeof active === 'boolean')) {
    throw new HttpError(400, 'invalid_input')
  }
  const [{ data }] = await sql`select api_admin_product_update(${token}, ${sql.json({ id, price, stock, active })}::jsonb) as data`
  return json(data)
})
