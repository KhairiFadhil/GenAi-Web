import { HttpError, json, readJson, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

export const CATEGORIES = ['Sneakers', 'Apparel', 'Accessories']
const CONDITIONS = ['BNIB', 'Pre-Owned']
const MODELS = ['af1', 'aj1', 'samba', 'yeezy', 'nb550', 'nb990', 'chuck', 'vans', 'mexico'] // src/three/models.js
const ANCHORS = ['toe', 'stitching', 'sole', 'heel', 'stripe', 'collar', 'tongue', 'laces']
const HEX = /^#[0-9a-f]{6}$/i
const IMAGE = /^(\/api\/media\?id=[0-9a-f-]{36}|\/img\/[\w./-]{1,160})$/
const ID = /^ORI-[A-Z0-9]+(-[A-Z0-9]+)+$/

const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max

// Storefront media: photos, optional procedural 3D spec, hotspots, shelf swatch for apparel
function validMedia(m) {
  if (m === null || typeof m !== 'object' || Array.isArray(m)) return false
  const { images = [], model3D = null, hotspots = [], swatch } = m
  if (!Array.isArray(images) || images.length > 6 || !images.every((u) => typeof u === 'string' && IMAGE.test(u))) return false
  if (model3D !== null) {
    if (typeof model3D !== 'object' || !MODELS.includes(model3D.model)) return false
    const colors = Object.entries(model3D.colors ?? {})
    if (colors.length > 24 || !colors.every(([k, v]) => /^[a-z]{2,12}$/.test(k) && HEX.test(v))) return false
  }
  if (!Array.isArray(hotspots) || hotspots.length > 6 || !hotspots.every((h) =>
    h && ANCHORS.includes(h.at) && str(h.label, 1, 40) && (h.description === undefined || str(h.description, 0, 200)))) return false
  return swatch === undefined || (typeof swatch === 'string' && HEX.test(swatch))
}

// Field checks shared by create and update; `partial` allows missing fields (update)
function validate(b, partial) {
  const has = (k) => b[k] !== undefined
  const fields = {}
  const need = (k, ok, msg) => { if ((partial ? has(k) : true) && !ok) fields[k] = msg }
  need('brand', str(b.brand, 1, 40), 'Brand is required (max 40 characters).')
  need('name', str(b.name, 2, 80), 'Name is required (2–80 characters).')
  need('category', CATEGORIES.includes(b.category), 'Choose a category.')
  need('price', int(b.price, 1, 1_000_000_000), 'Price must be a whole amount of at least Rp 1.')
  need('stock', int(b.stock, 0, 100_000), 'Stock must be between 0 and 100.000.')
  need('condition', CONDITIONS.includes(b.condition), 'Choose a condition.')
  need('sizes', Array.isArray(b.sizes) && b.sizes.length >= 1 && b.sizes.length <= 20 && b.sizes.every((s) => str(s, 1, 8)) && new Set(b.sizes).size === b.sizes.length, 'Pick at least one size.')
  if (has('color') && !(b.color === null || str(b.color, 0, 40))) fields.color = 'Max 40 characters.'
  if (has('description') && !(b.description === null || str(b.description, 0, 600))) fields.description = 'Max 600 characters.'
  if (has('active') && typeof b.active !== 'boolean') fields.active = 'Invalid.'
  if (has('media') && !validMedia(b.media)) fields.media = 'Photos, 3D model or hotspots are invalid.'
  return fields
}

const pick = (b, keys) => Object.fromEntries(keys.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]))
const FIELDS = ['brand', 'name', 'category', 'price', 'stock', 'condition', 'sizes', 'color', 'description', 'active', 'media']

export const GET = route(async (request, sql) => {
  const [{ items }] = await sql`select api_admin_products(${requireSession(request)}) as items`
  return json({ items })
})

// { action: 'create' | 'update' (default) | 'delete', id?, ...fields }
export const POST = route(async (request, sql) => {
  const token = requireSession(request)
  const body = await readJson(request, 16_384)
  const action = body.action ?? 'update'

  if (action === 'delete') {
    if (typeof body.id !== 'string' || !ID.test(body.id)) throw new HttpError(400, 'invalid_input')
    const [{ data }] = await sql`select api_admin_product_delete(${token}, ${body.id}) as data`
    return json(data)
  }
  if (action !== 'create' && action !== 'update') throw new HttpError(400, 'invalid_input')
  if (action === 'update' && (typeof body.id !== 'string' || !ID.test(body.id))) throw new HttpError(400, 'invalid_input')

  const fields = validate(body, action === 'update')
  if (Object.keys(fields).length) throw new HttpError(400, 'invalid_input', { fields })
  const patch = { ...pick(body, FIELDS), ...(action === 'update' && { id: body.id }) }
  if (action === 'create') {
    const [{ data }] = await sql`select api_admin_product_create(${token}, ${sql.json(patch)}::jsonb) as data`
    return json(data, 201)
  }
  const [{ data }] = await sql`select api_admin_product_update(${token}, ${sql.json(patch)}::jsonb) as data`
  return json(data)
})
