import { Link } from 'react-router-dom'
import { rupiah } from '../store.js'
import ProductImage from './ProductImage.jsx'

export default function ProductCard({ product: p }) {
  return (
    <Link to={`/product/${p.id}`} className="card">
      <ProductImage product={p} />
      <div className="meta">
        <span>{p.brand}</span>
        {p.model3D && <span className="badge">3D</span>}
        {p.stock === 0 && <span className="badge muted">Sold out</span>}
      </div>
      <h3>{p.name}</h3>
      <p>{rupiah(p.price)}</p>
    </Link>
  )
}
