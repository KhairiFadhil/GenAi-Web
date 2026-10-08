import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api.js'
import ProductImage from '../components/ProductImage.jsx'
import { findProduct, rupiah, toast, useOrder } from '../store.js'

// Simulated payment page. No gateway yet: "I've paid" confirms the order; card details never leave the browser.
const METHODS = [
  ['qris', 'QRIS', 'Scan with any banking or e-wallet app'],
  ['card', 'Card', 'Visa · Mastercard · JCB'],
  ['ewallet', 'E-wallet', 'GoPay · OVO · DANA · ShopeePay'],
  ['transfer', 'Bank transfer', 'Virtual account'],
]
const WALLETS = ['GoPay', 'OVO', 'DANA', 'ShopeePay']
const BANKS = [['BCA', '3901'], ['Mandiri', '8908'], ['BNI', '8241'], ['BRI', '2620']]
const LABEL = { qris: 'QRIS', card: 'Card', ewallet: 'E-wallet', transfer: 'Bank transfer' }
const DAY = 864e5

// Stable fake virtual account number per order + bank
const va = (number, prefix) => prefix + [...number].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1e12, 7).toString().padStart(12, '0')
const luhn = (n) => [...n].reverse().reduce((s, d, i) => s + (i % 2 ? ((d * 2) % 10) + Math.floor((d * 2) / 10) : +d), 0) % 10 === 0

function Countdown({ until }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, until - now)
  const h = Math.floor(left / 36e5), m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60
  return <span className="mono">{[h, m, s].map((n) => String(n).padStart(2, '0')).join(':')}</span>
}

function Copy({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" className="pay-copy" onClick={() => navigator.clipboard?.writeText(text).then(() => (setDone(true), setTimeout(() => setDone(false), 1400)))}>
      {done ? 'Copied ✓' : label}
    </button>
  )
}

function CardForm({ onValid }) {
  const [c, setC] = useState({ number: '', name: '', exp: '', cvc: '' })
  const digits = c.number.replace(/\D/g, '')
  const [mm, yy] = c.exp.split('/')
  const expOk = /^\d{2}\/\d{2}$/.test(c.exp) && +mm >= 1 && +mm <= 12 && new Date(2000 + +yy, +mm) > new Date()
  const ok = digits.length >= 15 && digits.length <= 16 && luhn(digits) && c.name.trim().length > 1 && expOk && /^\d{3,4}$/.test(c.cvc)
  useEffect(() => onValid(ok), [ok])
  const set = (k) => (e) => {
    let v = e.target.value
    if (k === 'number') v = v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
    if (k === 'exp') v = v.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2')
    if (k === 'cvc') v = v.replace(/\D/g, '').slice(0, 4)
    setC({ ...c, [k]: v })
  }
  return (
    <div className="pay-card">
      <div className="pay-cardface" aria-hidden="true">
        <span className="chip-shape" />
        <span className="mono num">{c.number || '•••• •••• •••• ••••'}</span>
        <span className="row-between"><span>{c.name.toUpperCase() || 'CARDHOLDER'}</span><span className="mono">{c.exp || 'MM/YY'}</span></span>
      </div>
      <div className="pay-fields">
        <label className="wide">Card number<input inputMode="numeric" autoComplete="off" value={c.number} onChange={set('number')} placeholder="4242 4242 4242 4242" /></label>
        <label className="wide">Name on card<input autoComplete="off" value={c.name} onChange={set('name')} placeholder="As printed on the card" /></label>
        <label>Expiry<input inputMode="numeric" autoComplete="off" value={c.exp} onChange={set('exp')} placeholder="MM/YY" /></label>
        <label>CVC<input inputMode="numeric" autoComplete="off" value={c.cvc} onChange={set('cvc')} placeholder="123" /></label>
      </div>
      <p className="small">Test card: 4242 4242 4242 4242, any future expiry, any CVC. Card details stay in your browser.</p>
    </div>
  )
}

