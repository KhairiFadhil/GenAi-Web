import { useRef } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { cartTotal, orderNumber, rupiah, useCart, useOrder } from '../store.js'

export default function Checkout() {
  const [cart, setCart] = useCart()
  const [, setOrder] = useOrder()
  const navigate = useNavigate()
  const placed = useRef(false) // emptying the cart on submit must not bounce us to /cart

  if (!cart.length && !placed.current) return <Navigate to="/cart" replace />
  const total = cartTotal(cart)

  const submit = (e) => {
    e.preventDefault()
    placed.current = true
    const form = Object.fromEntries(new FormData(e.target))
    setOrder({ number: orderNumber(), total, items: cart, name: form.name, createdAt: Date.now() })
    setCart([])
    navigate('/order', { replace: true })
  }

  return (
    <div className="page narrow">
      <div className="label">Checkout simulation</div>
      <h1>Checkout</h1>
      <form className="stack" onSubmit={submit}>
        <label>Name<input name="name" required placeholder="Your name" /></label>
        <label>Email<input name="email" type="email" required placeholder="demo@example.com" /></label>
        <label>Address<textarea name="address" required placeholder="Demo address" rows={3} /></label>
        <fieldset>
          <legend>Payment</legend>
          <label className="inline"><input type="radio" name="payment" defaultChecked /> Demo payment</label>
        </fieldset>
        <div className="line total"><span>Total</span><strong>{rupiah(total)}</strong></div>
        <p className="small">This is a simulated transaction. No payment will be processed.</p>
        <button className="btn primary">Place demo order</button>
        <Link className="link" to="/cart">← Back to cart</Link>
      </form>
    </div>
  )
}
