import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { findProduct, useWishlist } from '../store.js'

export default function Wishlist() {
  const [wishlist, setWishlist] = useWishlist()
  const items = wishlist.map(findProduct).filter(Boolean)

  return (
    <div className="page">
      <div className="label">Saved</div>
      <h1>My wishlist</h1>
      {items.length ? (
        <div className="grid">
          {items.map((p) => (
            <div key={p.id}>
              <ProductCard product={p} />
              <button className="link" onClick={() => setWishlist((w) => w.filter((id) => id !== p.id))}>Remove</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty"><p>Your wishlist is empty.</p><Link className="btn" to="/collection">Explore collection</Link></div>
      )}
    </div>
  )
}
