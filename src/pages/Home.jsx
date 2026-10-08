import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { verifyUrl } from '../components/VerificationCard.jsx'
import { brands, has3D, listed, products as all } from '../store.js'
import { hasWebGL } from '../webgl.js'

const BrandShelf = lazy(() => import('../components/BrandShelf.jsx'))

const STEPS = [
  ['Explore', 'Walk the 3D brand shelf and step into any cubby.', '/#brands'],
  ['Inspect', 'Rotate, zoom and open hotspots on every sneaker.', '/product/ORI-NK-AF1-001'],
  ['Verify', 'Check a product ID or scan its QR code with your phone.', '/verify'],
  ['Buy', 'Pick your size and check out in a few steps.', '/collection'],
]

function ShelfFallback({ message }) {
  return (
    <div className="shelf empty">
      <p>{message}</p>
      <div className="shelf-fallback-brands">
        {brands.map((b) => <Link key={b} className="chip" to={`/collection?brand=${encodeURIComponent(b)}`}>{b}</Link>)}
      </div>
      <Link className="btn" to="/collection">Browse catalog</Link>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const products = all.filter(listed)
  const featured = products.filter(has3D).slice(0, 4)

  return (
    <div className="home">
      <section className="home-hero">
        <div className="hero-copy">
          <div className="label">Interactive Sneaker & Streetwear Showcase</div>
          <h1>Originals,<br /><em>up close.</em></h1>
          <p>Explore sneakers and streetwear through an interactive 3D product experience.</p>
          <div className="row">
            <Link className="btn primary" to="/collection">Explore collection</Link>
            <Link className="btn" to="/verify">Verify a product</Link>
          </div>
          <div className="hero-stats">
            <div><b>{products.length}</b><span>Products</span></div>
            <div><b>{brands.length}</b><span>Brands</span></div>
            <div><b>{products.filter(has3D).length}</b><span>In 3D</span></div>
          </div>
        </div>
        <div id="brands" className="hero-shelf">
          {hasWebGL() ? (
            <ErrorBoundary fallback={<ShelfFallback message="3D experience unavailable on this device." />}>
              <Suspense fallback={<div className="shelf loading"><span className="label">ORI · Loading 3D experience</span><span className="bar indeterminate"><span /></span></div>}>
                <BrandShelf onSelect={(id) => navigate(`/product/${id}`)} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <ShelfFallback message="Your browser can't show the 3D shelf. Pick a brand instead." />
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>How ORI works</h2>
          <span className="label">Explore → Inspect → Verify → Buy</span>
        </div>
        <div className="steps">
          {STEPS.map(([title, text, to], i) => (
            <Link key={title} to={to} className="step">
              <span className="label"><span>{String(i + 1).padStart(2, '0')}</span><span className="arrow">→</span></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>In the showcase</h2>
          <Link className="link" to="/collection">View all {products.length} products</Link>
        </div>
        <div className="grid">{featured.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </section>

      <section className="section">
        <div className="verify-teaser">
          <div>
            <div className="label">ORI Verification</div>
            <h2>Every pair carries an ORI&nbsp;ID.</h2>
            <p>Type a product ID or scan the QR code on a product page to open its certificate.</p>
            <form className="inline-form" onSubmit={(e) => (e.preventDefault(), navigate(`/verify/${code.trim().toUpperCase()}`))}>
              <label className="sr-only" htmlFor="home-code">Product ID</label>
              <input id="home-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ORI-NK-AF1-001" required />
              <button className="btn primary">Verify</button>
            </form>
          </div>
          <div className="qr-tile">
            <QRCodeSVG value={verifyUrl('ORI-NK-AF1-001')} title="QR code: verify Air Force 1 '07 White" size={128} bgColor="#F5F5F5" fgColor="#0A0A0A" />
            <span className="label">Scan with your phone</span>
          </div>
        </div>
      </section>
    </div>
  )
}
