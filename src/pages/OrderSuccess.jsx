import { Link } from 'react-router-dom'
import { rupiah, useOrder } from '../store.js'

export default function OrderSuccess() {
  const [order] = useOrder()

  if (!order) {
    return <div className="page empty"><h1>No demo order in this session</h1><Link className="btn" to="/">Back to store</Link></div>
  }

  return (
    <div className="page narrow center">
      <div className="ok">✓ ORDER CONFIRMED</div>
      <h1>Thank you{order.name ? `, ${order.name}` : ''}.</h1>
      <p>Your demo order has been created.</p>
      <dl>
        <dt>Order number</dt><dd className="mono">{order.number}</dd>
        <dt>Total</dt><dd>{rupiah(order.total)}</dd>
      </dl>
      <p className="small">This is a simulated transaction. No payment has been processed.</p>
      <Link className="btn primary" to="/">Back to store</Link>
    </div>
  )
}
