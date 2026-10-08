import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { brands, listed, products, useAccount, useCart, useWishlist } from '../store.js'
import { Close, Menu } from './Icons.jsx'
import SizeGuide from './SizeGuide.jsx'

const brandsIn = (category) => brands.filter((b) => products.some((p) => listed(p) && p.brand === b && p.category === category))
const toBrand = (b) => [b, `/collection?brand=${encodeURIComponent(b)}`]

const ANNOUNCE = 'Free shipping on every order · Every pair carries an ORI ID'

// Mega-menu columns: [heading, [[label, to], ...]], rebuilt from the live catalog
const menus = () => ({
  Collection: [
    ['Highlights', [['All products', '/collection'], ['In 3D', '/collection?3d=1'], ['Brand new in box', '/collection?condition=BNIB'], ['Pre-owned', '/collection?condition=Pre-Owned']]],
    ['Sneakers', [['All sneakers', '/collection?category=Sneakers'], ...brandsIn('Sneakers').map(toBrand)]],
    ['Apparel', [['All apparel', '/collection?category=Apparel'], ...brandsIn('Apparel').map(toBrand)]],
  ],
  Brands: [
    ['All brands', brands.map(toBrand)],
    ['Explore', [['3D brand shelf', '/#brands'], ['Verify a product', '/verify']]],
  ],
})

// Count chip that bumps whenever n grows
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
  return <span className={`count ${bump ? 'bump' : ''}`}>{n}</span>
}

export default function Navbar() {
  const MENUS = menus()
  const [cart] = useCart()
  const [wishlist] = useWishlist()
  const account = useAccount()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(null)
  const [atTop, setAtTop] = useState(true)
  const guide = useRef()
  const location = useLocation()
  const count = cart.reduce((n, i) => n + i.qty, 0)

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => { if (!atTop) setMenu(null) }, [atTop]) // mega-menu only exists in the full top bar
  useEffect(() => { setOpen(false); setMenu(null) }, [location.key])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e) => e.key === 'Escape' && (setOpen(false), setMenu(null))
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const hover = (name) => () => setMenu(atTop && MENUS[name] ? name : null)
  const openGuide = () => (setOpen(false), setMenu(null), guide.current.showModal())

  return (
    <>
      <aside className="announce" aria-label="Announcement">
        {/* 4 copies: the marquee loops by sliding exactly half the track (2 copies) */}
        <div className="announce-track">
          {[0, 1, 2, 3].map((i) => <span key={i} aria-hidden={i > 0}>{ANNOUNCE}</span>)}
        </div>
      </aside>
      <header className={`nav ${atTop ? 'is-top' : 'is-compact'}`} onMouseLeave={() => setMenu(null)}>
        <div className={`nav-bar ${menu ? 'menu-open' : ''}`}>
          <nav className="nav-links" aria-label="Main">
            <NavLink to="/collection" onMouseEnter={hover('Collection')} onFocus={hover('Collection')} aria-expanded={menu === 'Collection'}>Collection</NavLink>
            <Link to="/#brands" onMouseEnter={hover('Brands')} onFocus={hover('Brands')} aria-expanded={menu === 'Brands'}>Brands</Link>
            <NavLink to="/verify" onMouseEnter={hover(null)} onFocus={hover(null)}>Verify</NavLink>
            <button onClick={openGuide} onMouseEnter={hover(null)} onFocus={hover(null)}>Size guide</button>
          </nav>

          <Link to="/" className="logo" aria-label="ORI home">
            <span className="logo-mark">ORI</span>
            <small>Originals, up close</small>
          </Link>

          <div className="nav-icons" onMouseEnter={hover(null)}>
            <NavLink to="/collection" className="nav-text hide-sm" end>Search</NavLink>
            {account?.role === 'admin' && <NavLink to="/admin" className="nav-text hide-sm">Admin</NavLink>}
            <NavLink to={account ? '/account' : '/login'} className="nav-text hide-sm">{account ? 'Account' : 'Log in'}</NavLink>
            <NavLink to="/wishlist" className="nav-text hide-sm" aria-label={`Wishlist, ${wishlist.length} items`}>Wishlist <Count n={wishlist.length} /></NavLink>
            <NavLink to="/cart" className="nav-text" aria-label={`Bag, ${count} items`}>Bag <Count n={count} /></NavLink>
            <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? 'Close menu' : 'Open menu'}>
              {open ? <Close /> : <Menu />}
            </button>
          </div>

        </div>
        {/* Sibling of .nav-bar, not a child: nested backdrop-filters don't blur */}
        {menu && (
          <div className="mega" role="region" aria-label={`${menu} menu`}>
            {MENUS[menu].map(([heading, links]) => (
              <div key={heading}>
                <div className="mega-head">{heading}</div>
                {links.map(([label, to]) => <Link key={label} to={to}>{label}</Link>)}
              </div>
            ))}
          </div>
        )}
      </header>

      {open && (
        <nav id="mobile-menu" className="mobile-menu" aria-label="Mobile">
          <Link to="/collection">Collection</Link>
          <Link to="/#brands">Brands</Link>
          <Link to="/verify">Verify</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to={account ? '/account' : '/login'}>{account ? 'Account' : 'Log in'}</Link>
          {account?.role === 'admin' && <Link to="/admin">Admin</Link>}
          <button onClick={openGuide}>Size guide</button>
          <span className="label">ORI · Originals, up close</span>
        </nav>
      )}
      <SizeGuide ref={guide} />
    </>
  )
}
