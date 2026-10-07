import { Link } from 'react-router-dom'
import { Check } from '../components/Icons.jsx'
import ProductImage from '../components/ProductImage.jsx'
import { findProduct, rupiah, useOrder } from '../store.js'

export default function OrderSuccess() {
  const [order] = useOrder()

  if (!order) {
    return (
      <div className="page empty">
        <h1>No demo order in this session</h1>
        <p>Orders are kept only until you close this tab.</p>
        <Link className="btn primary" to="/">Back to store</Link>
      </div>
    )
  }

  const date = new Date(order.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const items = (order.items ?? []).filter((i) => findProduct(i.id))

  return (
    <div className="page narrow center">
      <div className="check" aria-hidden="true"><Check /></div>
      <p className="ok">ORDER CONFIRMED</p>
      <h1>Thank you{order.name ? `, ${order.name.split(' ')[0]}` : ''}.</h1>
      <p className="muted">Your demo order has been created.</p>

      <div className="receipt">
        <dl>
          <dt>Order number</dt><dd className="mono">{order.number}</dd>
          <dt>Placed</dt><dd className="mono">{date}</dd>
          {order.payment && <><dt>Payment</dt><dd>{order.payment}</dd></>}
          {order.city && <><dt>Ship to</dt><dd>{order.city}</dd></>}
        </dl>
        {items.length > 0 && (
          <div className="sum-items">
            {items.map((i) => {
              const p = findProduct(i.id)
              return (
                <div className="sum-item" key={i.id + i.size}>
                  <ProductImage product={p} />
                  <div>{p.name}<span className="small">{isNaN(i.size) ? i.size : `EU ${i.size}`} · Qty {i.qty}</span></div>
                  <span className="mono">{rupiah(p.price * i.qty)}</span>
                </div>
              )
            })}
          </div>
        )}
        <div className="sum-row total"><span>Total</span><b>{rupiah(order.total)}</b></div>
      </div>

      <p className="small">This is a simulated transaction. No payment has been processed.</p>
      <div className="row centered">
        <Link className="btn primary" to="/">Back to store</Link>
        <button className="btn no-print" onClick={() => window.print()}>Print receipt</button>
      </div>
    </div>
  )
}
