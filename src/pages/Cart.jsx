import { Link } from 'react-router-dom'
import ProductImage from '../components/ProductImage.jsx'
import { cartTotal, findProduct, rupiah, useCart } from '../store.js'

const sizeLabel = (s) => (isNaN(s) ? `Size ${s}` : `EU ${s}`)

export function OrderSummary({ items, children }) {
  const total = cartTotal(items)
  return (
    <aside className="summary" aria-label="Order summary">
      <h2>Summary</h2>
      <div className="sum-items">
        {items.map((i) => {
          const p = findProduct(i.id)
          return (
            <div className="sum-item" key={i.id + i.size}>
              <ProductImage product={p} />
              <div>{p.name}<span className="small">{sizeLabel(i.size)} · Qty {i.qty}</span></div>
              <span className="mono">{rupiah(p.price * i.qty)}</span>
            </div>
          )
        })}
      </div>
      <div className="sum-row"><span>Subtotal</span><b>{rupiah(total)}</b></div>
      <div className="sum-row"><span>Shipping</span><b>Free</b></div>
      <div className="sum-row total"><span>Total</span><b>{rupiah(total)}</b></div>
      {children}
    </aside>
  )
}

export default function Cart() {
  const [cart, setCart] = useCart()
  const items = cart.filter((i) => findProduct(i.id))
  const update = (item, qty) =>
    setCart((c) => c.map((i) => (i.id === item.id && i.size === item.size ? { ...i, qty } : i)).filter((i) => i.qty > 0))

  if (!items.length) {
    return (
      <div className="page empty">
        <div className="glyph" data-glyph="0" aria-hidden="true" />
        <h1>Cart is empty</h1>
        <p>Pick a size on any product page to add it here.</p>
        <Link className="btn primary" to="/collection">Explore collection</Link>
      </div>
    )
  }

  const count = items.reduce((n, i) => n + i.qty, 0)
  return (
    <div className="page">
      <div className="page-head">
        <div><div className="label">Your cart · {count} {count === 1 ? 'item' : 'items'}</div><h1>Cart</h1></div>
        <Link className="link" to="/collection">Continue shopping</Link>
      </div>
      <div className="cart-layout">
        <div>
          {items.map((item) => {
            const p = findProduct(item.id)
            return (
              <div className="line" key={item.id + item.size}>
                <Link to={`/product/${p.id}`} tabIndex={-1} aria-hidden="true"><ProductImage product={p} /></Link>
                <div className="line-info">
                  <span className="label">{p.brand}</span>
                  <Link to={`/product/${p.id}`}><strong>{p.name}</strong></Link>
                  <span className="small">{sizeLabel(item.size)} · {rupiah(p.price)} each</span>
                  {item.qty > p.stock && <span className="small stock-low">Only {p.stock} left in stock.</span>}
                  <button className="link remove" onClick={() => update(item, 0)}>Remove</button>
                </div>
                <div className="line-end">
                  <div className="qty">
                    <button onClick={() => update(item, item.qty - 1)} aria-label={`Decrease quantity of ${p.name}`}>−</button>
                    <span aria-live="polite">{item.qty}</span>
                    <button onClick={() => update(item, item.qty + 1)} disabled={item.qty >= p.stock} aria-label={`Increase quantity of ${p.name}`}>+</button>
                  </div>
                  <span className="mono">{rupiah(p.price * item.qty)}</span>
                </div>
              </div>
            )
          })}
        </div>
        <OrderSummary items={items}>
          <Link className="btn primary block" to="/checkout">Checkout</Link>
          <p className="small">Free standard shipping on every order. Prices include tax.</p>
        </OrderSummary>
      </div>
    </div>
  )
}
