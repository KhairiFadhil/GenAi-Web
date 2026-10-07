import { lazy, Suspense, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import { Heart } from '../components/Icons.jsx'
import ProductCard from '../components/ProductCard.jsx'
import ProductImage from '../components/ProductImage.jsx'
import SizeGuide from '../components/SizeGuide.jsx'
import { verifyUrl } from '../components/VerificationCard.jsx'
import { addToCart, findProduct, has3D, products, rupiah, toast, toggleIn, useCart, useWishlist } from '../store.js'
import { hasWebGL } from '../webgl.js'

const ProductViewer = lazy(() => import('../components/ProductViewer.jsx'))

function Gallery({ product: p }) {
  const [i, setI] = useState(0)
  return (
    <div className="gallery">
      <ProductImage product={p} src={p.images[i]} alt={`${p.name}, view ${i + 1}`} eager />
      {p.images.length > 1 && (
        <div className="thumbs">
          {p.images.map((src, j) => (
            <button key={src} onClick={() => setI(j)} aria-current={i === j} aria-label={`Show view ${j + 1}`}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function stockText(stock) {
  if (stock === 0) return 'Out of stock'
  if (stock <= 3) return `Only ${stock} left`
  return `${stock} in stock`
}

export default function Product() {
  const p = findProduct(useParams().id)
  const [size, setSize] = useState(null)
  const [cart, setCart] = useCart()
  const [wishlist, setWishlist] = useWishlist()
  const can3D = !!p && has3D(p) && hasWebGL()
  const [tab, setTab] = useState(can3D ? '3d' : 'photos')
  const guide = useRef()

  if (!p) {
    return (
      <div className="page empty">
        <div className="glyph" aria-hidden="true">?</div>
        <h1>Product not found</h1>
        <p>This product ID is not in the ORI demo catalog.</p>
        <div className="row"><Link className="btn primary" to="/collection">Back to collection</Link><Link className="btn" to="/verify">Verify an ID</Link></div>
      </div>
    )
  }

  const wished = wishlist.includes(p.id)
  const soldOut = p.stock === 0
  const inCart = cart.filter((i) => i.id === p.id).reduce((n, i) => n + i.qty, 0)
  const atLimit = inCart >= p.stock
  const related = [...products.filter((x) => x.brand === p.brand && x.id !== p.id), ...products.filter((x) => x.brand !== p.brand && has3D(x))].slice(0, 4)

  const add = () => {
    setCart((c) => addToCart(c, p.id, size))
    toast(`Added ${p.name} · ${isNaN(size) ? size : `EU ${size}`}`, { to: '/cart', label: 'View cart' })
  }
  const wish = () => {
    setWishlist((w) => toggleIn(w, p.id))
    toast(wished ? 'Removed from wishlist' : 'Saved to wishlist', wished ? null : { to: '/wishlist', label: 'Wishlist' })
  }

  return (
    <div className="page">
      <nav className="crumbs label" aria-label="Breadcrumb">
        <Link to="/collection">Collection</Link><span>/</span>
        <Link to={`/collection?brand=${encodeURIComponent(p.brand)}`}>{p.brand}</Link><span>/</span>
        <span aria-current="page">{p.name}</span>
      </nav>

      <div className="product">
        <div className="showcase">
          {can3D && (
            <div className="tabs" role="tablist" aria-label="Showcase mode">
              <button role="tab" aria-selected={tab === '3d'} onClick={() => setTab('3d')}>3D view</button>
              <button role="tab" aria-selected={tab === 'photos'} onClick={() => setTab('photos')}>Photos</button>
            </div>
          )}
          {can3D && tab === '3d' ? (
            <ErrorBoundary
              key={p.id}
              fallback={
                <div className="viewer-error">
                  <div className="note"><span>Unable to load 3D preview.</span><button className="link" onClick={() => setTab('photos')}>View product images</button></div>
                  <Gallery product={p} />
                </div>
              }
            >
              <Suspense fallback={<div className="viewer empty loading"><span className="label">Loading 3D experience</span><span className="bar indeterminate"><span /></span></div>}>
                <ProductViewer product={p} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <Gallery product={p} />
          )}
        </div>

        <div className="detail">
          <div className="label">{p.brand} · {p.category}</div>
          <h1>{p.name}</h1>
          <p className="price">{rupiah(p.price)}</p>
          <p className="muted">{p.description}</p>

          <div className="size-row">
            <span className="label">{size ? `Size ${isNaN(size) ? size : `EU ${size}`}` : 'Select size'}</span>
            <button className="link" onClick={() => guide.current.showModal()}>Size guide</button>
          </div>
          <div className="sizes" role="group" aria-label="Available sizes">
            {p.sizes.map((s) => (
              <button key={s} aria-pressed={size === s} onClick={() => setSize(s)} disabled={soldOut}>{s}</button>
            ))}
          </div>
          <p className={`small ${p.stock > 0 && p.stock <= 3 ? 'stock-low' : ''}`}>{stockText(p.stock)}{inCart ? ` · ${inCart} in your cart` : ''}</p>

          <div className="actions">
            <button className="btn primary" disabled={!size || soldOut || atLimit} onClick={add}>
              {soldOut ? 'Out of stock' : atLimit ? 'All stock in your cart' : size ? 'Add to cart' : 'Select a size'}
            </button>
            <button className="btn heart-btn" onClick={wish} aria-pressed={wished} aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}>
              <Heart />
            </button>
            <Link className="btn wide" to={`/verify/${p.id}`}>Verify product</Link>
          </div>

          <dl className="specs">
            <dt>Condition</dt><dd>{p.condition === 'BNIB' ? 'BNIB · Brand new in box' : p.condition}</dd>
            <dt>Color</dt><dd>{p.color}</dd>
            <dt>Product ID</dt><dd className="mono">{p.id}</dd>
            <dt>Showcase</dt><dd>{has3D(p) ? 'Interactive 3D + photos' : 'Photos only'}</dd>
          </dl>

          <div className="qr-row">
            <QRCodeSVG value={verifyUrl(p.id)} size={84} bgColor="#F5F5F5" fgColor="#0A0A0A" />
            <div>
              <div className="label">ORI Verification</div>
              <p className="small">Scan with your phone camera to open this product's demo certificate.</p>
            </div>
          </div>
        </div>
      </div>

      <section className="related">
        <div className="section-head"><h2>You might also like</h2></div>
        <div className="grid">{related.map((r) => <ProductCard key={r.id} product={r} />)}</div>
      </section>
      <SizeGuide ref={guide} />
    </div>
  )
}
