import { HttpError, json, readJson, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

// One support conversation (marks admin replies as read)
export const GET = route(async (request, sql) => {
  const token = requireSession(request)
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'invalid_input')
  const [{ data }] = await sql`select api_report_thread(${token}, ${id}) as data`
  return json(data)
})

// Customer message; reopens a resolved/closed report
export const POST = route(async (request, sql) => {
  const token = requireSession(request)
  const { id, body } = await readJson(request, 4096)
  if (!Number.isInteger(id) || typeof body !== 'string' || !body.trim() || body.length > 2000) throw new HttpError(400, 'invalid_input')
  const [{ data }] = await sql`select api_report_message(${token}, ${sql.json({ id, body })}::jsonb) as data`
  return json(data, 201)
})
