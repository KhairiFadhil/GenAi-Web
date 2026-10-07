import { useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Home from './pages/Home.jsx'
import Catalog from './pages/Catalog.jsx'
import Product from './pages/Product.jsx'
import Verify from './pages/Verify.jsx'
import Wishlist from './pages/Wishlist.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import OrderSuccess from './pages/OrderSuccess.jsx'

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])

  return (
    <>
      <Navbar />
      <main>
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
          <Route path="*" element={<div className="page empty"><h1>Page not found</h1><Link className="btn" to="/">Back to store</Link></div>} />
        </Routes>
      </main>
      <footer className="footer">
        <strong>ACADEMIC PROTOTYPE</strong>
        <p>
          ORI is a fictional academic prototype. Product information, prices, stock, product IDs, QR codes,
          verification results, and transactions shown in this application are simulated for demonstration
          purposes only. ORI is not a real store and does not process real transactions.
        </p>
      </footer>
    </>
  )
}
