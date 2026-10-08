let ready

// Database connected? Checked once per visit
const online = () =>
  (ready ??= fetch('/api/health')
    .then((r) => r.json())
    .then((d) => d.database === 'connected')
    .catch(() => false))

// Calls /api; `offline` means fall back to local mode
export async function api(path, { body, timeout = 8000 } = {}) {
  if (!(await online())) return { offline: true }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(`/api/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => null)
    if (!data || res.status === 404 || res.status >= 500) return { offline: true, status: res.status }
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { offline: true }
  } finally {
    clearTimeout(timer)
  }
}
