import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import ProductImage from '../components/ProductImage.jsx'
import { findProduct, rupiah, toast } from '../store.js'
import { Gate, PageHead, Status, useLoad, when } from './ui.jsx'
import './orders.css'

const TABS = [['', 'All'], ['pending', 'Pending'], ['paid', 'To ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']]
const PAY = { qris: 'QRIS', card: 'Card', ewallet: 'E-wallet', transfer: 'Bank transfer' }
const COURIERS = ['JNE REG', 'SiCepat REG', 'J&T Express', 'AnterAja', 'Pos Indonesia', 'SAP Express', 'Lalamove']
const STEPS = [['Placed', 'created_at'], ['Paid', 'paid_at'], ['Shipped', 'shipped_at'], ['Delivered', 'delivered_at']]
const REACHED = { pending: 0, paid: 1, shipped: 2, delivered: 3, cancelled: -1 }
const ERRORS = {
  invalid_transition: 'That status change is no longer possible. Refresh the order.',
  courier_required: 'Choose a courier and enter the waybill number.',
  not_in_transit: 'Tracking updates are only for shipped orders.',
}
const PAGE = 25

async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text)
    toast(`${what} copied`)
  } catch {
    toast('Could not copy')
  }
}

const CopyBtn = ({ text, what }) => (
  <button type="button" className="or-copy" onClick={(e) => (e.stopPropagation(), copy(text, what))} aria-label={`Copy ${what}`} title={`Copy ${what}`}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>
  </button>
)

const Avatar = ({ name }) => <span className="or-avatar" aria-hidden="true">{(name || '?').trim()[0]}</span>

function Thumbs({ ids = [] }) {
  const shown = ids.slice(0, 3)
  return (
    <span className="or-thumbs">
      {shown.map((id) => {
        const p = findProduct(id)
        return <span key={id} className="or-thumb">{p ? <ProductImage product={p} /> : <span className="img" />}</span>
      })}
      {ids.length > 3 && <span className="or-thumb more">+{ids.length - 3}</span>}
    </span>
  )
}

// POST helper shared by rows, bulk and drawer; returns true on success
async function post(path, body) {
  const r = await api(`admin/${path}`, { body })
  return r.ok ? { ok: true } : { ok: false, error: ERRORS[r.data?.reason] ?? 'Could not update the order.' }
}

function Stepper({ o }) {
  const reached = REACHED[o.status]
  const cancelled = o.status === 'cancelled'
  return (
    <ol className={`or-steps ${cancelled ? 'cancelled' : ''}`} style={{ '--progress': `${Math.max(reached, 0) / 3}` }}>
      {STEPS.map(([label, field], i) => (
        <li key={label} className={i <= reached ? 'done' : i === reached + 1 && !cancelled ? 'next' : ''}>
          <span className="dot" />
          <b>{label}</b>
          <span>{o[field] ? when(o[field]) : '—'}</span>
        </li>
      ))}
    </ol>
  )
}

function ConfirmCancel({ busy, onConfirm }) {
  const [asking, setAsking] = useState(false)
  if (!asking) return <button type="button" className="adm-btn danger" disabled={busy} onClick={() => setAsking(true)}>Cancel order</button>
  return (
    <span className="or-confirm" role="group" aria-label="Cancel and restock?">
      <span>Cancel and restock?</span>
      <button type="button" className="adm-btn danger solid" disabled={busy} onClick={onConfirm}>Yes, cancel</button>
      <button type="button" className="adm-btn" onClick={() => setAsking(false)}>Keep</button>
    </span>
  )
}

