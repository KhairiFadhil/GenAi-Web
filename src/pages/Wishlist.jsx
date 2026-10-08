import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { addToCart, findProduct, toast, useCart, useWishlist } from '../store.js'

function MoveToCart({ product: p, onMoved }) {
  const [size, setSize] = useState('')
  const [, setCart] = useCart()
  const soldOut = p.stock === 0
  const move = () => {
    setCart((c) => addToCart(c, p.id, size))
    onMoved(p.id)
    toast(`Moved ${p.name} to cart`, { to: '/cart', label: 'View cart' })
  }
  return (
    <div className="wish-actions">
      <select value={size} onChange={(e) => setSize(e.target.value)} disabled={soldOut} aria-label={`Size for ${p.name}`}>
        <option value="">{soldOut ? 'Sold out' : 'Size'}</option>
        {p.sizes.map((s) => <option key={s} value={s}>{isNaN(s) ? s : `EU ${s}`}</option>)}
      </select>
      <button className="btn primary" disabled={!size} onClick={move}>Move to cart</button>
    </div>
  )
}

export default function Wishlist() {
  const [wishlist, setWishlist] = useWishlist()
  const items = wishlist.map(findProduct).filter(Boolean)
  const remove = (id) => setWishlist((w) => w.filter((x) => x !== id))

  if (!items.length) {
    return (
      <div className="page empty">
        <div className="glyph" data-glyph="♡" aria-hidden="true" />
        <h1>Your wishlist is empty</h1>
        <p>Tap the heart on any product to save it here.</p>
        <Link className="btn primary" to="/collection">Explore collection</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-head">
        <div><div className="label">Saved · {items.length} {items.length === 1 ? 'item' : 'items'}</div><h1>My wishlist</h1></div>
      </div>
      <h2 className="sr-only">Saved products</h2>
      <div className="grid">
        {items.map((p) => (
          <ProductCard key={p.id} product={p}>
            <MoveToCart product={p} onMoved={remove} />
          </ProductCard>
        ))}
      </div>
    </div>
  )
}
