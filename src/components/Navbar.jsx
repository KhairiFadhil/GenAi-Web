import { Link, NavLink } from 'react-router-dom'
import { useCart, useWishlist } from '../store.js'

export default function Navbar() {
  const [cart] = useCart()
  const [wishlist] = useWishlist()
  const count = cart.reduce((n, i) => n + i.qty, 0)

  return (
    <header className="nav">
      <Link to="/" className="logo">ORI</Link>
      <nav>
        <NavLink to="/collection">Collection</NavLink>
        <NavLink to="/verify">Verify</NavLink>
        <NavLink to="/wishlist" aria-label="Wishlist">♡ {wishlist.length || ''}</NavLink>
        <NavLink to="/cart">Cart {count ? `(${count})` : ''}</NavLink>
      </nav>
    </header>
  )
}
