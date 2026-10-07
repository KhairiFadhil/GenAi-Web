import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'

export const verifyUrl = (id) => `${window.location.origin}/verify/${id}`

export default function VerificationCard({ product: p }) {
  const checked = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  return (
    <div className="cert">
      <div className="label">ORI · Verification Certificate</div>
      <div className="ok">✓ VERIFIED</div>
      <dl>
        <dt>Product</dt><dd>{p.brand} {p.name}</dd>
        <dt>Product ID</dt><dd className="mono">{p.id}</dd>
        <dt>Condition</dt><dd>{p.condition}</dd>
        <dt>Status</dt><dd>Demo Verified</dd>
        <dt>Checked</dt><dd>{checked.toUpperCase()}</dd>
      </dl>
      <div className="qr"><QRCodeSVG value={verifyUrl(p.id)} size={112} bgColor="#F5F5F5" fgColor="#0A0A0A" /></div>
      <p className="small">ORI Verification System — Academic Prototype</p>
      <Link className="btn" to={`/product/${p.id}`}>View product</Link>
    </div>
  )
}
