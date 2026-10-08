import { HttpError, json, readJson, route } from './_lib/http.js'

// Log a check, return its history
export const POST = route(async (request, sql) => {
  const { code } = await readJson(request, 1024)
  if (typeof code !== 'string' || !code.trim() || code.length > 40) throw new HttpError(400, 'invalid_code')
  const [{ result }] = await sql`select api_verify(${code}) as result`
  return json(result)
})
