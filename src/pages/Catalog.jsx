import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { products } from '../store.js'

const unique = (xs) => [...new Set(xs)]
const brands = unique(products.map((p) => p.brand))
const sizes = unique(products.flatMap((p) => p.sizes))
const conditions = unique(products.map((p) => p.condition))
const PRICES = { '': 'Any price', '0-1500000': '< Rp1,5jt', '1500000-3000000': 'Rp1,5jt – 3jt', '3000000-99999999': '> Rp3jt' }

export default function Catalog() {
  // Filters live in the URL so the 3D shelf / links can deep-link (e.g. /collection?brand=Nike).
  const [params, setParams] = useSearchParams()
  const f = Object.fromEntries(['q', 'brand', 'size', 'condition', 'price', 'sort'].map((k) => [k, params.get(k) ?? '']))
  const set = (k) => (e) => {
    const next = new URLSearchParams(params)
    e.target.value ? next.set(k, e.target.value) : next.delete(k)
    setParams(next, { replace: true })
  }
  const [min, max] = f.price ? f.price.split('-').map(Number) : [0, Infinity]
  const q = f.q.toLowerCase()

  const list = products
    .filter((p) => !q || `${p.brand} ${p.name}`.toLowerCase().includes(q))
    .filter((p) => !f.brand || p.brand === f.brand)
    .filter((p) => !f.size || p.sizes.includes(f.size))
    .filter((p) => !f.condition || p.condition === f.condition)
    .filter((p) => p.price >= min && p.price < max)
    .sort((a, b) => (f.sort === 'asc' ? a.price - b.price : f.sort === 'desc' ? b.price - a.price : 0))

  const select = (k, label, options) => (
    <select value={f[k]} onChange={set(k)} aria-label={label}>
      <option value="">{label}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <div className="page">
      <div className="label">Collection</div>
      <h1>All products</h1>
      <div className="filters">
        <input type="search" placeholder="Search…" value={f.q} onChange={set('q')} />
        {select('brand', 'All brands', brands)}
        {select('size', 'Any size', sizes)}
        {select('condition', 'Any condition', conditions)}
        <select value={f.price} onChange={set('price')} aria-label="Price">
          {Object.entries(PRICES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={f.sort} onChange={set('sort')} aria-label="Sort">
          <option value="">Featured</option>
          <option value="asc">Price: low → high</option>
          <option value="desc">Price: high → low</option>
        </select>
      </div>
      {list.length ? (
        <div className="grid">{list.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      ) : (
        <div className="empty"><p>No products match these filters.</p><button className="btn" onClick={() => setParams({})}>Clear filters</button></div>
      )}
    </div>
  )
}
