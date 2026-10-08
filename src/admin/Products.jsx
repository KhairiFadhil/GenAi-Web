import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import ProductImage from '../components/ProductImage.jsx'
import { findProduct, rupiah, toast } from '../store.js'
import ProductEditor from './ProductEditor.jsx'
import { Gate, PageHead, useLoad, when } from './ui.jsx'

const LOW = 3
const FILTERS = [
  ['all', 'All', () => true],
  ['listed', 'Listed', (p) => p.active],
  ['hidden', 'Hidden', (p) => !p.active],
  ['low', 'Low stock', (p) => p.active && p.stock <= LOW],
]

const Pencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="M13.5 6.5l4 4" />
  </svg>
)

// Admin-uploaded cover first, then the catalog photo from products.json
function Thumb({ row }) {
  const cover = row.media?.images?.[0]
  const p = findProduct(row.id)
  return <span className="pr-thumb">{cover ? <img src={cover} alt="" /> : p ? <ProductImage product={p} /> : <span className="img" />}</span>
}

function Switch({ checked, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="pr-switch" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="knob" />
    </button>
  )
}

function StockMeter({ stock }) {
  const tone = stock === 0 ? 'out' : stock <= LOW ? 'low' : 'ok'
  return (
    <span className={`pr-stock ${tone}`}>
      <span className="pr-stock-num">{stock === 0 ? 'Sold out' : stock}</span>
      <span className="pr-bar"><span style={{ width: `${Math.min(stock / 20, 1) * 100}%` }} /></span>
    </span>
  )
}

export default function Products() {
  const state = useLoad('admin/products')
  const [saved, setSaved] = useState({}) // rows updated since load, by id
  const [flash, setFlash] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | product row
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [toggling, setToggling] = useState(null)

  const apply = (p) => {
    setSaved((s) => ({ ...s, [p.id]: p }))
    setFlash(p.id)
    setTimeout(() => setFlash((f) => (f === p.id ? null : f)), 1200)
  }

  const toggle = async (p, active) => {
    setToggling(p.id)
    apply({ ...p, active }) // optimistic
    const r = await api('admin/products', { body: { id: p.id, active } })
    setToggling(null)
    if (!r.ok) {
      apply(p)
      return toast('Could not update visibility')
    }
    apply({ ...p, ...r.data })
    toast(`${p.name} is now ${active ? 'listed' : 'hidden'}`)
  }

  return (
    <Gate state={state}>
      {({ items: raw }) => {
        const items = raw.map((it) => saved[it.id] ?? it)
        const counts = Object.fromEntries(FILTERS.map(([k, , fn]) => [k, items.filter(fn).length]))
        const needle = q.trim().toLowerCase()
        const shown = items
          .filter(FILTERS.find(([k]) => k === filter)[2])
          .filter((p) => !needle || `${p.name} ${p.brand} ${p.id}`.toLowerCase().includes(needle))

        return (
          <>
            <PageHead title="Products" sub="Catalog · price & stock">
              <div className="pr-headside">
                <div className="pr-summary">
                  <span><b>{items.length}</b> products</span>
                  <span><b>{counts.listed}</b> listed</span>
                  <span className={counts.low ? 'warn' : ''}><b>{counts.low}</b> low stock</span>
                </div>
                <button className="adm-btn primary pe-add" onClick={() => setEditing('new')}>+ Add product</button>
              </div>
            </PageHead>

            <div className="pr-toolbar">
              <label className="pr-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
                <span className="sr-only">Search products</span>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, brand or ID" />
              </label>
              <div className="pr-seg" role="tablist" aria-label="Filter products">
                {FILTERS.map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>
                    {label}<span className="adm-count">{counts[k]}</span>
                  </button>
                ))}
              </div>
            </div>

            <section className="adm-card flush pr-list" aria-label="Products">
              <div className="pr-row pr-headrow" aria-hidden="true">
                <span>Product</span><span>Category</span><span className="r">Price</span><span>Stock</span><span className="r">Sold 30d</span><span>Store</span><span />
              </div>
              {shown.length === 0 && <p className="adm-empty pr-none">No products match.</p>}
              {shown.map((p, i) => (
                <div key={p.id} className={`pr-row ${p.active ? '' : 'off'} ${flash === p.id ? 'flash' : ''}`} style={{ '--i': Math.min(i, 12) }}>
                  <div className="pr-product">
                    <Thumb row={p} />
                    <div>
                      <Link className="pr-name" to={`/product/${p.id}`} target="_blank" rel="noreferrer">{p.name}</Link>
                      <div className="adm-muted">{p.brand} · <span className="mono">{p.id}</span></div>
                    </div>
                  </div>
                  <div className="pr-cat"><span className="pr-pill">{p.category}</span><span className="adm-muted">{p.condition}</span></div>
                  <div className="pr-price r"><span className="mono">{rupiah(p.price)}</span></div>
                  <div className="pr-stockcell"><StockMeter stock={p.stock} /></div>
                  <div className="pr-sold r"><span className="mono">{p.sold_30d}</span><span className="adm-muted pr-sold-label"> sold</span></div>
                  <div className="pr-store">
                    <Switch checked={p.active} disabled={toggling === p.id} onChange={(v) => toggle(p, v)} label={`${p.name} visible in store`} />
                    <span className="adm-muted">{p.active ? 'Listed' : 'Hidden'}</span>
                  </div>
                  <div className="pr-edit">
                    <button className="pr-edit-btn" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}><Pencil /><span>Edit</span></button>
                    <span className="adm-muted pr-updated">{when(p.updated_at)}</span>
                  </div>
                </div>
              ))}
            </section>
            <p className="adm-muted adm-note pr-foot">Photos, 3D models and descriptions live in <span className="mono">products.json</span>. Price, stock and visibility apply to the storefront immediately.</p>

            {editing && (
              <ProductEditor
                key={editing === 'new' ? 'new' : editing.id}
                row={editing === 'new' ? null : editing}
                brands={[...new Set(items.map((x) => x.brand))].sort()}
                onClose={() => setEditing(null)}
                onDone={(id, message) => {
                  toast(message ?? (editing === 'new' ? `Created ${id}` : 'Product saved'))
                  setSaved({})
                  state.reload()
                  setFlash(id)
                  setTimeout(() => setFlash((f) => (f === id ? null : f)), 1200)
                }}
              />
            )}
          </>
        )
      }}
    </Gate>
  )
}
