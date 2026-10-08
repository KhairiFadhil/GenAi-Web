import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { Search, Truck } from '../components/Icons.jsx'
import ProductImage from '../components/ProductImage.jsx'
import { addToCart, findProduct, logout, rupiah, toast, useAccount, useCart } from '../store.js'
import { STAGES, trackOrder } from '../tracking.js'

const TOPICS = [
  ['order', 'Order problem'],
  ['verification', 'Verification / possible counterfeit'],
  ['product', 'Product question'],
  ['other', 'Something else'],
]
const STAGE_LABEL = Object.fromEntries(STAGES)
const REPORT_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }
const date = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTime = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const sizeLabel = (s) => (isNaN(s) ? `Size ${s}` : `EU ${s}`)

function ReportForm({ orders, preset, onDone }) {
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState({})

  const submit = async (e) => {
    e.preventDefault()
    const body = Object.fromEntries(new FormData(e.target))
    setBusy(true)
    const r = await api('account/reports', { body })
    setBusy(false)
    if (r.ok) {
      e.target.reset()
      setFields({})
      toast('Report sent. Our team will reply here.')
      return onDone()
    }
    setFields(r.data?.fields ?? { form: r.data?.reason === 'unknown_order' ? 'That order is not on this account.' : 'Could not send the report. Try again.' })
  }

  const err = (n) => fields[n] && <span className="field-error">{fields[n]}</span>
  return (
    <form className="stack report-form" onSubmit={submit}>
      <div className="form-row">
        <label>Topic
          <select name="type" defaultValue={preset.type ?? 'order'}>{TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          {err('type')}
        </label>
        <label>Order (optional)
          <select name="order_number" defaultValue={preset.order ?? ''}>
            <option value="">No specific order</option>
            {orders.map((o) => <option key={o.number} value={o.number}>{o.number} · {date(o.created_at)}</option>)}
          </select>
        </label>
      </div>
      <label>Product code (optional)
        <input name="product_code" defaultValue={preset.code ?? ''} maxLength={40} placeholder="e.g. ORI-NK-AF1-001" className="mono" />
        {err('product_code')}
      </label>
      <label>Subject<input name="subject" required minLength={3} maxLength={120} defaultValue={preset.subject ?? ''} />{err('subject')}</label>
      <label>Message<textarea name="message" required minLength={10} maxLength={2000} rows={4} placeholder="Tell us what happened" />{err('message')}</label>
      {fields.form && <p className="notice error" role="alert">{fields.form}</p>}
      <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
    </form>
  )
}

function Tracking({ t }) {
  return (
    <div className="tracking">
      <div className="tracking-head">
        {t.courier ? (
          <span><span className="label">Courier</span> {t.courier} · <span className="label">Waybill</span> <span className="mono">{t.waybill}</span></span>
        ) : <span className="label">Order progress</span>}
      </div>
      <ol className="timeline">
        {t.events.map((e, i) => (
          <li key={e.at + e.text} className={i === 0 ? 'now' : ''}>
            <span className="mono small">{dateTime(e.at)}</span>
            <span>{e.text}{e.place && <span className="small"> · {e.place}</span>}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function OrderCard({ order, onReport }) {
  const t = trackOrder(order)
  const [open, setOpen] = useState(false)
  const [, setCart] = useCart()
  const navigate = useNavigate()
  const items = order.items.map((i) => ({ ...i, product: findProduct(i.id) }))
  const canTrack = t.stage !== 'pending' && t.stage !== 'cancelled'

  const buyAgain = () => {
    const available = items.filter((i) => i.product && i.product.stock > 0)
    if (!available.length) return toast('These items are sold out right now')
    setCart((c) => available.reduce((acc, i) => Array.from({ length: i.qty }).reduce((a) => addToCart(a, i.id, i.size), acc), c))
    navigate('/cart')
  }

  const note =
    t.stage === 'delivered' ? `Delivered on ${date(t.deliveredAt)}`
    : t.stage === 'in_transit' ? `Estimated arrival ${date(t.eta)}`
    : t.stage === 'packing' ? 'Ships within 1 business day'
    : t.stage === 'pending' ? 'Waiting for payment confirmation'
    : 'This order was cancelled. Any payment is refunded.'

  return (
    <article className="ocard" data-stage={t.stage}>
      <header className="ocard-head">
        <div className="ocard-shop">
          <span className="shop-badge">ORI</span>
          <strong>ORI Official Store</strong>
          <span className="mono small">{order.number}</span>
        </div>
        <div className="ocard-status">
          {canTrack && <button className="ocard-track" onClick={() => setOpen((o) => !o)} aria-expanded={open}><Truck />{t.headline}</button>}
          <span className="ocard-stage">{STAGE_LABEL[t.stage]}</span>
        </div>
      </header>

      <ul className="ocard-items">
        {items.map((i) => (
          <li key={i.id + i.size}>
            <Link to={`/product/${i.id}`} className="ocard-thumb" tabIndex={-1} aria-hidden="true">
              {i.product ? <ProductImage product={i.product} /> : <div className="img" />}
            </Link>
            <div className="ocard-name">
              <Link to={`/product/${i.id}`}>{i.product?.name ?? i.id}</Link>
              <span className="small">{i.product?.brand} · {sizeLabel(i.size)}</span>
              <span className="small">×{i.qty}</span>
            </div>
            <span className="mono ocard-price">{rupiah(i.price)}</span>
          </li>
        ))}
      </ul>

      <div className="ocard-foot">
        <div className="ocard-total">Order total <b>{rupiah(order.total)}</b></div>
        <div className="ocard-actions">
          <span className="small">{note}</span>
          <div className="row">
            {(t.stage === 'delivered' || t.stage === 'cancelled') && <button className="btn primary" onClick={buyAgain}>Buy again</button>}
            {canTrack && <button className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Hide tracking' : 'Track order'}</button>}
            <button className="btn" onClick={() => onReport(order.number)}>Report a problem</button>
          </div>
        </div>
        {open && <Tracking t={t} />}
      </div>
    </article>
  )
}

export default function Account() {
  const account = useAccount()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [orders, setOrders] = useState(null)
  const [reports, setReports] = useState(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const preset = { type: params.get('report'), code: params.get('code'), order: params.get('order'), subject: params.get('subject') }
  const view = params.get('view') === 'support' || preset.type ? 'support' : 'orders'
  const tab = STAGES.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'all'
  const [showForm, setShowForm] = useState(!!preset.type)

  const load = async () => {
    const [o, r] = await Promise.all([api('account/orders'), api('account/reports')])
    if (!o.ok || !r.ok) return setFailed(true)
    setOrders(o.data.items)
    setReports(r.data.items)
  }
  useEffect(() => { if (account) load() }, [account?.email])
  useEffect(() => { if (preset.type) setShowForm(true) }, [preset.type, preset.order, preset.code])

  // Stage per order (from fulfilment data), counts per tab, then tab + search filter
  const staged = useMemo(() => (orders ?? []).map((o) => ({ o, stage: trackOrder(o).stage })), [orders])
  const counts = useMemo(() => staged.reduce((m, { stage }) => ({ ...m, [stage]: (m[stage] ?? 0) + 1 }), {}), [staged])
  const needle = q.trim().toLowerCase()
  const shown = staged.filter(({ o, stage }) =>
    (tab === 'all' || stage === tab) &&
    (!needle || o.number.toLowerCase().includes(needle) || o.items.some((i) => (findProduct(i.id)?.name ?? i.id).toLowerCase().includes(needle))))

  if (account === null) return <Navigate to={`/login?next=${encodeURIComponent('/account' + window.location.search)}`} replace />
  if (account === undefined) return <div className="page empty"><span className="label">Loading account…</span></div>

  const go = (next) => setParams(next, { replace: true })
  const report = (number) => go({ view: 'support', report: 'order', order: number })
  const signOut = async () => {
    await logout()
    navigate('/', { replace: true })
  }
  const openReports = (reports ?? []).filter((r) => r.status === 'open' || r.status === 'in_progress').length

  return (
    <div className="page account">
      <aside className="acc-side">
        <div className="acc-profile">
          <span className="avatar" aria-hidden="true">{account.name[0]}</span>
          <div>
            <strong>{account.name}</strong>
            <span className="small">{account.email}</span>
          </div>
        </div>
        <nav className="acc-nav" aria-label="Account">
          <button aria-current={view === 'orders'} onClick={() => go({})}>My orders <span className="count">{orders?.length ?? 0}</span></button>
          <button aria-current={view === 'support'} onClick={() => go({ view: 'support' })}>Support {openReports > 0 && <span className="count">{openReports}</span>}</button>
          <Link to="/wishlist">Wishlist</Link>
          {account.role === 'admin' && <Link to="/admin">Admin dashboard</Link>}
          <button onClick={signOut}>Log out</button>
        </nav>
      </aside>

      <section className="acc-main">
        {failed && <p className="notice error" role="alert">Could not load your account. Refresh to try again.</p>}

        {view === 'orders' ? (
          <>
            <div className="order-tabs" role="tablist" aria-label="Order status">
              {STAGES.map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => go(k === 'all' ? {} : { tab: k })}>
                  {label}{k !== 'all' && counts[k] ? <span> ({counts[k]})</span> : null}
                </button>
              ))}
            </div>
            <label className="order-search">
              <Search />
              <span className="sr-only">Search orders</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by order number or product name" />
            </label>
            {orders === null ? <p className="muted">Loading orders…</p> : shown.length === 0 ? (
              <div className="ocard-empty">
                <p>{orders.length === 0 ? 'No orders yet. Orders you place while signed in appear here.' : 'No orders match this filter.'}</p>
                <Link className="btn" to="/collection">Shop the collection</Link>
              </div>
            ) : shown.map(({ o }) => <OrderCard key={o.number} order={o} onReport={report} />)}
          </>
        ) : (
          <>
            <div className="section-head">
              <div><div className="label">Help & reports</div><h2>Support</h2></div>
              <button className="btn" onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>{showForm ? 'Close' : 'New report'}</button>
            </div>
            {showForm && orders && (
              <ReportForm key={params.toString()} orders={orders} preset={preset} onDone={() => (setShowForm(false), go({ view: 'support' }), load())} />
            )}
            {reports === null ? <p className="muted">Loading…</p> : reports.length === 0 ? (
              <div className="notice">No reports yet. Problem with an order, or a code that doesn't verify? Send us a report.</div>
            ) : (
              <ul className="acc-list">
                {reports.map((r) => (
                  <li key={r.id} className="acc-card">
                    <div className="acc-card-head">
                      <strong>{r.subject}</strong>
                      <span className="status" data-status={r.status}>{REPORT_LABEL[r.status]}</span>
                    </div>
                    <p className="small">{TOPICS.find(([v]) => v === r.type)?.[1]} · {date(r.created_at)}{r.order_number ? ` · ${r.order_number}` : ''}{r.product_code ? ` · ${r.product_code}` : ''}</p>
                    <p>{r.message}</p>
                    {r.admin_note && <div className="reply"><span className="label">ORI support</span><p>{r.admin_note}</p></div>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}
