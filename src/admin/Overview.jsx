import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { rupiah } from '../store.js'
import { Gate, PageHead, Status, shortRp, useLoad, when } from './ui.jsx'

const BAR = '#3fa956' // passes dark-surface lightness/contrast checks (dataviz validator)
const H = 220, PAD = { top: 14, right: 8, bottom: 26, left: 64 }

// Round axis max to 1/2/2.5/5 × 10^n
function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw || 1))
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw)
}

function RevenueChart({ daily }) {
  const box = useRef()
  const [w, setW] = useState(720)
  const [hover, setHover] = useState(null)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])

  const max = Math.max(...daily.map((d) => d.revenue), 1)
  const step = niceStep(max / 4)
  const top = Math.ceil(max / step) * step
  const innerW = w - PAD.left - PAD.right, innerH = H - PAD.top - PAD.bottom
  const band = innerW / daily.length
  const y = (v) => PAD.top + innerH - (v / top) * innerH
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const label = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  const every = w < 520 ? 10 : 5
  const h = hover != null ? daily[hover] : null

  return (
    <div className="adm-chart" ref={box} onMouseLeave={() => setHover(null)}>
      <svg width={w} height={H} role="img" aria-label="Daily revenue, last 30 days">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} className={t ? 'grid' : 'base'} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tick">{t ? shortRp(t).replace('Rp ', '') : '0'}</text>
          </g>
        ))}
        {daily.map((d, i) => {
          const x = PAD.left + i * band + 1, bw = Math.max(1, band - 2) // 2px gap between bars
          const bh = Math.max(0, y(0) - y(d.revenue)), r = Math.min(4, bw / 2, bh)
          const by = y(0) - bh
          return (
            <g key={d.day}>
              {bh > 0 && (
                <path
                  d={`M${x},${y(0)} V${by + r} Q${x},${by} ${x + r},${by} H${x + bw - r} Q${x + bw},${by} ${x + bw},${by + r} V${y(0)} Z`}
                  fill={BAR} opacity={hover == null || hover === i ? 1 : 0.45}
                />
              )}
              {(daily.length - 1 - i) % every === 0 && (
                <text x={i === daily.length - 1 ? x + bw : x + bw / 2} y={H - 8} textAnchor={i === daily.length - 1 ? 'end' : 'middle'} className="tick">{label(d.day)}</text>
              )}
              {/* hit target: the whole column */}
              <rect x={PAD.left + i * band} y={PAD.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          )
        })}
      </svg>
      {h && (
        <div className="adm-tip" style={{ left: Math.min(PAD.left + hover * band + band / 2, w - 90), top: Math.max(4, y(h.revenue) - 64) }}>
          <b>{label(h.day)}</b>
          <span>{rupiah(h.revenue)}</span>
          <span className="adm-muted">{h.orders} {h.orders === 1 ? 'order' : 'orders'}</span>
        </div>
      )}
      <details className="adm-table-view">
        <summary>View as table</summary>
        <table className="adm-table">
          <thead><tr><th>Day</th><th className="num">Orders</th><th className="num">Revenue</th></tr></thead>
          <tbody>{daily.map((d) => <tr key={d.day}><td>{label(d.day)}</td><td className="num">{d.orders}</td><td className="num">{rupiah(d.revenue)}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  )
}

function Delta({ cur, prev }) {
  if (!prev) return <span className="adm-muted">no previous data</span>
  const pct = Math.round(((cur - prev) / prev) * 100)
  return <span className={pct >= 0 ? 'up' : 'down'}>{pct >= 0 ? '▲' : '▼'} {Math.abs(pct)}% <span className="adm-muted">vs prev. 30 days</span></span>
}

function Tile({ label, value, foot, to, alert }) {
  const body = (
    <>
      <div className="adm-label">{label}</div>
      <div className="adm-kpi">{value}</div>
      {foot && <div className="adm-foot">{foot}</div>}
    </>
  )
  return to ? <Link to={to} className={`adm-tile ${alert ? 'alert' : ''}`}>{body}</Link> : <div className="adm-tile">{body}</div>
}

export default function Overview() {
  const state = useLoad('admin/overview')
  return (
    <>
      <PageHead title="Overview" sub="Last 30 days" />
      <Gate state={state}>
        {({ kpis: k, daily, top_products, recent_orders, low_stock_items }) => {
          const topMax = Math.max(...top_products.map((p) => p.revenue), 1)
          return (
            <>
              <div className="adm-tiles">
                <Tile label="Revenue" value={shortRp(k.revenue_30d)} foot={<Delta cur={k.revenue_30d} prev={k.revenue_prev_30d} />} />
                <Tile label="Orders" value={k.orders_30d} foot={<Delta cur={k.orders_30d} prev={k.orders_prev_30d} />} />
                <Tile label="Avg. order value" value={shortRp(k.aov_30d)} foot={`${k.customers} customer accounts`} />
                <Tile label="To ship" value={k.to_ship} foot={`${k.pending} awaiting payment`} to="/admin/orders?status=paid" alert={k.to_ship > 0} />
                <Tile label="Open reports" value={k.open_reports} foot="Support queue" to="/admin/reports" alert={k.open_reports > 0} />
                <Tile label="Low stock" value={k.low_stock} foot="3 or fewer left" to="/admin/products" alert={k.low_stock > 0} />
                <Tile label="Unknown codes" value={k.unknown_checks_30d} foot={`of ${k.checks_30d} verification checks`} to="/admin/verifications" alert={k.unknown_checks_30d > 0} />
                <Tile label="Subscribers" value={k.subscribers} foot="Newsletter" to="/admin/customers" />
              </div>

              <section className="adm-card">
                <div className="adm-card-head"><h2>Daily revenue</h2><span className="adm-muted">Excludes cancelled orders · WIB</span></div>
                <RevenueChart daily={daily} />
              </section>

              <div className="adm-cols">
                <section className="adm-card">
                  <div className="adm-card-head"><h2>Recent orders</h2><Link className="adm-link" to="/admin/orders">All orders →</Link></div>
                  <div className="adm-scroll">
                    <table className="adm-table">
                      <tbody>
                        {recent_orders.map((o) => (
                          <tr key={o.number}>
                            <td><Link className="adm-link mono" to={`/admin/orders?number=${o.number}`}>{o.number}</Link><div className="adm-muted">{o.customer_name}</div></td>
                            <td><Status value={o.status} /></td>
                            <td className="num">{rupiah(o.total)}<div className="adm-muted">{when(o.created_at)}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="adm-card">
                  <div className="adm-card-head"><h2>Top products</h2><span className="adm-muted">By revenue</span></div>
                  <ol className="adm-rank">
                    {top_products.map((p) => (
                      <li key={p.id}>
                        <div className="adm-rank-row"><span>{p.name}</span><b>{shortRp(p.revenue)}</b></div>
                        <div className="adm-meter"><span style={{ width: `${(p.revenue / topMax) * 100}%` }} /></div>
                        <div className="adm-muted">{p.qty} sold</div>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="adm-card">
                  <div className="adm-card-head"><h2>Low stock</h2><Link className="adm-link" to="/admin/products">Manage →</Link></div>
                  {low_stock_items.length ? (
                    <ul className="adm-list">
                      {low_stock_items.map((p) => (
                        <li key={p.id}><span>{p.name}</span><span className={`adm-chip ${p.stock ? 's-pending' : 's-cancelled'}`}>{p.stock ? `${p.stock} left` : 'sold out'}</span></li>
                      ))}
                    </ul>
                  ) : <p className="adm-muted">All products are well stocked.</p>}
                </section>
              </div>
            </>
          )
        }}
      </Gate>
    </>
  )
}