export default function Pay() {
  const { number } = useParams()
  const navigate = useNavigate()
  const [stored, setOrder] = useOrder()
  const email = stored?.number === number ? stored.email : ''
  const [bill, setBill] = useState(null)
  const [error, setError] = useState(null)
  const [method, setMethod] = useState('qris')
  const [wallet, setWallet] = useState(WALLETS[0])
  const [bank, setBank] = useState(BANKS[0])
  const [cardOk, setCardOk] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api(`pay?number=${encodeURIComponent(number)}&email=${encodeURIComponent(email ?? '')}`).then((r) => {
      if (!r.ok) return setError(r.offline ? 'offline' : 'not_found')
      setBill(r.data)
      if (r.data.payment_method) setMethod(r.data.payment_method)
    })
  }, [number])

  if (error === 'not_found') {
    return (
      <div className="page empty">
        <h1>Order not found</h1>
        <p>Sign in with the account that placed it, or open the payment link right after checkout.</p>
        <Link className="btn primary" to="/account">My orders</Link>
      </div>
    )
  }
  if (error === 'offline') return <Navigate to="/order" replace />
  if (!bill) return <div className="page empty"><span className="label">Loading payment…</span></div>

  const finish = (paid) => {
    setOrder({
      number: paid.number, total: paid.total, name: paid.name, city: paid.city, email: paid.email,
      payment: LABEL[paid.payment_method], paidAt: paid.paid_at, createdAt: Date.parse(paid.created_at),
      items: paid.items.map((i) => ({ id: i.id, size: i.size, qty: i.qty, price: i.price })),
    })
    navigate('/order', { replace: true })
  }

  if (bill.status !== 'pending') {
    return (
      <div className="page empty">
        <p className="ok">✓ ALREADY PAID</p>
        <h1>{bill.number}</h1>
        <div className="row centered"><button className="btn primary" onClick={() => finish(bill)}>View invoice</button><Link className="btn" to="/account">My orders</Link></div>
      </div>
    )
  }

  const pay = async () => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 900)) // reads as a real processing step
    const r = await api('pay', { body: { number: bill.number, email, method } })
    setBusy(false)
    if (!r.ok) return toast(r.data?.reason === 'not_payable' ? 'This order is no longer awaiting payment' : 'Payment could not be confirmed. Try again.')
    finish(r.data)
  }

  const deadline = Date.parse(bill.created_at) + DAY
  const qrValue = `ORI-PAY|${bill.number}|${bill.total}|${method === 'ewallet' ? wallet : 'QRIS'}`
  const ready = method !== 'card' || cardOk

  return (
    <div className="page pay-page">
      <div className="page-head">
        <div><div className="label">Payment · {bill.number}</div><h1>Complete payment</h1></div>
        <div className="pay-timer"><span className="label">Pay within</span><Countdown until={deadline} /></div>
      </div>

      <div className="pay-layout">
        <section className="pay-main">
          <div className="pay-methods" role="tablist" aria-label="Payment method">
            {METHODS.map(([k, label, sub]) => (
              <button key={k} role="tab" aria-selected={method === k} onClick={() => setMethod(k)}>
                <strong>{label}</strong><span className="small">{sub}</span>
              </button>
            ))}
          </div>

          <div className="pay-panel" key={method}>
            {method === 'qris' && (
              <div className="pay-qr">
                <div className="qr-box"><QRCodeSVG value={qrValue} size={208} level="M" bgColor="#F5F5F5" fgColor="#0A0A0A" /><span className="qr-logo">ORI</span></div>
                <div>
                  <h3>Scan to pay {rupiah(bill.total)}</h3>
                  <ol className="pay-steps"><li>Open any banking or e-wallet app with QRIS.</li><li>Scan the code and check the amount.</li><li>Confirm, then tap <b>I've paid</b> below.</li></ol>
                </div>
              </div>
            )}
            {method === 'card' && <CardForm onValid={setCardOk} />}
            {method === 'ewallet' && (
              <div className="pay-qr">
                <div className="qr-box"><QRCodeSVG value={qrValue} size={208} level="M" bgColor="#F5F5F5" fgColor="#0A0A0A" /><span className="qr-logo">{wallet}</span></div>
                <div>
                  <div className="pay-pills" role="radiogroup" aria-label="E-wallet">
                    {WALLETS.map((w) => <button key={w} role="radio" aria-checked={wallet === w} onClick={() => setWallet(w)}>{w}</button>)}
                  </div>
                  <ol className="pay-steps"><li>Open {wallet} and choose Scan / Pay.</li><li>Scan the code, check {rupiah(bill.total)}.</li><li>Confirm with your PIN, then tap <b>I've paid</b>.</li></ol>
                </div>
              </div>
            )}
            {method === 'transfer' && (
              <div className="pay-va">
                <div className="pay-pills" role="radiogroup" aria-label="Bank">
                  {BANKS.map((b) => <button key={b[0]} role="radio" aria-checked={bank[0] === b[0]} onClick={() => setBank(b)}>{b[0]}</button>)}
                </div>
                <div className="va-box">
                  <span className="label">{bank[0]} virtual account</span>
                  <span className="mono va-num">{va(bill.number, bank[1]).replace(/(\d{4})(?=\d)/g, '$1 ')}</span>
                  <Copy text={va(bill.number, bank[1])} />
                </div>
                <div className="va-box"><span className="label">Amount</span><span className="mono va-num">{rupiah(bill.total)}</span><Copy text={String(bill.total)} /></div>
                <ol className="pay-steps"><li>Open {bank[0]} mobile banking or an ATM.</li><li>Choose Transfer → Virtual Account and enter the number above.</li><li>Pay the exact amount, then tap <b>I've paid</b>.</li></ol>
              </div>
            )}
          </div>

          <button className="btn primary pay-go" disabled={!ready || busy} onClick={pay}>
            {busy ? <span className="processing"><span className="spinner" /> Confirming payment</span> : method === 'card' ? `Pay ${rupiah(bill.total)}` : "I've paid"}
          </button>
          <p className="small pay-note">Simulated payment: no payment gateway is connected yet, so no money is charged.</p>
        </section>

        <aside className="summary pay-summary" aria-label="Order summary">
          <h2>Order</h2>
          <div className="sum-items">
            {bill.items.map((i) => {
              const p = findProduct(i.id)
              return (
                <div className="sum-item" key={i.id + i.size}>
                  {p ? <ProductImage product={p} /> : <div className="img" />}
                  <div>{i.name}<span className="small">{isNaN(i.size) ? `Size ${i.size}` : `EU ${i.size}`} · Qty {i.qty}</span></div>
                  <span className="mono">{rupiah(i.price * i.qty)}</span>
                </div>
              )
            })}
          </div>
          <div className="sum-row"><span>Subtotal</span><b>{rupiah(bill.subtotal)}</b></div>
          <div className="sum-row"><span>Shipping</span><b>{bill.shipping ? rupiah(bill.shipping) : 'Free'}</b></div>
          <div className="sum-row total"><span>Total</span><b>{rupiah(bill.total)}</b></div>
          <p className="small">Ship to {bill.name}, {bill.city}</p>
        </aside>
      </div>
    </div>
  )
}
