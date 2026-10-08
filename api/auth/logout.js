import { json, route } from '../_lib/http.js'
import { clearCookie, sessionHash } from '../_lib/auth.js'

export const POST = route(async (request, sql) => {
  const hash = sessionHash(request)
  if (hash) await sql`select api_session_delete(${hash})`
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() })
})
