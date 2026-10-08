import { EMAIL, HttpError, readJson, route } from '../_lib/http.js'
import { PASSWORD, hashPassword, startSession } from '../_lib/auth.js'

// Customer sign-up; admins are created with `npm run db:admin`
export const POST = route(async (request, sql) => {
  const { name, email, password } = await readJson(request, 2048)
  const fields = {}
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) fields.name = 'Enter your name.'
  if (typeof email !== 'string' || email.length > 120 || !EMAIL.test(email.trim())) fields.email = 'Enter a valid email address.'
  if (typeof password !== 'string' || password.length < PASSWORD.min || password.length > PASSWORD.max) fields.password = `Use at least ${PASSWORD.min} characters.`
  if (Object.keys(fields).length) throw new HttpError(400, 'invalid_input', { fields })
  const hash = await hashPassword(password)
  const [{ account }] = await sql`select api_auth_register(${sql.json({ name, email, hash })}::jsonb) as account`
  if (account.error) throw new HttpError(409, 'email_taken', { fields: { email: 'An account with this email already exists.' } })
  return startSession(sql, account, 201)
})
