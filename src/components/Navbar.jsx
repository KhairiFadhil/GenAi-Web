import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useCart, useWishlist } from '../store.js'
import { Bag, Close, Heart, Menu } from './Icons.jsx'
import SizeGuide from './SizeGuide.jsx'

// Re-triggers the bump animation whenever n grows
function Count({ n }) {
  const [bump, setBump] = useState(false)
  const prev = useRef(n)
  useEffect(() => {
    if (n > prev.current) {
      setBump(true)
      const t = setTimeout(() => setBump(false), 450)
      prev.current = n
      return () => clearTimeout(t)
    }
    prev.current = n
  }, [n])
  return n ? <span className={`count ${bump ? 'bump' : ''}`}>{n}</span> : null
}

export default function Navbar() {
  const [cart] = useCart()
  const [wishlist] = useWishlist()
  const [open, setOpen] = useState(false)
  const guide = useRef()
  const { pathname } = useLocation()
  const count = cart.reduce((n, i) => n + i.qty, 0)

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const openGuide = () => (setOpen(false), guide.current.showModal())
  const links = (
    <>
      <NavLink to="/collection">Collection</NavLink>
      <Link to="/#brands">Brands</Link>
      <NavLink to="/verify">Verify</NavLink>
      <button onClick={openGuide}>Size guide</button>
    </>
  )

  return (
    <>
      <header className="nav">
        <Link to="/" className="logo" aria-label="ORI home">ORI <small>Originals, up close</small></Link>
        <nav className="nav-links" aria-label="Main">{links}</nav>
        <div className="nav-icons">
          <NavLink to="/wishlist" className="icon-btn" aria-label={`Wishlist, ${wishlist.length} items`}>
            <Heart /><Count n={wishlist.length} />
          </NavLink>
          <NavLink to="/cart" className="icon-btn" aria-label={`Cart, ${count} items`}>
            <Bag /><Count n={count} />
          </NavLink>
          <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'}>
            {open ? <Close /> : <Menu />}
          </button>
        </div>
      </header>
      {open && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile">
          {links}
          <span className="label">ORI · Originals, up close</span>
        </nav>
      )}
      <SizeGuide ref={guide} />
    </>
  )
}
