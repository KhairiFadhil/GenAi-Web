import { json, route } from '../_lib/http.js'
import { clearCookie, publicAccount, sessionHash } from '../_lib/auth.js'

// Current account, or null when signed out / session expired
export const GET = route(async (request, sql) => {
  const hash = sessionHash(request)
  if (!hash) return json({ account: null })
  const [{ account }] = await sql`select api_session_get(${hash}) as account`
  return account ? json({ account: publicAccount(account) }) : json({ account: null }, 200, { 'set-cookie': clearCookie() })
})
