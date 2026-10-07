import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import ProductImage from '../components/ProductImage.jsx'
import { verifyUrl } from '../components/VerificationCard.jsx'
import { addToCart, findProduct, rupiah, useCart, useWishlist } from '../store.js'

const ProductViewer = lazy(() => import('../components/ProductViewer.jsx'))

export default function Product() {
  const p = findProduct(useParams().id)
  const navigate = useNavigate()
  const [size, setSize] = useState(null)
  const [, setCart] = useCart()
  const [wishlist, setWishlist] = useWishlist()

  if (!p) {
    return <div className="page empty"><h1>Product not found</h1><Link className="btn" to="/collection">Back to collection</Link></div>
  }

  const wished = wishlist.includes(p.id)
  const soldOut = p.stock === 0
  const images = <div className="gallery">{p.images.map((src) => <ProductImage key={src} product={p} src={src} />)}</div>

  return (
    <div className="page product">
      <div className="showcase">
        {p.model3D ? (
          <ErrorBoundary key={p.id} fallback={<div className="viewer-error"><p>Unable to load 3D preview.</p>{images}</div>}>
            <Suspense fallback={<div className="viewer empty"><p className="label">Loading 3D experience…</p></div>}>
              <ProductViewer product={p} />
            </Suspense>
          </ErrorBoundary>
        ) : images}
      </div>

      <div className="detail">
        <div className="label">{p.brand} · {p.category}</div>
        <h1>{p.name}</h1>
        <p className="price">{rupiah(p.price)}</p>
        <p className="muted">{p.description}</p>

        <dl>
          <dt>Condition</dt><dd>{p.condition}</dd>
          <dt>Color</dt><dd>{p.color}</dd>
          <dt>Stock</dt><dd>{soldOut ? 'Out of stock' : p.stock}</dd>
          <dt>Product ID</dt><dd className="mono">{p.id}</dd>
          <dt>Showcase</dt><dd>{p.model3D ? '3D available' : 'Photos only'}</dd>
        </dl>

        <div className="label">Available sizes</div>
        <div className="sizes">
          {p.sizes.map((s) => (
            <button key={s} className={size === s ? 'on' : ''} onClick={() => setSize(s)} disabled={soldOut}>{s}</button>
          ))}
        </div>
        <details className="size-guide">
          <summary>Size guide</summary>
          <table>
            <thead><tr><th>EU</th><th>US</th><th>CM</th></tr></thead>
            <tbody>
              {[[40, 7, 25], [41, 8, 26], [42, 9, 27], [43, 10, 28], [44, 11, 29]].map((r) => (
                <tr key={r[0]}>{r.map((c) => <td key={c}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <p className="small">Approximate — varies by brand.</p>
        </details>

        <div className="actions">
          <button
            className="btn primary"
            disabled={!size || soldOut}
            onClick={() => (setCart((c) => addToCart(c, p.id, size)), navigate('/cart'))}
          >
            {soldOut ? 'Out of stock' : size ? 'Add to cart' : 'Select a size'}
          </button>
          <button className="btn" onClick={() => setWishlist((w) => (wished ? w.filter((id) => id !== p.id) : [...w, p.id]))}>
            {wished ? '♥ In wishlist' : '♡ Add to wishlist'}
          </button>
          <Link className="btn" to={`/verify/${p.id}`}>Verify product</Link>
        </div>

        <div className="qr-row">
          <QRCodeSVG value={verifyUrl(p.id)} size={88} bgColor="#F5F5F5" fgColor="#0A0A0A" />
          <p className="small">Scan to verify this product in the ORI demo database.</p>
        </div>
      </div>
    </div>
  )
}
