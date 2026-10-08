import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { applyInventory, cartTotal, findProduct, orderNumber, useCart, useOrder } from '../store.js'
import { OrderSummary } from './Cart.jsx'

const PAYMENTS = [
  ['card', 'Credit or debit card', 'Visa · Mastercard'],
  ['ewallet', 'E-wallet', 'GoPay · OVO · DANA'],
  ['transfer', 'Bank transfer', 'Virtual account'],
]
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export default function Checkout() {
  const [cart, setCart] = useCart()
  const [, setOrder] = useOrder()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const placed = useRef(false) // emptying the cart must not bounce to /cart
  const items = cart.filter((i) => findProduct(i.id))

  if (!items.length && !placed.current) return <Navigate to="/cart" replace />

  const finish = (order) => {
    placed.current = true
    setOrder(order)
    setCart([])
    navigate('/order', { replace: true })
  }

  const submit = async (e) => {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.target))
    const payment = PAYMENTS.find((p) => p[0] === form.payment)?.[1]
    const lines = items.map(({ id, size, qty }) => ({ id, size, qty }))
    setBusy(true)
    setError(null)
    const [r] = await Promise.all([
      api('orders', {
        body: {
          customer: { name: form.name, email: form.email, phone: form.phone, address: form.address, city: form.city, postal: form.postal },
          payment: form.payment,
          items: lines,
        },
        timeout: 12000,
      }),
      wait(700), // processing reads as a real step
    ])

    if (r.ok) {
      applyInventory(r.data.stock ?? [])
      return finish({ number: r.data.number, total: r.data.total, items: r.data.items, name: form.name, city: form.city, payment, createdAt: Date.parse(r.data.created_at) || Date.now() })
    }
    if (r.offline) {
      // No database: keep the order in this session
      const local = items.map((i) => ({ ...i, qty: Math.min(i.qty, findProduct(i.id).stock) })).filter((i) => i.qty > 0)
      return finish({ number: orderNumber(), total: cartTotal(local), items: local, name: form.name, city: form.city, payment, createdAt: Date.now() })
    }

    setBusy(false)
    if (r.status === 409) {
      applyInventory(r.data.items)
      setCart((c) => c.map((i) => ({ ...i, qty: Math.min(i.qty, findProduct(i.id)?.stock ?? 0) })).filter((i) => i.qty > 0))
      const names = r.data.items.map((s) => `${findProduct(s.id)?.name}: ${s.stock ? `only ${s.stock} left` : 'sold out'}`)
      setError({ title: 'Some items just sold out. Your bag has been updated.', list: names })
    } else {
      setError({ title: 'Please check your details.', list: Object.values(r.data?.fields ?? { form: 'Something went wrong. Try again.' }) })
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><div className="label">Shipping & payment</div><h1>Checkout</h1></div>
        <Link className="link" to="/cart">← Back to cart</Link>
      </div>
      <div className="cart-layout">
        <form className="stack" onSubmit={submit}>
          <div className="label">Contact</div>
          <label>Full name<input name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Your name" /></label>
          <div className="two">
            <label>Email<input name="email" type="email" required maxLength={120} autoComplete="email" placeholder="you@example.com" /></label>
            <label><span>Phone <span className="hint">(optional)</span></span><input name="phone" type="tel" maxLength={20} autoComplete="tel" placeholder="08xx xxxx xxxx" /></label>
          </div>
          <div className="label form-section">Shipping</div>
          <label>Address<textarea name="address" required minLength={5} maxLength={300} rows={3} autoComplete="street-address" placeholder="Street, building, unit" /></label>
          <div className="two">
            <label>City<input name="city" required minLength={2} maxLength={60} autoComplete="address-level2" placeholder="Bandar Lampung" /></label>
            <label>Postal code<input name="postal" required inputMode="numeric" pattern="[0-9]{5}" title="5-digit postal code" autoComplete="postal-code" placeholder="35141" /></label>
          </div>
          <fieldset>
            <legend>Payment</legend>
            {PAYMENTS.map(([value, label, note], i) => (
              <label className="pay" key={value}>
                <input type="radio" name="payment" value={value} defaultChecked={i === 0} />
                <span>{label}</span>
                <span className="small">{note}</span>
              </label>
            ))}
          </fieldset>
          <p className="notice">Review your details before placing the order. Free standard shipping, 2–4 business days.</p>
          {error && (
            <div className="form-error" role="alert">
              {error.title}
              <ul>{error.list.map((m) => <li key={m}>{m}</li>)}</ul>
            </div>
          )}
          <button className="btn primary block" disabled={busy}>
            {busy ? <span className="processing"><span className="spinner" /> Processing order</span> : 'Place order'}
          </button>
        </form>
        <OrderSummary items={items} />
      </div>
    </div>
  )
}
