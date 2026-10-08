import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { rupiah, toast } from '../store.js'
import { ago } from './ago.js'
import { Gate, PageHead, Status, useLoad, when } from './ui.jsx'
import './support.css'

const STATUSES = [['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed']]
const TABS = [['', 'All'], ...STATUSES]
const TYPES = { order: 'Order', verification: 'Verification', product: 'Product', other: 'Other' }
const EMAIL_STATE = { sent: 'Emailed ✓', queued: 'Email queued', sending: 'Sending email…', failed: 'Email failed' }
const TEMPLATES = [
  ['Looking into it', "Thanks for reaching out. We're looking into this now and will update you within 24 hours."],
  ['Need a photo', 'Could you reply with a clear photo of the box label and the size tag? That helps us verify it quickly.'],
  ['Resolved', 'Good news: this is sorted on our side. Let us know if anything else comes up.'],
]

function Composer({ t, onSent }) {
  const [body, setBody] = useState('')
  const [after, setAfter] = useState('in_progress')
  const [busy, setBusy] = useState(null) // which button is sending
  const [error, setError] = useState(null)
  const ref = useRef()

  const send = async (status) => {
    if (!body.trim()) return ref.current.focus()
    setBusy(status)
    setError(null)
    const r = await api('admin/thread', { body: { id: t.id, body: body.trim(), ...(status !== 'keep' && { status }) } })
    setBusy(null)
    if (!r.ok) return setError(r.offline ? 'The database is not reachable.' : 'Could not send. Try again.')
    setBody('')
    toast(r.data.email === 'sent' ? `Reply emailed to ${t.email}` : t.mail ? 'Reply saved, email is on its way' : 'Reply saved, email queued until SMTP is set')
    onSent()
  }

  return (
    <form className="sp-composer" onSubmit={(e) => (e.preventDefault(), send(after))}>
      <div className="sp-mailhead">
        <span><b>To</b> {t.email}</span>
        <span className="sp-subject"><b>Subject</b> Re: {t.subject} [ORI support #{t.id}]</span>
      </div>
      <div className="sp-templates" aria-label="Quick replies">
        {TEMPLATES.map(([label, text]) => (
          <button type="button" key={label} onClick={() => (setBody(text), ref.current.focus())}>{label}</button>
        ))}
      </div>
      <label className="sr-only" htmlFor="sp-reply">Reply</label>
      <textarea id="sp-reply" ref={ref} className="sp-textarea" rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply. It's saved on the ticket and emailed to the customer." />
      {error && <p className="sp-error" role="alert">{error}</p>}
      <div className="sp-compose-foot">
        <label className="sp-after">
          <span>Then</span>
          <select value={after} onChange={(e) => setAfter(e.target.value)}>
            <option value="keep">Keep status</option>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>Mark {l.toLowerCase()}</option>)}
          </select>
        </label>
        <div className="adm-row">
          <button type="button" className="sp-btn" disabled={!!busy || !body.trim()} onClick={() => send('resolved')}>
            {busy === 'resolved' ? <span className="sp-spin" /> : null} Send & resolve
          </button>
          <button className="sp-btn primary" disabled={!!busy || !body.trim()}>
            {busy && busy !== 'resolved' ? <span className="sp-spin" /> : null} Send reply
          </button>
        </div>
      </div>
    </form>
  )
}