function Fulfilment({ o, busy, run }) {
  const [courier, setCourier] = useState(COURIERS[0])
  const [waybill, setWaybill] = useState('')
  const [update, setUpdate] = useState({ text: '', place: '' })
  const cancel = <ConfirmCancel busy={busy} onConfirm={() => run('orders', { status: 'cancelled' }, 'Order cancelled, items restocked')} />

  if (o.status === 'pending') {
    return (
      <section className="or-card or-action">
        <header><b>Awaiting payment</b><span className="adm-muted">{PAY[o.payment_method] ?? o.payment_method}</span></header>
        <div className="or-btns">
          <button className="adm-btn primary" disabled={busy} onClick={() => run('orders', { status: 'paid' }, 'Payment confirmed')}>Confirm payment</button>
          {cancel}
        </div>
      </section>
    )
  }
  if (o.status === 'paid') {
    return (
      <form className="or-card or-action" onSubmit={(e) => (e.preventDefault(), run('orders', { status: 'shipped', courier, waybill }, `Shipped with ${courier}`))}>
        <header><b>Ready to ship</b><span className="adm-muted">Hand it to a courier</span></header>
        <div className="or-fields">
          <label>Courier
            <select className="adm-input" value={courier} onChange={(e) => setCourier(e.target.value)}>
              {COURIERS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Waybill / resi
            <input className="adm-input mono" value={waybill} onChange={(e) => setWaybill(e.target.value.toUpperCase())} maxLength={40} placeholder="JN0123456789" required />
          </label>
        </div>
        <div className="or-btns">
          <button className="adm-btn primary" disabled={busy || !waybill.trim()}>Mark as shipped</button>
          {cancel}
        </div>
      </form>
    )
  }
  if (o.status === 'shipped') {
    return (
      <section className="or-card or-action">
        <header><b>In transit</b><span className="adm-muted">Post updates the customer will see</span></header>
        <form className="or-fields" onSubmit={(e) => (e.preventDefault(), run('order', { text: update.text, place: update.place }, 'Tracking update posted').then((ok) => ok && setUpdate({ text: '', place: '' })))}>
          <label>Tracking update
            <input className="adm-input" value={update.text} onChange={(e) => setUpdate({ ...update, text: e.target.value })} maxLength={200} placeholder="Arrived at destination hub" required />
          </label>
          <label>Location
            <input className="adm-input" value={update.place} onChange={(e) => setUpdate({ ...update, place: e.target.value })} maxLength={80} placeholder={o.city} />
          </label>
          <button className="adm-btn" disabled={busy || !update.text.trim()}>Post update</button>
        </form>
        <div className="or-btns">
          <button className="adm-btn primary" disabled={busy} onClick={() => run('orders', { status: 'delivered' }, 'Marked as delivered')}>Mark as delivered</button>
        </div>
      </section>
    )
  }
  return (
    <section className={`or-card or-final ${o.status}`}>
      <b>{o.status === 'delivered' ? 'Completed' : 'Cancelled'}</b>
      <span className="adm-muted">{o.status === 'delivered' ? `Delivered ${when(o.delivered_at)}` : `Cancelled ${when(o.cancelled_at ?? o.created_at)} · items returned to stock`}</span>
    </section>
  )
}

function Sheet({ number, onClose, onChanged }) {
  const state = useLoad(`admin/order?number=${encodeURIComponent(number)}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const run = async (path, body, done) => {
    setBusy(true)
    setError(null)
    const r = await post(path, { number, ...body })
    setBusy(false)
    if (!r.ok) {
      setError(r.error)
      return false
    }
    toast(done)
    state.reload()
    onChanged()
    return true
  }

  return (
    <div className="or-sheet-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="or-sheet" role="dialog" aria-modal="true" aria-label={`Order ${number}`}>
        <header className="or-sheet-head">
          <div>
            <div className="adm-label">Order</div>
            <div className="or-number"><h2 className="mono">{number}</h2><CopyBtn text={number} what="Order number" /></div>
          </div>
          <button className="or-x" onClick={onClose} aria-label="Close order details">×</button>
        </header>
        <Gate state={state}>
          {(o) => (
            <div className="or-sheet-body">
              <section className="or-card or-summary">
                <div>
                  <Status value={o.status} />
                  <span className="adm-muted">Placed {when(o.created_at)}</span>
                </div>
                <b className="or-total">{rupiah(o.total)}</b>
              </section>

              <section className="or-card"><Stepper o={o} /></section>
              <Fulfilment key={o.status} o={o} busy={busy} run={run} />
              {error && <p className="or-error" role="alert">{error}</p>}

              {o.courier && (
                <section className="or-card">
                  <h3 className="adm-label">Shipment</h3>
                  <dl className="or-kv">
                    <dt>Courier</dt><dd>{o.courier}</dd>
                    <dt>Waybill</dt><dd><span className="mono">{o.waybill}</span><CopyBtn text={o.waybill} what="Waybill" /></dd>
                    <dt>Shipped</dt><dd>{when(o.shipped_at)}</dd>
                    {o.delivered_at && <><dt>Delivered</dt><dd>{when(o.delivered_at)}</dd></>}
                  </dl>
                </section>
              )}

              <section className="or-card">
                <h3 className="adm-label">Items · {o.items.reduce((n, i) => n + i.qty, 0)}</h3>
                <ul className="or-items">
                  {o.items.map((i) => {
                    const p = findProduct(i.id)
                    return (
                      <li key={i.id + i.size}>
                        <span className="or-thumb lg">{p ? <ProductImage product={p} /> : <span className="img" />}</span>
                        <div className="or-item-name"><b>{i.name}</b><span className="adm-muted mono">{i.id} · size {i.size}</span></div>
                        <span className="or-item-price"><span className="adm-muted">{i.qty} ×</span> {rupiah(i.price)}</span>
                      </li>
                    )
                  })}
                </ul>
                <dl className="or-sum">
                  <dt>Subtotal</dt><dd>{rupiah(o.subtotal)}</dd>
                  <dt>Shipping</dt><dd>{o.shipping_fee ? rupiah(o.shipping_fee) : 'Free'}</dd>
                  <dt className="total">Total</dt><dd className="total">{rupiah(o.total)}</dd>
                </dl>
              </section>

              <section className="or-card">
                <h3 className="adm-label">Customer</h3>
                <div className="or-cust">
                  <Avatar name={o.customer_name} />
                  <div><b>{o.customer_name}</b><span className="adm-muted">{o.account ? 'Account' : 'Guest checkout'}</span></div>
                </div>
                <dl className="or-kv">
                  <dt>Email</dt><dd><span className="or-break">{o.email}</span><CopyBtn text={o.email} what="Email" /></dd>
                  {o.phone && <><dt>Phone</dt><dd>{o.phone}</dd></>}
                  <dt>Ship to</dt><dd><span className="or-break">{o.address}<br />{o.city} {o.postal_code}</span></dd>
                  <dt>Payment</dt><dd>{PAY[o.payment_method] ?? o.payment_method}</dd>
                  <dt>Reports</dt><dd>{o.reports ? `${o.reports} linked` : 'None'}</dd>
                </dl>
              </section>

              <section className="or-card">
                <h3 className="adm-label">Activity</h3>
                <form className="or-note" onSubmit={(e) => (e.preventDefault(), run('order', { text: note, internal: true }, 'Note added').then((ok) => ok && setNote('')))}>
                  <input className="adm-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Internal note (only admins see it)" aria-label="Internal note" />
                  <button className="adm-btn" disabled={busy || !note.trim()}>Add</button>
                </form>
                <ol className="or-log">
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
              </section>
            </div>
          )}
        </Gate>
      </aside>
    </div>
  )
}

// The one-click next step for a row; shipping needs the drawer (courier + waybill)
function NextAction({ o, open, reload }) {
  const [busy, setBusy] = useState(false)
  const go = async (status, done) => {
    setBusy(true)
    const r = await post('orders', { number: o.number, status })
    setBusy(false)
    toast(r.ok ? done : r.error)
    if (r.ok) reload()
  }
  const stop = (fn) => (e) => (e.stopPropagation(), fn())
  if (o.status === 'pending') return <button className="or-act" disabled={busy} onClick={stop(() => go('paid', `${o.number} marked paid`))}>Confirm payment</button>
  if (o.status === 'paid') return <button className="or-act primary" onClick={stop(open)}>Ship…</button>
  if (o.status === 'shipped') return <button className="or-act" disabled={busy} onClick={stop(() => go('delivered', `${o.number} delivered`))}>Mark delivered</button>
  return <button className="or-act ghost" onClick={stop(open)}>View</button>
}

export default function Orders() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const number = params.get('number')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [picked, setPicked] = useState(() => new Set())
  const [bulk, setBulk] = useState(null) // { done, total } while running
  useEffect(() => {
    const t = setTimeout(() => (setQuery(q.trim()), setPage(0)), 300)
    return () => clearTimeout(t)
  }, [q])

  const list = useLoad(`admin/orders?status=${status}&q=${encodeURIComponent(query)}&page=${page}`)
  const set = (k, v) => {
    const next = new URLSearchParams(params)
    v ? next.set(k, v) : next.delete(k)
    setParams(next, { replace: k !== 'number' })
  }
  const counts = list.data?.counts ?? {}
  const all = Object.values(counts).reduce((a, b) => a + b, 0)

  const togglePick = (n) => setPicked((s) => {
    const next = new Set(s)
    next.has(n) ? next.delete(n) : next.add(n)
    return next
  })

  // ponytail: one request per order, sequential; a bulk endpoint if this ever handles hundreds
  const confirmPicked = async () => {
    const numbers = [...picked]
    let ok = 0
    setBulk({ done: 0, total: numbers.length })
    for (const n of numbers) {
      if ((await post('orders', { number: n, status: 'paid' })).ok) ok++
      setBulk((b) => ({ ...b, done: b.done + 1 }))
    }
    setBulk(null)
    setPicked(new Set())
    toast(ok === numbers.length ? `${ok} payments confirmed` : `${ok} of ${numbers.length} confirmed`)
    list.reload()
  }

  return (
    <>
      <PageHead title="Orders" sub="Fulfilment">
        <div className="or-stats">
          <button onClick={() => set('status', 'pending')}><b>{counts.pending ?? 0}</b> awaiting payment</button>
          <button className={counts.paid ? 'warn' : ''} onClick={() => set('status', 'paid')}><b>{counts.paid ?? 0}</b> to ship</button>
          <button onClick={() => set('status', 'shipped')}><b>{counts.shipped ?? 0}</b> in transit</button>
        </div>
      </PageHead>

      <div className="or-toolbar">
        <label className="or-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
          <span className="sr-only">Search orders</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, name, email, city" />
        </label>
        <div className="or-seg" role="tablist" aria-label="Order status">
          {TABS.map(([s, label]) => (
            <button key={label} role="tab" aria-selected={status === s} onClick={() => (set('status', s), setPage(0), setPicked(new Set()))}>
              {label}<span className="adm-count">{s ? counts[s] ?? 0 : all}</span>
            </button>
          ))}
        </div>
      </div>

      {picked.size > 0 && (
        <div className="or-bulk" role="region" aria-label="Bulk actions">
          <span><b>{picked.size}</b> selected</span>
          <button className="adm-btn primary" disabled={!!bulk} onClick={confirmPicked}>
            {bulk ? `Confirming ${bulk.done}/${bulk.total}…` : 'Confirm payment'}
          </button>
          <button className="adm-btn" disabled={!!bulk} onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}

      <Gate state={list}>
        {({ items, total }) => (
          <section className="adm-card flush or-list" aria-label="Orders">
            <div className="or-row or-headrow" aria-hidden="true">
              <span /><span>Order</span><span>Customer</span><span>Items</span><span className="r">Total</span><span>Status</span><span />
            </div>
            {items.length === 0 && <p className="adm-empty or-none">No orders match.</p>}
            {items.map((o, i) => (
              <div key={o.number} className={`or-row ${o.number === number ? 'sel' : ''}`} style={{ '--i': Math.min(i, 12) }}
                onClick={() => set('number', o.number)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && set('number', o.number)}
                aria-label={`Order ${o.number}, ${o.customer_name}, ${o.status}`}>
                <span className="or-pick" onClick={(e) => e.stopPropagation()}>
                  {o.status === 'pending' && (
                    <input type="checkbox" checked={picked.has(o.number)} onChange={() => togglePick(o.number)} aria-label={`Select ${o.number}`} />
                  )}
                </span>
                <div className="or-id"><span className="mono">{o.number}</span><span className="adm-muted">{when(o.created_at)}</span></div>
                <div className="or-who">
                  <Avatar name={o.customer_name} />
                  <div><b>{o.customer_name}</b><span className="adm-muted">{o.city}</span></div>
                </div>
                <div className="or-what"><Thumbs ids={o.product_ids ?? []} /><span className="adm-muted">{o.item_count} item{o.item_count === 1 ? '' : 's'}</span></div>
                <div className="or-money r"><b className="mono">{rupiah(o.total)}</b><span className="or-pay">{PAY[o.payment_method] ?? o.payment_method}</span></div>
                <div className="or-state">
                  <Status value={o.status} />
                  {o.courier && <span className="adm-muted or-ship">{o.courier} · <span className="mono">{o.waybill}</span></span>}
                </div>
                <div className="or-next"><NextAction o={o} open={() => set('number', o.number)} reload={list.reload} /></div>
              </div>
            ))}
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

      {number && <Sheet key={number} number={number} onClose={() => set('number', '')} onChanged={list.reload} />}
    </>
  )
}
