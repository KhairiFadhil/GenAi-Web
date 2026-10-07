import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import ProductImage from './ProductImage.jsx'

export const verifyUrl = (id) => `${window.location.origin}/verify/${id}`

export default function VerificationCard({ product: p }) {
  const now = new Date()
  const checked = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <article className="cert" aria-label={`Verification certificate for ${p.name}`}>
      <div className="cert-head">
        <span className="label">ORI · Verification certificate</span>
        <p className="ok">✓ VERIFIED</p>
      </div>
      <div className="cert-body">
        <div className="cert-photo">
          <ProductImage product={p} />
          <div className="seal" aria-hidden="true">ORI<br />DEMO<br />VERIFIED</div>
        </div>
        <dl>
          <dt>Product</dt><dd>{p.name}</dd>
          <dt>Brand</dt><dd>{p.brand}</dd>
          <dt>Product ID</dt><dd className="mono">{p.id}</dd>
          <dt>Condition</dt><dd>{p.condition}</dd>
          <dt>Status</dt><dd>Demo Verified</dd>
          <dt>Checked</dt><dd className="mono">{checked} · {time}</dd>
        </dl>
      </div>
      <div className="cert-foot">
        <div className="row">
          <div className="qr"><QRCodeSVG value={verifyUrl(p.id)} size={76} bgColor="#F5F5F5" fgColor="#0A0A0A" /></div>
          <p className="small">ORI Verification System<br />Academic prototype — not a real authentication.</p>
        </div>
        <div className="row no-print">
          <button className="btn" onClick={() => window.print()}>Print</button>
          <Link className="btn primary" to={`/product/${p.id}`}>View product</Link>
        </div>
      </div>
    </article>
  )
}
