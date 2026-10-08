import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from '../components/Icons.jsx'
import { findProduct, rupiah, useOrder } from '../store.js'

// ponytail: decorative bars derived from the order number, not a scannable symbology
function Barcode({ value }) {
  let x = 0
  const bars = [...value].flatMap((ch) =>
    [0, 2, 4].map((shift) => {
      const w = ((ch.charCodeAt(0) >> shift) & 3) + 1
      const bar = { x, w }
      x += w + 2
      return bar
    })
  )
  return (
    <svg className="rc-barcode" viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((b, i) => <rect key={i} x={b.x} width={b.w} height="40" />)}
    </svg>
  )
}

export default function OrderSuccess() {
  const [order] = useOrder()
  // Once printed, freeze every animation at its end state: the print dialog toggles print media,
  // which re-displays hidden elements and would otherwise replay the whole sequence.
  const [printed, setPrinted] = useState(false)
  useEffect(() => {
    const done = () => setPrinted(true)
    window.addEventListener('beforeprint', done)
    return () => window.removeEventListener('beforeprint', done)
  }, [])

  if (!order) {
    return (
      <div className="page empty">
        <h1>No recent order</h1>
        <p>Orders you place in this session will appear here.</p>
        <Link className="btn primary" to="/">Back to store</Link>
      </div>
    )
  }

  const placed = new Date(order.createdAt)
  const date = placed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
  const time = placed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const items = (order.items ?? []).filter((i) => findProduct(i.id))
  const count = items.reduce((n, i) => n + i.qty, 0)

  return (
    <div className={`page narrow center order-page ${printed ? 'printed' : ''}`}>
      <div className="check" aria-hidden="true"><Check /></div>
      <p className="ok">ORDER CONFIRMED</p>
      <h1>Thank you{order.name ? `, ${order.name.split(' ')[0]}` : ''}.</h1>
      <p className="muted">Your receipt is printing below. Keep the order number for reference.</p>

      <div className="printer">
        <div className="printer-head"><span className="led" /></div>
        <div className="paper-slot">
          <article className="paper" aria-label={`Receipt for order ${order.number}`}>
            <div className="rc-logo">ORI</div>
            <div className="rc-center">ORIGINALS, UP CLOSE</div>
            <hr />
            <div className="rc-row"><span>ORDER</span><span>{order.number}</span></div>
            <div className="rc-row"><span>DATE</span><span>{date} {time}</span></div>
            {order.payment && <div className="rc-row"><span>PAYMENT</span><span>{order.payment}</span></div>}
            {order.city && <div className="rc-row"><span>SHIP TO</span><span>{order.city}</span></div>}
            <hr />
            {items.map((i) => {
              const p = findProduct(i.id)
              return (
                <div className="rc-item" key={i.id + i.size}>
                  <div>{p.name}</div>
                  <div className="rc-row rc-sub">
                    <span>{isNaN(i.size) ? i.size : `EU ${i.size}`} · {i.qty} × {rupiah(p.price)}</span>
                    <span>{rupiah(p.price * i.qty)}</span>
                  </div>
                </div>
              )
            })}
            <hr />
            <div className="rc-row"><span>ITEMS</span><span>{count}</span></div>
            <div className="rc-row"><span>SUBTOTAL</span><span>{rupiah(order.total)}</span></div>
            <div className="rc-row"><span>SHIPPING</span><span>FREE</span></div>
            <hr className="double" />
            <div className="rc-row rc-total"><span>TOTAL</span><span>{rupiah(order.total)}</span></div>
            <hr />
            <Barcode value={order.number} />
            <div className="rc-center rc-small">{order.number}</div>
            <div className="rc-center rc-thanks">THANK YOU · SEE YOU AGAIN</div>
          </article>
        </div>
      </div>

      <div className="row centered after-print no-print" onAnimationEnd={() => setPrinted(true)}>
        <Link className="btn primary" to="/">Back to store</Link>
        <button className="btn" onClick={() => window.print()}>Print receipt</button>
      </div>
    </div>
  )
}
