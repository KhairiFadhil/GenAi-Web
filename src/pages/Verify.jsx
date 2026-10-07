import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import VerificationCard from '../components/VerificationCard.jsx'
import { findProduct } from '../store.js'

export default function Verify() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [input, setInput] = useState(code ?? '')
  const product = code && findProduct(code)

  return (
    <div className="page narrow">
      <div className="label">ORI Verification</div>
      <h1>Verify product</h1>
      <form onSubmit={(e) => (e.preventDefault(), navigate(`/verify/${input.trim().toUpperCase()}`))}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="ORI-NK-AF1-001" required className="mono" />
        <button className="btn primary">Verify</button>
      </form>
      <p className="small">Try: ORI-NK-AF1-001 · ORI-AD-SMB-001 · ORI-XXXX-999</p>

      {code && (product ? (
        <VerificationCard product={product} />
      ) : (
        <div className="cert fail">
          <div className="bad">✕ PRODUCT NOT FOUND</div>
          <p>The verification code <span className="mono">{code}</span> is not available in the ORI demo database.</p>
        </div>
      ))}
    </div>
  )
}
