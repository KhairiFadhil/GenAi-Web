import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { cartTotal, findProduct, orderNumber, useCart, useOrder } from '../store.js'
import { OrderSummary } from './Cart.jsx'

const PAYMENTS = [
  ['card', 'Credit or debit card', 'Visa · Mastercard'],
  ['ewallet', 'E-wallet', 'GoPay · OVO · DANA'],
  ['transfer', 'Bank transfer', 'Virtual account'],
]

export default function Checkout() {
  const [cart, setCart] = useCart()
  const [, setOrder] = useOrder()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const placed = useRef(false) // emptying the cart on submit must not bounce us to /cart
  const items = cart.filter((i) => findProduct(i.id))

  if (!items.length && !placed.current) return <Navigate to="/cart" replace />

  const submit = (e) => {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.target))
    setBusy(true)
    // Brief pause so processing reads as a real step
    setTimeout(() => {
      placed.current = true
      const lines = items.map((i) => ({ ...i, qty: Math.min(i.qty, findProduct(i.id).stock) })).filter((i) => i.qty > 0)
      setOrder({
        number: orderNumber(),
        total: cartTotal(lines),
        items: lines,
        name: form.name,
        city: form.city,
        payment: PAYMENTS.find((p) => p[0] === form.payment)?.[1],
        createdAt: Date.now(),
      })
      setCart([])
      navigate('/order', { replace: true })
    }, 900)
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
          <label>Full name<input name="name" required autoComplete="name" placeholder="Your name" /></label>
          <div className="two">
            <label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
            <label>Phone <span className="hint">(optional)</span><input name="phone" type="tel" autoComplete="tel" placeholder="08xx xxxx xxxx" /></label>
          </div>
          <div className="label form-section">Shipping</div>
          <label>Address<textarea name="address" required rows={3} autoComplete="street-address" placeholder="Street, building, unit" /></label>
          <div className="two">
            <label>City<input name="city" required autoComplete="address-level2" placeholder="Bandar Lampung" /></label>
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
          <button className="btn primary block" disabled={busy}>
            {busy ? <span className="processing"><span className="spinner" /> Processing order</span> : 'Place order'}
          </button>
        </form>
        <OrderSummary items={items} />
      </div>
    </div>
  )
}
