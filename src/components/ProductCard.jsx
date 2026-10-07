import { Link } from 'react-router-dom'
import { has3D, rupiah, toast, toggleIn, useWishlist } from '../store.js'
import { Heart } from './Icons.jsx'
import ProductImage from './ProductImage.jsx'

export default function ProductCard({ product: p, children }) {
  const [wishlist, setWishlist] = useWishlist()
  const wished = wishlist.includes(p.id)
  const toggle = () => {
    setWishlist((w) => toggleIn(w, p.id))
    toast(wished ? 'Removed from wishlist' : `Saved ${p.name}`, wished ? null : { to: '/wishlist', label: 'Wishlist' })
  }

  return (
    <article className="card">
      <button className="heart" onClick={toggle} aria-pressed={wished} aria-label={wished ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}>
        <Heart />
      </button>
      <Link to={`/product/${p.id}`} className="card-link">
        <div className="tags">
          {has3D(p) && <span className="badge">3D</span>}
          {p.condition !== 'BNIB' && <span className="badge muted">{p.condition}</span>}
          {p.stock === 0 && <span className="badge muted">Sold out</span>}
        </div>
        <ProductImage product={p} hover={p.images[1]} />
        <div className="meta"><span>{p.brand}</span><span>{p.category}</span></div>
        <h3>{p.name}</h3>
        <p className="price">{rupiah(p.price)}</p>
      </Link>
      {children}
    </article>
  )
}
