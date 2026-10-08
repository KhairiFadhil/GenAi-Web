import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import VerificationCard from '../components/VerificationCard.jsx'
import { findProduct, useVerified } from '../store.js'

const EXAMPLES = ['ORI-NK-AF1-001', 'ORI-AD-SMB-001', 'ORI-NB-550-001']
const logged = new Map() // one log per code per visit

export default function Verify() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [input, setInput] = useState(code ?? '')
  const [history, setHistory] = useVerified()
  const normalized = code?.trim().toUpperCase()
  const product = normalized && findProduct(normalized)

  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (product) setHistory((h) => [product.id, ...h.filter((id) => id !== product.id)].slice(0, 5))
  }, [product?.id])

  // Log the check and fetch its history
  useEffect(() => {
    setStats(null)
    if (!normalized) return
    if (!logged.has(normalized)) logged.set(normalized, api('verify', { body: { code: normalized } }))
    let live = true
    logged.get(normalized).then((r) => live && r.ok && r.data.found && setStats(r.data))
    return () => { live = false }
  }, [normalized])

  const check = (value) => navigate(`/verify/${encodeURIComponent(value.trim().toUpperCase())}`)
  const recent = history.filter((id) => id !== product?.id).map(findProduct).filter(Boolean)

  return (
    <div className="page narrow">
      <div className="label">ORI Verification</div>
      <h1>Verify product</h1>
      <p className="muted">Enter the ORI product ID printed on the tag, or scan the QR code on a product page.</p>
      <form className="inline-form" onSubmit={(e) => (e.preventDefault(), check(input))}>
        <label className="sr-only" htmlFor="code">Product ID</label>
        <input id="code" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. ORI-NK-AF1-001" required autoComplete="off" spellCheck={false} />
        <button className="btn primary">Verify</button>
      </form>
      <div className="try">
        <span className="label">Examples</span>
        {EXAMPLES.map((c) => <button key={c} onClick={() => (setInput(c), check(c))}>{c}</button>)}
      </div>

      {normalized && (product ? (
        <VerificationCard product={product} stats={stats} />
      ) : (
        <div className="cert fail" role="alert">
          <p className="bad">✕ PRODUCT NOT FOUND</p>
          <p>The verification code <span className="mono">{normalized}</span> isn't registered with ORI. Check the code on the tag and try again.</p>
          <Link className="btn" to="/collection">Browse collection</Link>
        </div>
      ))}

      {recent.length > 0 && (
        <section className="history">
          <div className="label">Checked this session</div>
          <ul>
            {recent.map((p) => (
              <li key={p.id}><Link to={`/verify/${p.id}`}><span>{p.name}</span><span className="mono">{p.id}</span></Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
