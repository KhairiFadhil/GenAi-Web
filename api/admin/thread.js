import { HttpError, json, readJson, route } from '../_lib/http.js'
import { requireSession } from '../_lib/auth.js'
import { flushOutbox, mailConfigured, siteUrl } from '../_lib/mail.js'

const STATUSES = ['open', 'in_progress', 'resolved', 'closed']

// Conversation with customer + linked order context (marks it read for admins)
export const GET = route(async (request, sql) => {
  const token = requireSession(request)
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'invalid_input')
  const [{ data }] = await sql`select api_admin_report_thread(${token}, ${id}) as data`
  return json({ ...data, mail: mailConfigured() })
})

// Admin reply: stored in the thread and queued as an email to the customer
export const POST = route(async (request, sql) => {
  const token = requireSession(request)
  const { id, body, status, email = true } = await readJson(request, 4096)
  if (!Number.isInteger(id) || typeof body !== 'string' || !body.trim() || body.length > 2000 ||
      !(status === undefined || STATUSES.includes(status)) || typeof email !== 'boolean') {
    throw new HttpError(400, 'invalid_input')
  }
  const link = `${siteUrl()}/account?view=support&thread=${id}`
  const [{ data }] = await sql`select api_admin_report_message(${token}, ${sql.json({ id, body, status, email, link })}::jsonb) as data`
  if (email) await flushOutbox(sql).catch(() => {}) // never fail the reply because SMTP hiccuped
  return json(data, 201)
})
