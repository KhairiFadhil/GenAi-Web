import { Link } from 'react-router-dom'
import { cartTotal, findProduct, rupiah, useCart } from '../store.js'

export default function Cart() {
  const [cart, setCart] = useCart()
  const items = cart.filter((i) => findProduct(i.id))
  const update = (item, qty) =>
    setCart((c) => c.map((i) => (i.id === item.id && i.size === item.size ? { ...i, qty } : i)).filter((i) => i.qty > 0))

  if (!items.length) {
    return <div className="page empty"><h1>Cart is empty</h1><Link className="btn" to="/collection">Explore collection</Link></div>
  }

  return (
    <div className="page narrow">
      <div className="label">Your cart</div>
      <h1>Cart</h1>
      {items.map((item) => {
        const p = findProduct(item.id)
        return (
          <div className="line" key={item.id + item.size}>
            <div>
              <Link to={`/product/${p.id}`}><strong>{p.name}</strong></Link>
              <div className="small">{p.brand} · Size {item.size}</div>
            </div>
            <div className="qty">
              <button onClick={() => update(item, item.qty - 1)} aria-label="Decrease">−</button>
              <span>{item.qty}</span>
              <button onClick={() => update(item, item.qty + 1)} disabled={item.qty >= p.stock} aria-label="Increase">+</button>
            </div>
            <div>{rupiah(p.price * item.qty)}</div>
            <button className="link" onClick={() => update(item, 0)}>Remove</button>
          </div>
        )
      })}
      <div className="line total"><span>Subtotal</span><strong>{rupiah(cartTotal(items))}</strong></div>
      <Link className="btn primary" to="/checkout">Checkout</Link>
    </div>
  )
}
