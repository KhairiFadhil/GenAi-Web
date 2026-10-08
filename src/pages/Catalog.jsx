import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard.jsx'
import { Search } from '../components/Icons.jsx'
import { allSizes, brands, categories, has3D, products } from '../store.js'

const conditions = [...new Set(products.map((p) => p.condition))]
const PRICES = { '': 'Any price', '0-1500000': 'Under Rp1,5 jt', '1500000-3000000': 'Rp1,5 – 3 jt', '3000000-99999999': 'Over Rp3 jt' }
const KEYS = ['q', 'brand', 'category', 'size', 'condition', 'price', 'sort', '3d']

export default function Catalog() {
  // Filters live in the URL so the shelf and footer can deep-link (/collection?brand=Nike)
  const [params, setParams] = useSearchParams()
  const f = Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? '']))
  const update = (k, value) => {
    const next = new URLSearchParams(params)
    value ? next.set(k, value) : next.delete(k)
    setParams(next, { replace: true })
  }
  const on = (k) => (e) => update(k, e.target.type === 'checkbox' ? (e.target.checked ? '1' : '') : e.target.value)
  const [min, max] = f.price ? f.price.split('-').map(Number) : [0, Infinity]
  const q = f.q.trim().toLowerCase()
  const active = KEYS.filter((k) => k !== 'sort' && f[k]).length

  const list = products
    .filter((p) => !q || `${p.brand} ${p.name} ${p.color} ${p.id}`.toLowerCase().includes(q))
    .filter((p) => !f.brand || p.brand === f.brand)
    .filter((p) => !f.category || p.category === f.category)
    .filter((p) => !f.size || p.sizes.includes(f.size))
    .filter((p) => !f.condition || p.condition === f.condition)
    .filter((p) => !f['3d'] || has3D(p))
    .filter((p) => p.price >= min && p.price < max)
    .sort((a, b) => (f.sort === 'asc' ? a.price - b.price : f.sort === 'desc' ? b.price - a.price : f.sort === 'name' ? a.name.localeCompare(b.name) : 0))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label">Collection{f.category ? ` · ${f.category}` : ''}</div>
          <h1>{f.brand || 'All products'}</h1>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Brand">
        <button className="chip" aria-pressed={!f.brand} onClick={() => update('brand', '')}>All brands</button>
        {brands.map((b) => (
          <button key={b} className="chip" aria-pressed={f.brand === b} onClick={() => update('brand', f.brand === b ? '' : b)}>{b}</button>
        ))}
      </div>

      <div className="toolbar">
        <label className="search">
          <Search />
          <span className="sr-only">Search products</span>
          <input type="search" placeholder="Search name, color or product ID" value={f.q} onChange={on('q')} />
        </label>
        <select value={f.category} onChange={on('category')} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={f.size} onChange={on('size')} aria-label="Size">
          <option value="">Any size</option>
          {allSizes.map((s) => <option key={s} value={s}>{isNaN(s) ? s : `EU ${s}`}</option>)}
        </select>
        <select value={f.price} onChange={on('price')} aria-label="Price">
          {Object.entries(PRICES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={f.condition} onChange={on('condition')} aria-label="Condition">
          <option value="">Any condition</option>
          {conditions.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="result-bar">
        <div className="row">
          <span className="label" aria-live="polite">{list.length} {list.length === 1 ? 'product' : 'products'}</span>
          {active > 0 && <button className="link" onClick={() => setParams({}, { replace: true })}>Clear {active} {active === 1 ? 'filter' : 'filters'}</button>}
        </div>
        <div className="row">
          <label className="toggle"><input type="checkbox" checked={!!f['3d']} onChange={on('3d')} /> 3D showcase only</label>
          <select value={f.sort} onChange={on('sort')} aria-label="Sort">
            <option value="">Featured</option>
            <option value="asc">Price: low to high</option>
            <option value="desc">Price: high to low</option>
            <option value="name">Name: A–Z</option>
          </select>
        </div>
      </div>

      <h2 className="sr-only">Products</h2>
      {list.length ? (
        <div className="grid">{list.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      ) : (
        <div className="empty">
          <p>No products match these filters.</p>
          <button className="btn" onClick={() => setParams({}, { replace: true })}>Clear filters</button>
        </div>
      )}
    </div>
  )
}
