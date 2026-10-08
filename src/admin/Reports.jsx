import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { Gate, PageHead, Status, useLoad, when } from './ui.jsx'

const TABS = [['', 'All'], ['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed']]
const TYPES = { order: 'Order', verification: 'Verification', product: 'Product', other: 'Other' }

function Detail({ r, onSaved }) {
  const [status, setStatus] = useState(r.status)
  const [note, setNote] = useState(r.admin_note ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const dirty = status !== r.status || note !== (r.admin_note ?? '')

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res = await api('admin/reports', { body: { id: r.id, status, note } })
    setBusy(false)
    if (!res.ok) return setMsg({ bad: true, text: 'Could not save. Try again.' })
    setMsg({ text: 'Saved. The customer sees this reply in their account.' })
    onSaved()
  }

  return (
    <article className="adm-card adm-detail" aria-label={`Report ${r.id}`}>
      <div className="adm-label">#{r.id} · {TYPES[r.type]}</div>
      <h2>{r.subject}</h2>
      <div className="adm-row"><Status value={r.status} /><span className="adm-muted">Opened {when(r.created_at)}</span></div>
      <dl className="adm-dl">
        <dt>From</dt><dd>{r.name ? `${r.name} · ` : ''}{r.email}</dd>
        {r.order_number && <><dt>Order</dt><dd><Link className="adm-link mono" to={`/admin/orders?number=${r.order_number}`}>{r.order_number}</Link></dd></>}
        {r.product_code && <><dt>Code</dt><dd className="mono">{r.product_code}</dd></>}
      </dl>
      <blockquote className="adm-quote">{r.message}</blockquote>

      <form className="adm-form" onSubmit={save}>
        <label>
          <span className="adm-label">Status</span>
          <select className="adm-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {TABS.slice(1).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          <span className="adm-label">Reply to customer</span>
          <textarea className="adm-input" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shown to the customer in their account" />
        </label>
        <div className="adm-row">
          <button className="adm-btn primary" disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save'}</button>
          {msg && <span className={msg.bad ? 'adm-err' : 'adm-muted'} role="status">{msg.text}</span>}
        </div>
      </form>
    </article>
  )
}

export default function Reports() {
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null)
  const state = useLoad(`admin/reports?status=${status}`)

  return (
    <>
      <PageHead title="Reports" sub="Customer support" />
      <div className="adm-tabs" role="tablist" aria-label="Report status">
        {TABS.map(([s, label]) => {
          const counts = state.data?.counts ?? {}
          const n = s ? counts[s] ?? 0 : Object.values(counts).reduce((a, b) => a + b, 0)
          return <button key={label} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}>{label} <span className="adm-count">{n}</span></button>
        })}
      </div>
      <Gate state={state}>
        {({ items }) => {
          const current = items.find((r) => r.id === selected) ?? items[0]
          return (
            <div className="adm-split">
              <ul className="adm-card flush adm-inbox">
                {items.map((r) => (
                  <li key={r.id}>
                    <button className={r.id === current?.id ? 'sel' : ''} onClick={() => setSelected(r.id)}>
                      <span className="adm-row"><Status value={r.status} /><span className="adm-muted">{TYPES[r.type]}</span><span className="adm-muted push">{when(r.created_at)}</span></span>
                      <b>{r.subject}</b>
                      <span className="adm-muted">{r.name ?? r.email}</span>
                    </button>
                  </li>
                ))}
                {!items.length && <li className="adm-empty">No reports here.</li>}
              </ul>
              {current && <Detail key={current.id + current.updated_at} r={current} onSaved={state.reload} />}
            </div>
          )
        }}
      </Gate>
    </>
  )
}
