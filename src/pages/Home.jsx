import { lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ErrorBoundary from '../components/ErrorBoundary.jsx'

const BrandShelf = lazy(() => import('../components/BrandShelf.jsx'))

export default function Home() {
  const navigate = useNavigate()
  return (
    <div className="home">
      <section className="hero">
        <div className="label">Interactive Sneaker & Streetwear Showcase</div>
        <h1>ORIGINALS,<br />UP CLOSE.</h1>
        <p>Explore sneakers and streetwear through an interactive 3D product experience.</p>
        <div className="row">
          <Link className="btn primary" to="/collection">Explore collection</Link>
          <Link className="btn" to="/verify">Verify a product</Link>
        </div>
      </section>
      <ErrorBoundary
        fallback={<div className="shelf empty"><p>3D experience unavailable on this device.</p><Link className="btn" to="/collection">Browse catalog</Link></div>}
      >
        <Suspense fallback={<div className="shelf empty"><p className="label">ORI · Loading 3D experience…</p></div>}>
          <BrandShelf onSelect={(id) => navigate(`/product/${id}`)} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
