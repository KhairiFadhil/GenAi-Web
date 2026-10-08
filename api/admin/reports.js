import { HttpError, json, readJson, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']

// Support reports, open ones first
export const GET = route(async (request, sql) => {
  const token = requireSession(request)
  const s = new URL(request.url).searchParams.get('status')
  const [{ data }] = await sql`select api_admin_reports(${token}, ${STATUSES.includes(s) ? s : ''}) as data`
  return json(data)
})

// Change status and/or the reply note the customer sees
export const POST = route(async (request, sql) => {
  const token = requireSession(request)
  const body = await readJson(request, 4096)
  const { id, status, note } = body
  if (!Number.isInteger(id) || !(status === undefined || STATUSES.includes(status)) || !(note === undefined || (typeof note === 'string' && note.length <= 2000))) {
    throw new HttpError(400, 'invalid_input')
  }
  const patch = { id, ...(status && { status }), ...('note' in body && { note }) }
  const [{ data }] = await sql`select api_admin_report_update(${token}, ${sql.json(patch)}::jsonb) as data`
  return json(data)
})
