import { useEffect, useReducer } from 'react'
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
import { api } from './api.js'
import { brands, syncInventory, toast, useStoredState } from './store.js'

const LOCALES = ['ID / IDR', 'EN / IDR']
const INFO = [
  ['Free shipping', 'Free standard shipping on every order, delivered in 2–4 business days.'],
  ['ORI verified', 'Every pair carries an ORI product ID you can check online or by QR code.'],
  ['Explore in 3D', 'Rotate, zoom and inspect the details of every sneaker before you buy.'],
]
const FOOT_LINKS = [
  ['Shop', [['All products', '/collection'], ['Sneakers', '/collection?category=Sneakers'], ['Apparel', '/collection?category=Apparel'], ['In 3D', '/collection?3d=1']]],
  ['Brands', brands.slice(0, 5).map((b) => [b, `/collection?brand=${encodeURIComponent(b)}`])],
  ['ORI', [['Verify a product', '/verify'], ['3D brand shelf', '/#brands']]],
  ['Your order', [['Bag', '/cart'], ['Wishlist', '/wishlist'], ['Latest order', '/order']]],
]

const TITLES = { '/collection': 'Collection', '/verify': 'Verify', '/wishlist': 'Wishlist', '/cart': 'Cart', '/checkout': 'Checkout', '/order': 'Order confirmed' }

function NotFound() {
  return (
    <div className="page empty">
      <div className="glyph" data-glyph="404" aria-hidden="true" />
      <h1>Page not found</h1>
      <p>This page doesn't exist or has moved.</p>
      <div className="row"><Link className="btn primary" to="/">Back to store</Link><Link className="btn" to="/collection">Browse collection</Link></div>
    </div>
  )
}

export default function App() {
  const { pathname, hash } = useLocation()
  const [locale, setLocale] = useStoredState('ori-locale', LOCALES[0])
  const [, refresh] = useReducer((n) => n + 1, 0)

  // Live stock and prices, when a database is connected
  useEffect(() => {
    window.addEventListener('ori-inventory', refresh)
    syncInventory()
    return () => window.removeEventListener('ori-inventory', refresh)
  }, [])

  const subscribe = async (e) => {
    e.preventDefault()
    const form = e.target
    const { email, website } = Object.fromEntries(new FormData(form))
    const r = await api('newsletter', { body: { email, website } })
    if (r.ok || r.offline) {
      form.reset()
      toast(r.data?.new === false ? "You're already on the list" : 'Thanks for subscribing')
    } else {
      toast('Please enter a valid email address')
    }
  }

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
        <div className="foot-info">
          {INFO.map(([title, text]) => <div key={title}><strong>{title}</strong><p>{text}</p></div>)}
        </div>
        <div className="foot-main">
          <div className="foot-cols">
            {FOOT_LINKS.map(([title, links]) => (
              <div key={title}>
                <strong>{title}</strong>
                <ul>{links.map(([label, to]) => <li key={label}><Link to={to}>{label}</Link></li>)}</ul>
              </div>
            ))}
          </div>
          <form className="newsletter" onSubmit={subscribe}>
            <label htmlFor="news-email"><strong>Newsletter</strong></label>
            <p>Be first to see new drops and 3D showcases.</p>
            <input id="news-email" name="email" className="news-input" type="email" required placeholder="E-MAIL" autoComplete="email" />
            <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <button type="submit" className="sr-only">Subscribe</button>
          </form>
        </div>
        <div className="foot-base">
          <span>© 2026 ORI. Built for a university project; product details and prices are illustrative.</span>
          <label className="locale">
            <span className="sr-only">Region and currency</span>
            <select value={locale} onChange={(e) => setLocale(e.target.value)}>
              {LOCALES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </label>
        </div>
      </footer>
      <Toaster />
    </>
  )
}
