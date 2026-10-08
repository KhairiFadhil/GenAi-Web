import { HttpError, readJson, route } from '../_lib/http.js'
import { PASSWORD, startSession, verifyPassword } from '../_lib/auth.js'

const MAX_FAILURES = 5 // per email per 15 minutes

export const POST = route(async (request, sql) => {
  const { email, password } = await readJson(request, 2048)
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 120 || password.length > PASSWORD.max) {
    throw new HttpError(400, 'invalid_input')
  }
  const [{ r }] = await sql`select api_auth_lookup(${email}) as r`
  if (r.failures >= MAX_FAILURES) throw new HttpError(429, 'too_many_attempts')
  const ok = await verifyPassword(password, r.account?.hash) // unknown email still pays the hashing cost
  await sql`select api_auth_attempt(${email}, ${ok})`
  if (!ok) throw new HttpError(401, 'invalid_credentials')
  return startSession(sql, r.account)
})
