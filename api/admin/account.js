import { randomBytes } from 'node:crypto'
import { EMAIL, HttpError, json, readJson, route } from '../_lib/http.js'
import { hashPassword, requireSession } from '../_lib/auth.js'

const ROLES = ['customer', 'admin']

// One account with its orders and reports
export const GET = route(async (request, sql) => {
  const token = requireSession(request)
  const email = new URL(request.url).searchParams.get('email') ?? ''
  if (!email || email.length > 120) throw new HttpError(400, 'invalid_input')
  const [{ data }] = await sql`select api_admin_account(${token}, ${email}) as data`
  return json(data)
})

// { action: 'update', email, role?, name?, disabled? } | { action: 'password', email } | { action: 'create', email, name, role }
// password/create return a one-time temporary password for the admin to hand over
export const POST = route(async (request, sql) => {
  const token = requireSession(request)
  const body = await readJson(request, 2048)
  const { action, email } = body
  if (typeof email !== 'string' || email.length > 120 || !EMAIL.test(email.trim())) throw new HttpError(400, 'invalid_input')
  const temp = () => randomBytes(9).toString('base64url') // 12 chars

  if (action === 'update') {
    const { role, name, disabled } = body
    if (!(role === undefined || ROLES.includes(role)) || !(name === undefined || (typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 80)) ||
        !(disabled === undefined || typeof disabled === 'boolean')) throw new HttpError(400, 'invalid_input')
    const [{ data }] = await sql`select api_admin_account_update(${token}, ${sql.json({ email, role, name, disabled })}::jsonb) as data`
    return json(data)
  }
  if (action === 'password') {
    const password = temp()
    const [{ data }] = await sql`select api_admin_account_password(${token}, ${sql.json({ email, hash: await hashPassword(password) })}::jsonb) as data`
    return json({ ...data, temporary_password: password })
  }
  if (action === 'create') {
    const { name, role = 'customer' } = body
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80 || !ROLES.includes(role)) throw new HttpError(400, 'invalid_input')
    const password = temp()
    const [{ data }] = await sql`select api_admin_account_create(${token}, ${sql.json({ email, name, role, hash: await hashPassword(password) })}::jsonb) as data`
    if (data.error) throw new HttpError(409, 'email_taken')
    return json({ ...data, temporary_password: password }, 201)
  }
  throw new HttpError(400, 'invalid_input')
})