function Ticket({ id, onBack, onChanged }) {
  const state = useLoad(`admin/thread?id=${id}`)
  const [saving, setSaving] = useState(false)
  const seen = useRef(false)

  // Opening marks it read: refresh the list once so the "new" dot clears
  useEffect(() => {
    if (state.data && !seen.current) {
      seen.current = true
      onChanged()
    }
  }, [state.data])

  const setStatus = async (status) => {
    setSaving(true)
    const r = await api('admin/reports', { body: { id, status } })
    setSaving(false)
    if (!r.ok) return toast('Could not change the status')
    toast(`Ticket #${id} marked ${status.replace('_', ' ')}`)
    state.reload()
    onChanged()
  }

  return (
    <section className="sp-ticket" aria-label={`Ticket ${id}`}>
      <button className="sp-back" onClick={onBack}>← All tickets</button>
      <Gate state={state}>
        {(t) => (
          <>
            <header className="sp-ticket-head">
              <div className="adm-label">#{t.id} · {TYPES[t.type]} · opened {when(t.created_at)}</div>
              <h2>{t.subject}</h2>
              <div className="sp-meta">
                <span className="sp-who">
                  <b>{t.customer?.name ?? t.email}</b>
                  <span className="adm-muted">{t.email}{t.customer ? ` · ${t.customer.orders} orders` : ' · guest'}{t.customer?.disabled ? ' · disabled' : ''}</span>
                </span>
                <label className="sp-status">
                  <span className="sr-only">Status</span>
                  <select value={t.status} disabled={saving} onChange={(e) => setStatus(e.target.value)} data-status={t.status}>
                    {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              </div>
              {(t.order || t.product_code) && (
                <div className="sp-chips">
                  {t.order && (
                    <Link className="sp-chip" to={`/admin/orders?number=${t.order.number}`}>
                      Order <span className="mono">{t.order.number}</span> · {t.order.status} · {rupiah(t.order.total)}
                    </Link>
                  )}
                  {t.product_code && <Link className="sp-chip" to={`/verify/${encodeURIComponent(t.product_code)}`} target="_blank" rel="noreferrer">Code <span className="mono">{t.product_code}</span></Link>}
                </div>
              )}
            </header>

            {!t.mail && <p className="sp-banner">SMTP not configured. Replies are saved and emailed once SMTP is set.</p>}

            <ol className="sp-history">
              {t.messages.map((m, i) => (
                <li key={m.id} className={`sp-msg is-${m.author}`} style={{ '--i': Math.min(i, 8) }}>
                  <div className="sp-msg-head">
                    <b>{m.author === 'admin' ? `${m.author_name ?? 'ORI'} · Support` : m.author_name ?? t.email}</b>
                    <span className="adm-muted">{when(m.at)}</span>
                  </div>
                  <p>{m.body}</p>
                  {m.author === 'admin' && (
                    <span className={`sp-mail ${m.email ?? 'none'}`}>{m.email ? EMAIL_STATE[m.email] : 'Not emailed'}</span>
                  )}
                </li>
              ))}
            </ol>

            <Composer t={t} onSent={() => (state.reload(), onChanged())} />
          </>
        )}
      </Gate>
    </section>
  )
}

export default function Reports() {
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const id = Number(params.get('id')) || null
  const list = useLoad(`admin/reports?status=${status}`)
  const open = (v) => setParams(v ? { id: String(v) } : {}, { replace: !v })

  const counts = list.data?.counts ?? {}
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const unread = (list.data?.items ?? []).filter((r) => r.unread > 0).length

  return (
    <>
      <PageHead title="Reports" sub="Support tickets · replies go out by email">
        <div className="sp-summary">
          <span><b>{(counts.open ?? 0) + (counts.in_progress ?? 0)}</b> open</span>
          <span className={unread ? 'warn' : ''}><b>{unread}</b> new</span>
          <span><b>{total}</b> total</span>
        </div>
      </PageHead>

      <div className={`sp-split ${id ? 'has-sel' : ''}`}>
        <section className="sp-list" aria-label="Tickets">
          <div className="sp-tools">
            <label className="sp-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
              <span className="sr-only">Search tickets</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subject, customer, order" />
            </label>
            <div className="sp-seg" role="tablist" aria-label="Ticket status">
              {TABS.map(([s, label]) => (
                <button key={label} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}>
                  {label}<span className="adm-count">{s ? counts[s] ?? 0 : total}</span>
                </button>
              ))}
            </div>
          </div>
          <Gate state={list}>
            {({ items }) => {
              const needle = q.trim().toLowerCase()
              const shown = items.filter((r) => !needle || `${r.subject} ${r.name ?? ''} ${r.email} ${r.order_number ?? ''} ${r.product_code ?? ''}`.toLowerCase().includes(needle))
              return (
                <ul className="sp-tickets">
                  {shown.map((r, i) => (
                    <li key={r.id} style={{ '--i': Math.min(i, 10) }}>
                      <button className={`${r.id === id ? 'sel' : ''} ${r.unread > 0 ? 'unread' : ''}`} onClick={() => open(r.id)} aria-current={r.id === id}>
                        <span className="sp-row1">
                          {r.unread > 0 && <span className="sp-dot" aria-label="New activity" />}
                          <b className="sp-subj">{r.subject}</b>
                          <span className="adm-muted sp-time">{ago(r.last_at)}</span>
                        </span>
                        <span className="sp-row2">
                          <Status value={r.status} />
                          <span className="adm-muted">{TYPES[r.type]} · {r.name ?? r.email}</span>
                        </span>
                        {r.last && <span className="sp-preview adm-muted">{r.last.author === 'admin' ? 'You: ' : ''}{r.last.body}</span>}
                      </button>
                    </li>
                  ))}
                  {!shown.length && <li className="adm-empty sp-none">No tickets here.</li>}
                </ul>
              )
            }}
          </Gate>
        </section>

        {id ? (
          <Ticket key={id} id={id} onBack={() => open(null)} onChanged={list.reload} />
        ) : (
          <section className="sp-ticket sp-placeholder"><p className="adm-muted">Select a ticket to read and reply.</p></section>
        )}
      </div>
    </>
  )
}
