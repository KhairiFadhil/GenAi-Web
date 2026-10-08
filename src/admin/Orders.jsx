import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { rupiah, toast } from '../store.js'
import { Gate, PageHead, Status, useLoad, when } from './ui.jsx'

const TABS = [['', 'All'], ['pending', 'Pending'], ['paid', 'To ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']]
const PAY = { card: 'Card', ewallet: 'E-wallet', transfer: 'Bank transfer' }
const COURIERS = ['JNE REG', 'SiCepat REG', 'J&T Express', 'AnterAja', 'Pos Indonesia', 'SAP Express', 'Lalamove']
const STEPS = [['placed', 'Placed', 'created_at'], ['paid', 'Paid', 'paid_at'], ['shipped', 'Shipped', 'shipped_at'], ['delivered', 'Delivered', 'delivered_at']]
const REACHED = { pending: 0, paid: 1, shipped: 2, delivered: 3, cancelled: -1 }
const ERRORS = {
  invalid_transition: 'That status change is no longer possible. Refresh the order.',
  courier_required: 'Choose a courier and enter the waybill number.',
  not_in_transit: 'Tracking updates are only for shipped orders.',
}
const PAGE = 25

function Stepper({ o }) {
  const reached = REACHED[o.status]
  return (
    <ol className={`ful-steps ${o.status === 'cancelled' ? 'cancelled' : ''}`}>
      {STEPS.map(([key, label, field], i) => (
        <li key={key} className={i <= reached ? 'done' : i === reached + 1 && o.status !== 'cancelled' ? 'next' : ''}>
          <span className="dot" />
          <span className="ful-step-label">{label}</span>
          <span className="adm-muted">{o[field] ? when(o[field]) : ''}</span>
        </li>
      ))}
      {o.status === 'cancelled' && (
        <li className="done bad"><span className="dot" /><span className="ful-step-label">Cancelled</span><span className="adm-muted">{when(o.cancelled_at ?? o.created_at)}</span></li>
      )}
    </ol>
  )
}

// One button that asks for confirmation inline before doing something destructive
function ConfirmButton({ label, confirm, onConfirm, disabled }) {
  const [asking, setAsking] = useState(false)
  if (!asking) return <button type="button" className="adm-btn danger" disabled={disabled} onClick={() => setAsking(true)}>{label}</button>
  return (
    <span className="ful-confirm" role="group" aria-label={confirm}>
      <span>{confirm}</span>
      <button type="button" className="adm-btn danger solid" disabled={disabled} onClick={onConfirm}>Yes, cancel</button>
      <button type="button" className="adm-btn" onClick={() => setAsking(false)}>Keep</button>
    </span>
  )
}

