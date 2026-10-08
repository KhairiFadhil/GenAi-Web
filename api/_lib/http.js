import { db } from './db.js'

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code)
    this.status = status
    this.extra = extra
  }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })

// Small JSON object bodies only
export async function readJson(request, limit = 8192) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'json_required')
  const text = await request.text()
  if (text.length > limit) throw new HttpError(413, 'too_large')
  try {
    const data = JSON.parse(text)
    if (data && typeof data === 'object' && !Array.isArray(data)) return data
  } catch {}
  throw new HttpError(400, 'bad_json')
}

// Postgres codes caused by bad input
const BAD_INPUT = new Set(['22023', '22P02', '23514', '23502', '22001'])

// Wraps a handler: database check and error mapping
export const route = (fn) => async (request) => {
  const sql = db()
  if (!sql) return json({ error: 'not_configured' }, 503)
  try {
    return await fn(request, sql)
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status)
    if (BAD_INPUT.has(e.code)) return json({ error: 'invalid_input', reason: e.code === '22023' ? e.message : undefined }, 400)
    if (e.code === '28000') return json({ error: 'unauthorized' }, 401) // no valid session
    if (e.code === '42501') return json({ error: 'forbidden' }, 403) // not an admin
    if (e.code === 'P0002') return json({ error: 'not_found' }, 404)
    console.error(e)
    return json({ error: 'server_error' }, 500)
  }
}
