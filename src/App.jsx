import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Toaster from './components/Toaster.jsx'
import Home from './pages/Home.jsx'
import Catalog from './pages/Catalog.jsx'
import Product from './pages/Product.jsx'
import Verify from './pages/Verify.jsx'
import Wishlist from './pages/Wishlist.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import OrderSuccess from './pages/OrderSuccess.jsx'
import { brands } from './store.js'

const TITLES = { '/collection': 'Collection', '/verify': 'Verify', '/wishlist': 'Wishlist', '/cart': 'Cart', '/checkout': 'Checkout', '/order': 'Order confirmed' }

function NotFound() {
  return (
    <div className="page empty">
      <div className="glyph" aria-hidden="true">404</div>
      <h1>Page not found</h1>
      <p>This page doesn't exist or has moved.</p>
      <div className="row"><Link className="btn primary" to="/">Back to store</Link><Link className="btn" to="/collection">Browse collection</Link></div>
    </div>
  )
}

export default function App() {
  const { pathname, hash } = useLocation()

  // New page starts at the top unless a #section is requested
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo(0, 0)
  }, [pathname, hash])

  useEffect(() => {
    const base = '/' + (pathname.split('/')[1] ?? '')
    document.title = TITLES[base] ? `${TITLES[base]} — ORI` : 'ORI — Originals, Up Close'
  }, [pathname])

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Navbar />
      <main id="main">
        <div className="route" key={pathname}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/collection" element={<Catalog />} />
            <Route path="/product/:id" element={<Product />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/verify/:code" element={<Verify />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order" element={<OrderSuccess />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
      <footer className="footer">
        <div className="footer-grid">
          <div>
            <strong>ORI</strong>
            <p>
              A concept store for original sneakers and streetwear. Explore every pair in 3D, check its ORI product ID,
              and shop with confidence.
            </p>
          </div>
          <div>
            <strong>SHOP</strong>
            <ul>
              <li><Link to="/collection">All products</Link></li>
              {brands.slice(0, 4).map((b) => <li key={b}><Link to={`/collection?brand=${encodeURIComponent(b)}`}>{b}</Link></li>)}
            </ul>
          </div>
          <div>
            <strong>ORI</strong>
            <ul>
              <li><Link to="/verify">Verify a product</Link></li>
              <li><Link to="/wishlist">Wishlist</Link></li>
              <li><Link to="/cart">Cart</Link></li>
              <li><Link to="/#brands">3D brand shelf</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-base small">
          <span>© 2026 ORI. Built for a university project; product details and prices are illustrative.</span>
          <span className="mono">Explore → Inspect → Verify → Buy</span>
        </div>
      </footer>
      <Toaster />
    </>
  )
}