function Fulfilment({ o, busy, run }) {
  const [courier, setCourier] = useState(COURIERS[0])
  const [waybill, setWaybill] = useState('')
  const [update, setUpdate] = useState({ text: '', place: '' })
  const cancel = <ConfirmButton label="Cancel order" confirm="Cancel and restock?" disabled={busy} onConfirm={() => run('orders', { status: 'cancelled' }, 'Order cancelled, items restocked')} />

  if (o.status === 'pending') {
    return (
      <div className="ful-panel">
        <p className="adm-muted">Waiting for the customer's payment ({PAY[o.payment_method] ?? o.payment_method}).</p>
        <div className="adm-actions">
          <button className="adm-btn primary" disabled={busy} onClick={() => run('orders', { status: 'paid' }, 'Payment confirmed')}>Confirm payment</button>
          {cancel}
        </div>
      </div>
    )
  }
  if (o.status === 'paid') {
    return (
      <form className="ful-panel" onSubmit={(e) => (e.preventDefault(), run('orders', { status: 'shipped', courier, waybill }, `Shipped with ${courier}`))}>
        <div className="adm-label">Ship this order</div>
        <div className="ful-grid">
          <label>Courier
            <select className="adm-input" value={courier} onChange={(e) => setCourier(e.target.value)}>
              {COURIERS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Waybill / resi
            <input className="adm-input mono" value={waybill} onChange={(e) => setWaybill(e.target.value.toUpperCase())} maxLength={40} placeholder="e.g. JN0123456789" required />
          </label>
        </div>
        <div className="adm-actions">
          <button className="adm-btn primary" disabled={busy || !waybill.trim()}>Mark as shipped</button>
          {cancel}
        </div>
      </form>
    )
  }
  if (o.status === 'shipped') {
    return (
      <div className="ful-panel">
        <div className="ful-courier"><span className="adm-label">Courier</span> {o.courier} <span className="adm-label">Waybill</span> <span className="mono">{o.waybill}</span></div>
        <form className="ful-grid" onSubmit={(e) => (e.preventDefault(), run('order', { text: update.text, place: update.place }, 'Tracking update posted').then((ok) => ok && setUpdate({ text: '', place: '' })))}>
          <label>Tracking update
            <input className="adm-input" value={update.text} onChange={(e) => setUpdate({ ...update, text: e.target.value })} maxLength={200} placeholder="e.g. Arrived at destination hub" required />
          </label>
          <label>Location
            <input className="adm-input" value={update.place} onChange={(e) => setUpdate({ ...update, place: e.target.value })} maxLength={80} placeholder={o.city} />
          </label>
          <button className="adm-btn" disabled={busy || !update.text.trim()}>Post update</button>
        </form>
        <div className="adm-actions">
          <button className="adm-btn primary" disabled={busy} onClick={() => run('orders', { status: 'delivered' }, 'Marked as delivered')}>Mark as delivered</button>
        </div>
      </div>
    )
  }
  return (
    <div className="ful-panel ful-final">
      {o.status === 'delivered'
        ? <>Delivered {when(o.delivered_at)} via {o.courier} · <span className="mono">{o.waybill}</span></>
        : <>Cancelled {when(o.cancelled_at ?? o.created_at)}. Items were returned to stock.</>}
    </div>
  )
}

function Drawer({ number, onClose, onChanged }) {
  const state = useLoad(`admin/order?number=${encodeURIComponent(number)}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // POST to admin/orders (status) or admin/order (event); returns true on success
  const run = async (path, body, done) => {
    setBusy(true)
    setError(null)
    const r = await api(`admin/${path}`, { body: { number, ...body } })
    setBusy(false)
    if (!r.ok) {
      setError(ERRORS[r.data?.reason] ?? 'Could not update the order.')
      return false
    }
    toast(done)
    state.reload()
    onChanged()
    return true
  }

  return (
    <div className="adm-drawer-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="adm-drawer ful-drawer" role="dialog" aria-modal="true" aria-label={`Order ${number}`}>
        <div className="adm-card-head">
          <h2 className="mono">{number}</h2>
          <button className="ful-x" onClick={onClose} aria-label="Close order details">×</button>
        </div>
        <Gate state={state}>
          {(o) => (
            <>
              <div className="adm-row"><Status value={o.status} /><span className="adm-muted">Placed {when(o.created_at)} · {rupiah(o.total)}</span></div>
              <Stepper o={o} />
              <Fulfilment key={o.status} o={o} busy={busy} run={run} />
              {error && <p className="ful-error" role="alert">{error}</p>}

              <h3 className="adm-label">Items</h3>
              <table className="adm-table">
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.id + i.size}>
                      <td>{i.name}<div className="adm-muted mono">{i.id} · size {i.size}</div></td>
                      <td className="num">{i.qty} × {rupiah(i.price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td>Shipping</td><td className="num">{o.shipping_fee ? rupiah(o.shipping_fee) : 'Free'}</td></tr>
                  <tr className="total"><td>Total</td><td className="num">{rupiah(o.total)}</td></tr>
                </tfoot>
              </table>

              <h3 className="adm-label">Customer</h3>
              <dl className="adm-dl">
                <dt>Name</dt><dd>{o.customer_name}</dd>
                <dt>Email</dt><dd>{o.email}</dd>
                {o.phone && <><dt>Phone</dt><dd>{o.phone}</dd></>}
                <dt>Account</dt><dd>{o.account ?? 'Guest checkout'}</dd>
                <dt>Ship to</dt><dd>{o.address}<br />{o.city} {o.postal_code}</dd>
                <dt>Payment</dt><dd>{PAY[o.payment_method] ?? o.payment_method}</dd>
                <dt>Reports</dt><dd>{o.reports ? `${o.reports} linked report${o.reports > 1 ? 's' : ''}` : 'None'}</dd>
              </dl>

              <h3 className="adm-label">Activity</h3>
              <form className="ful-note" onSubmit={(e) => (e.preventDefault(), run('order', { text: note, internal: true }, 'Note added').then((ok) => ok && setNote('')))}>
                <input className="adm-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Add an internal note (only admins see it)" />
                <button className="adm-btn" disabled={busy || !note.trim()}>Add</button>
              </form>
              <ol className="ful-log">
                {[...o.events].reverse().map((e) => (
                  <li key={e.id} className={`k-${e.kind} ${e.internal ? 'internal' : ''}`}>
                    <span className="dot" />
                    <div>
                      <div>{e.text}{e.place && <span className="adm-muted"> · {e.place}</span>}</div>
                      <div className="adm-muted">{when(e.at)}{e.internal ? ' · internal note' : ''}</div>
                    </div>
                  </li>
                ))}
                <li className="k-placed"><span className="dot" /><div><div>Order placed</div><div className="adm-muted">{when(o.created_at)}</div></div></li>
              </ol>
            </>
          )}
        </Gate>
      </aside>
    </div>
  )
}

export default function Orders() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const number = params.get('number')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => (setQuery(q.trim()), setPage(0)), 300)
    return () => clearTimeout(t)
  }, [q])

  const list = useLoad(`admin/orders?status=${status}&q=${encodeURIComponent(query)}&page=${page}`)
  const set = (k, v) => {
    const next = new URLSearchParams(params)
    v ? next.set(k, v) : next.delete(k)
    setParams(next, { replace: k === 'number' ? false : true })
  }

  return (
    <>
      <PageHead title="Orders" sub="Fulfilment">
        <label className="adm-search">
          <span className="sr-only">Search orders</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, name, email, city" />
        </label>
      </PageHead>

      <div className="adm-tabs" role="tablist" aria-label="Order status">
        {TABS.map(([s, label]) => {
          const counts = list.data?.counts ?? {}
          const n = s ? counts[s] ?? 0 : Object.values(counts).reduce((a, b) => a + b, 0)
          return (
            <button key={label} role="tab" aria-selected={status === s} onClick={() => (set('status', s), setPage(0))}>
              {label} <span className="adm-count">{n}</span>
            </button>
          )
        })}
      </div>

      <Gate state={list}>
        {({ items, total }) => (
          <section className="adm-card flush">
            <div className="adm-scroll">
              <table className="adm-table hover">
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>City</th><th className="num">Items</th><th className="num">Total</th><th>Payment</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {items.map((o) => (
                    <tr key={o.number} onClick={() => set('number', o.number)} className={o.number === number ? 'sel' : ''}>
                      <td><button className="adm-link mono" onClick={(e) => (e.stopPropagation(), set('number', o.number))}>{o.number}</button><div className="adm-muted">{when(o.created_at)}</div></td>
                      <td>{o.customer_name}<div className="adm-muted">{o.email}</div></td>
                      <td>{o.city}</td>
                      <td className="num">{o.item_count}</td>
                      <td className="num">{rupiah(o.total)}</td>
                      <td>{PAY[o.payment_method] ?? o.payment_method}</td>
                      <td><Status value={o.status} /></td>
                    </tr>
                  ))}
                  {!items.length && <tr><td colSpan={7} className="adm-empty">No orders match.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="adm-pager">
              <span className="adm-muted">{total ? `${page * PAGE + 1}–${Math.min(total, (page + 1) * PAGE)} of ${total}` : '0 orders'}{list.loading ? ' · updating…' : ''}</span>
              <div className="adm-row">
                <button className="adm-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
                <button className="adm-btn" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>Next →</button>
              </div>
            </div>
          </section>
        )}
      </Gate>

      {number && <Drawer key={number} number={number} onClose={() => set('number', '')} onChanged={list.reload} />}
    </>
  )
}
