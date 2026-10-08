import { EMAIL, HttpError, json, readJson, route } from './_lib/http.js'

export const POST = route(async (request, sql) => {
  const { email, website } = await readJson(request, 1024)
  if (website) return json({ subscribed: true }) // honeypot field, bots only
  if (typeof email !== 'string' || email.length > 120 || !EMAIL.test(email.trim())) throw new HttpError(400, 'invalid_email')
  const [{ result }] = await sql`select api_subscribe(${email}) as result`
  return json(result, result.new ? 201 : 200)
})
