import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import { findProduct, products as catalog, rupiah } from '../store.js'
import './products-editor.css'

const ProductViewer = lazy(() => import('../components/ProductViewer.jsx'))

const CATEGORIES = ['Sneakers', 'Apparel', 'Accessories']
const CONDITIONS = [['BNIB', 'New in box'], ['Pre-Owned', 'Pre-owned']]
const PRESETS = {
  Sneakers: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  Apparel: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  Accessories: ['One size'],
}
// Procedural 3D silhouettes (src/three/models.js) and the catalog product whose full palette seeds each one
const SILHOUETTES = [
  ['af1', 'ORI-NK-AF1-001', 'Air Force 1'], ['aj1', 'ORI-NK-AJ1-001', 'Jordan 1 High'], ['samba', 'ORI-AD-SMB-001', 'Samba'],
  ['yeezy', 'ORI-AD-YZY-001', 'Boost 350'], ['nb550', 'ORI-NB-550-001', '550'], ['nb990', 'ORI-NB-990-001', '990'],
  ['chuck', 'ORI-CV-CHK-001', 'Chuck 70'], ['vans', 'ORI-VN-OSK-001', 'Old Skool'], ['mexico', 'ORI-OT-M66-001', 'Mexico 66'],
]
const MAIN_ROLES = [['base', 'Upper'], ['stripe', 'Stripe / logo'], ['mid', 'Midsole'], ['out', 'Outsole'], ['lace', 'Laces']]
const ANCHORS = ['toe', 'stitching', 'sole', 'heel', 'stripe', 'collar', 'tongue', 'laces']
const SECTION_OF = { brand: 'basics', name: 'basics', category: 'basics', condition: 'basics', color: 'basics', description: 'basics', price: 'pricing', stock: 'pricing', sizes: 'pricing', media: 'photos' }
const MAX_PHOTOS = 6

const template = (model) => catalog.find((p) => p.id === SILHOUETTES.find((s) => s[0] === model)?.[1])

function initial(row) {
  if (!row) {
    return { category: 'Sneakers', brand: '', name: '', condition: 'BNIB', color: '', description: '', price: '', stock: '0', sizes: [], active: false, photos: [], model3D: null, hotspots: [], swatch: '#8a8a8a' }
  }
  // Original catalog products keep photos/3D in products.json until edited here
  const json = findProduct(row.id)
  const m = row.media ?? {}
  return {
    category: row.category, brand: row.brand, name: row.name, condition: row.condition, color: row.color ?? '', description: row.description ?? '',
    price: String(row.price), stock: String(row.stock), sizes: row.sizes ?? [], active: row.active,
    photos: ('images' in m ? m.images : json?.images ?? []).map((url) => ({ key: url, url })),
    model3D: 'model3D' in m ? m.model3D : json?.model3D && typeof json.model3D === 'object' ? json.model3D : null,
    hotspots: 'hotspots' in m ? m.hotspots : json?.hotspots ?? [],
    swatch: m.swatch ?? json?.swatch ?? '#8a8a8a',
  }
}

const media = (f) => ({
  images: f.photos.map((p) => p.url ?? p.key),
  model3D: f.category === 'Sneakers' ? f.model3D : null,
  hotspots: f.category === 'Sneakers' && f.model3D ? f.hotspots : [],
  ...(f.category !== 'Sneakers' && { swatch: f.swatch }),
})

// Resize in the browser: longest side 1400px, WebP
async function toWebp(file) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/webp', 0.86))
}

async function upload(id, blob) {
  const r = await fetch(`/api/admin/media?product=${encodeURIComponent(id)}`, { method: 'POST', headers: { 'content-type': blob.type }, body: blob, credentials: 'same-origin' })
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new Error(d?.error === 'too_large' ? 'Photo is larger than 2.5 MB' : d?.error === 'not_an_image' ? 'Not a valid image' : 'Upload failed')
  return d.url
}

function Field({ label, error, hint, children, wide }) {
  return (
    <label className={`pe-field ${wide ? 'wide' : ''}`}>
      <span className="adm-label">{label}</span>
      {children}
      {error ? <span className="pe-err">{error}</span> : hint ? <span className="pe-hint">{hint}</span> : null}
    </label>
  )
}

function Basics({ f, set, errors, brands, edit }) {
  return (
    <div className="pe-grid">
      <div className="pe-field wide">
        <span className="adm-label">Category</span>
        <div className="pe-seg" role="radiogroup" aria-label="Category">
          {CATEGORIES.map((c) => (
            <button type="button" key={c} role="radio" aria-checked={f.category === c} onClick={() => set({ category: c, sizes: c === f.category ? f.sizes : [] })}>{c}</button>
          ))}
        </div>
        {errors.category && <span className="pe-err">{errors.category}</span>}
      </div>
      <Field label="Brand" error={errors.brand}>
        <input className="adm-input" list="pe-brands" value={f.brand} onChange={(e) => set({ brand: e.target.value })} maxLength={40} placeholder="e.g. Nike" />
        <datalist id="pe-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
      </Field>
      <Field label="Product name" error={errors.name}>
        <input className="adm-input" value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} placeholder="e.g. Dunk Low Panda" />
      </Field>
      <div className="pe-field">
        <span className="adm-label">Condition</span>
        <div className="pe-seg" role="radiogroup" aria-label="Condition">
          {CONDITIONS.map(([v, l]) => <button type="button" key={v} role="radio" aria-checked={f.condition === v} onClick={() => set({ condition: v })}>{l}</button>)}
        </div>
        {errors.condition && <span className="pe-err">{errors.condition}</span>}
      </div>
      <Field label="Colorway" error={errors.color} hint="Shown on the product page">
        <input className="adm-input" value={f.color} onChange={(e) => set({ color: e.target.value })} maxLength={40} placeholder="e.g. Black / White" />
      </Field>
      <Field label="Description" error={errors.description} hint={`${f.description.length}/600`} wide>
        <textarea className="adm-input" rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={600} placeholder="Materials, fit, story…" />
      </Field>
      {edit && (
        <div className="pe-field wide pe-switchrow">
          <div><span className="adm-label">Visible in store</span><span className="pe-hint">{f.active ? 'Customers can find and buy it' : 'Hidden from the storefront'}</span></div>
          <button type="button" role="switch" aria-checked={f.active} aria-label="Visible in store" className="pr-switch" onClick={() => set({ active: !f.active })}><span className="knob" /></button>
        </div>
      )}
    </div>
  )
}

function Pricing({ f, set, errors }) {
  const [custom, setCustom] = useState('')
  const toggle = (s) => set({ sizes: f.sizes.includes(s) ? f.sizes.filter((x) => x !== s) : [...f.sizes, s] })
  const preset = PRESETS[f.category]
  const extra = f.sizes.filter((s) => !preset.includes(s))
  const add = () => {
    const s = custom.trim()
    if (s && s.length <= 8 && !f.sizes.includes(s)) set({ sizes: [...f.sizes, s] })
    setCustom('')
  }
  return (
    <div className="pe-grid">
      <Field label="Price" error={errors.price} hint={/^\d+$/.test(f.price) && +f.price > 0 ? rupiah(+f.price) : 'Whole rupiah'}>
        <span className="pr-affix"><span>Rp</span><input inputMode="numeric" value={f.price} onChange={(e) => set({ price: e.target.value.replace(/\D/g, '') })} placeholder="1599000" /></span>
      </Field>
      <Field label="Stock" error={errors.stock} hint="Total units across all sizes">
        <span className="pr-stepper">
          <button type="button" onClick={() => set({ stock: String(Math.max(0, (+f.stock || 0) - 1)) })} aria-label="Decrease stock">−</button>
          <input inputMode="numeric" value={f.stock} onChange={(e) => set({ stock: e.target.value.replace(/\D/g, '') })} />
          <button type="button" onClick={() => set({ stock: String(Math.min(100000, (+f.stock || 0) + 1)) })} aria-label="Increase stock">+</button>
        </span>
      </Field>
      <div className="pe-field wide">
        <span className="adm-label">Sizes {f.category === 'Sneakers' ? '(EU)' : ''}</span>
        <div className="pe-chips">
          {[...preset, ...extra].map((s) => (
            <button type="button" key={s} className="pe-chip" aria-pressed={f.sizes.includes(s)} onClick={() => toggle(s)}>{s}</button>
          ))}
          <span className="pe-addsize">
            <input className="adm-input" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} maxLength={8} placeholder="Other size" aria-label="Custom size" />
            <button type="button" className="adm-btn" onClick={add} disabled={!custom.trim()}>Add</button>
          </span>
        </div>
        {errors.sizes ? <span className="pe-err">{errors.sizes}</span> : <span className="pe-hint">{f.sizes.length} selected</span>}
      </div>
    </div>
  )
}

function Photos({ f, set, errors }) {
  const input = useRef()
  const [drag, setDrag] = useState(false)
  const [note, setNote] = useState(null)

  const add = async (files) => {
    setNote(null)
    const room = MAX_PHOTOS - f.photos.length
    const list = [...files].filter((x) => x.type.startsWith('image/')).slice(0, room)
    if (!list.length) return setNote(room ? 'Choose image files (JPG, PNG, WebP).' : `Up to ${MAX_PHOTOS} photos.`)
    const added = []
    for (const file of list) {
      try {
        const blob = await toWebp(file)
        added.push({ key: crypto.randomUUID(), blob, preview: URL.createObjectURL(blob), size: blob.size })
      } catch {
        setNote(`Could not read ${file.name}.`)
      }
    }
    set({ photos: [...f.photos, ...added] })
  }
  const move = (i, d) => {
    const next = [...f.photos]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    set({ photos: next })
  }

  return (
    <div className="pe-photos">
      <div
        className={`pe-drop ${drag ? 'over' : ''}`}
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => (e.preventDefault(), setDrag(false), add(e.dataTransfer.files))}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 16V4m0 0l-4 4m4-4l4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
        <p>Drag photos here or <button type="button" className="adm-link" onClick={() => input.current.click()}>browse</button></p>
        <span className="pe-hint">Up to {MAX_PHOTOS} photos · resized to WebP in your browser · first photo is the cover</span>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
      </div>
      {(note || errors.media) && <p className="pe-err">{note ?? errors.media}</p>}
      {f.photos.length > 0 && (
        <ol className="pe-thumbs">
          {f.photos.map((p, i) => (
            <li key={p.key} className={p.status ?? ''}>
              <img src={p.preview ?? p.url} alt={`Photo ${i + 1}`} />
              {i === 0 && <span className="pe-cover">Cover</span>}
              {p.status === 'uploading' && <span className="pe-up"><span className="pr-spin" /></span>}
              {p.status === 'error' && <span className="pe-up bad">!</span>}
              <div className="pe-thumb-actions">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier">←</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === f.photos.length - 1} aria-label="Move later">→</button>
                <button type="button" onClick={() => set({ photos: f.photos.filter((x) => x !== p) })} aria-label={`Remove photo ${i + 1}`}>×</button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Showcase({ f, set }) {
  if (f.category !== 'Sneakers') {
    return (
      <div className="pe-grid">
        <Field label="Shelf color" hint="Color of the folded item on the 3D brand shelf">
          <span className="pe-color"><input type="color" value={f.swatch} onChange={(e) => set({ swatch: e.target.value })} /><span className="mono">{f.swatch}</span></span>
        </Field>
        <p className="pe-hint wide">3D models are available for sneakers. Apparel and accessories show photos on the product page.</p>
      </div>
    )
  }
  const pick = (model) => {
    if (!model) return set({ model3D: null, hotspots: [] })
    const t = template(model)
    set({ model3D: { model, colors: { ...t.model3D.colors } }, hotspots: (t.hotspots ?? []).map((h) => ({ ...h })) })
  }
  const roles = f.model3D ? MAIN_ROLES.filter(([r]) => r in f.model3D.colors) : []
  const setColor = (r, v) => set({ model3D: { ...f.model3D, colors: { ...f.model3D.colors, [r]: v } } })
  const setHot = (i, patch) => set({ hotspots: f.hotspots.map((h, j) => (j === i ? { ...h, ...patch } : h)) })

  return (
    <div className="pe-show">
      <div className="pe-sil" role="radiogroup" aria-label="3D silhouette">
        <button type="button" role="radio" aria-checked={!f.model3D} className="pe-sil-card none" onClick={() => pick(null)}>
          <span className="pe-sil-img">2D</span><span>Photos only</span>
        </button>
        {SILHOUETTES.map(([model, id, label]) => {
          const t = findProduct(id)
          return (
            <button type="button" key={model} role="radio" aria-checked={f.model3D?.model === model} className="pe-sil-card" onClick={() => pick(model)}>
              <span className="pe-sil-img">{t?.images?.[0] ? <img src={t.images[0]} alt="" /> : null}</span>
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {f.model3D && (
        <div className="pe-3d">
          <div className="pe-preview">
            <ErrorBoundary key={f.model3D.model} fallback={<p className="pe-hint">3D preview unavailable on this device.</p>}>
              <Suspense fallback={<div className="pe-loading"><span className="pr-spin" /> Loading 3D preview</div>}>
                <ProductViewer product={{ id: 'preview', name: f.name || 'Preview', model3D: f.model3D, hotspots: f.hotspots, images: [] }} />
              </Suspense>
            </ErrorBoundary>
          </div>
          <div className="pe-3d-side">
            <span className="adm-label">Colors</span>
            <div className="pe-colors">
              {roles.map(([r, label]) => (
                <label key={r} className="pe-color">
                  <input type="color" value={f.model3D.colors[r]} onChange={(e) => setColor(r, e.target.value)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <span className="adm-label">Hotspots <span className="pe-hint">({f.hotspots.length}/6)</span></span>
            <ol className="pe-hots">
              {f.hotspots.map((h, i) => (
                <li key={i}>
                  <select className="adm-input" value={h.at} onChange={(e) => setHot(i, { at: e.target.value })} aria-label={`Hotspot ${i + 1} position`}>
                    {ANCHORS.map((a) => <option key={a}>{a}</option>)}
                  </select>
                  <input className="adm-input" value={h.label} onChange={(e) => setHot(i, { label: e.target.value })} maxLength={40} placeholder="Label" aria-label={`Hotspot ${i + 1} label`} />
                  <input className="adm-input wide" value={h.description ?? ''} onChange={(e) => setHot(i, { description: e.target.value })} maxLength={200} placeholder="Short detail (optional)" aria-label={`Hotspot ${i + 1} detail`} />
                  <button type="button" className="pe-x" onClick={() => set({ hotspots: f.hotspots.filter((_, j) => j !== i) })} aria-label={`Remove hotspot ${i + 1}`}>×</button>
                </li>
              ))}
            </ol>
            {f.hotspots.length < 6 && <button type="button" className="adm-btn" onClick={() => set({ hotspots: [...f.hotspots, { at: 'toe', label: 'Detail' }] })}>Add hotspot</button>}
          </div>
        </div>
      )}
    </div>
  )
}

function Review({ f }) {
  const cover = f.photos[0]
  return (
    <div className="pe-review">
      <div className="pe-review-img">{cover ? <img src={cover.preview ?? cover.url} alt="" /> : <span>No photo</span>}</div>
      <dl className="adm-dl">
        <dt>Product</dt><dd>{f.brand || '—'} · {f.name || '—'}</dd>
        <dt>Category</dt><dd>{f.category} · {f.condition}</dd>
        <dt>Price</dt><dd>{/^\d+$/.test(f.price) ? rupiah(+f.price) : '—'}</dd>
        <dt>Stock</dt><dd>{f.stock || 0} units</dd>
        <dt>Sizes</dt><dd>{f.sizes.join(', ') || '—'}</dd>
        <dt>Photos</dt><dd>{f.photos.length}</dd>
        <dt>3D</dt><dd>{f.model3D ? `${SILHOUETTES.find((s) => s[0] === f.model3D.model)[2]} silhouette · ${f.hotspots.length} hotspots` : 'Photos only'}</dd>
      </dl>
      <p className="pe-hint">The product ID is generated from brand and name. Publish now, or create it hidden and review it first.</p>
    </div>
  )
}

/** Create (row = null) or edit a product. onDone(id, message?) after a successful save/delete. */
export default function ProductEditor({ row, brands, onClose, onDone }) {
  const ref = useRef()
  const nav = useRef()
  const edit = !!row
  const start = useMemo(() => initial(row), [row])
  const [f, setF] = useState(start)
  const [section, setSection] = useState('basics')
  const [visited, setVisited] = useState(['basics'])
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [ask, setAsk] = useState(null) // 'close' | 'delete'
  const [createdId, setCreatedId] = useState(null) // create succeeded but a photo upload failed: retry updates it

  const set = (patch) => {
    setF((x) => ({ ...x, ...patch }))
    setMsg(null) // editing clears the banner and the touched fields' errors
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch) && !(k === 'media' && ('photos' in patch || 'model3D' in patch)))))
  }
  const dirty = JSON.stringify({ ...f, photos: f.photos.map((p) => p.key) }) !== JSON.stringify({ ...start, photos: start.photos.map((p) => p.key) })
  const mediaDirty = JSON.stringify(media(f)) !== JSON.stringify(media(start)) || f.photos.some((p) => p.blob)

  const sections = [
    ['basics', 'Basics'],
    ['pricing', edit ? 'Stock & price' : 'Price & sizes'],
    ['photos', 'Photos'],
    ['showcase', f.category === 'Sneakers' ? '3D showcase' : 'Showcase'],
    ...(edit ? [] : [['review', 'Review']]),
  ]
  const idx = sections.findIndex(([k]) => k === section)
  const go = (k) => (setSection(k), setVisited((v) => (v.includes(k) ? v : [...v, k])))

  // keep the active step visible when the step bar scrolls (phones, error dots)
  useEffect(() => nav.current?.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }), [section])

  useEffect(() => {
    ref.current.showModal()
    return () => f.photos.forEach((p) => p.preview && URL.revokeObjectURL(p.preview))
  }, [])

  const close = () => (dirty && !busy ? setAsk('close') : ref.current.close())

  const fail = (r, fallback) => {
    const fields = r.data?.fields ?? {}
    setErrors(fields)
    const first = Object.keys(fields)[0]
    if (first) go(SECTION_OF[first] ?? 'basics')
    setMsg(r.offline ? 'The database is not reachable.' : Object.keys(fields).length ? 'Please fix the highlighted fields.' : fallback)
  }

  // Upload new photos (product must exist), keeping the order; returns media or null on failure
  const uploadPhotos = async (id) => {
    const photos = [...f.photos]
    for (let i = 0; i < photos.length; i++) {
      if (!photos[i].blob) continue
      photos[i] = { ...photos[i], status: 'uploading' }
      set({ photos: [...photos] })
      try {
        photos[i] = { key: photos[i].key, url: await upload(id, photos[i].blob), preview: photos[i].preview }
      } catch (e) {
        photos[i] = { ...photos[i], status: 'error' }
        set({ photos: [...photos] })
        setMsg(`${e.message}. Remove that photo or try again.`)
        return null
      }
      set({ photos: [...photos] })
    }
    return media({ ...f, photos })
  }

  const fields = () => ({
    brand: f.brand, name: f.name, category: f.category, condition: f.condition, color: f.color.trim() || null,
    description: f.description.trim() || null, price: /^\d+$/.test(f.price) ? +f.price : null, stock: /^\d+$/.test(f.stock) ? +f.stock : null, sizes: f.sizes,
  })

  const save = async (publish) => {
    setBusy(true)
    setErrors({})
    setMsg(null)
    let id = row?.id ?? createdId
    if (!id) {
      const r = await api('admin/products', { body: { action: 'create', ...fields(), active: false } })
      if (!r.ok) return setBusy(false), fail(r, 'Could not create the product.')
      id = r.data.id
      setCreatedId(id)
    }
    const m = mediaDirty || !edit ? await uploadPhotos(id) : undefined
    if (m === null) return setBusy(false)
    const body = edit ? { id, ...fields(), active: f.active, ...(m && { media: m }) } : { id, ...fields(), media: m, active: publish }
    const r = await api('admin/products', { body })
    setBusy(false)
    if (!r.ok) return fail(r, 'Could not save the product.')
    ref.current.close()
    onDone(id)
  }

  const remove = async (hide) => {
    setBusy(true)
    const r = await api('admin/products', { body: hide ? { id: row.id, active: false } : { action: 'delete', id: row.id } })
    setBusy(false)
    if (!r.ok) return setMsg(r.data?.reason === 'has_orders' ? 'This product has orders, so it can only be hidden.' : 'Could not complete that.')
    ref.current.close()
    onDone(row.id, hide ? 'Product hidden from the store' : 'Product deleted')
  }

  const body = {
    basics: <Basics f={f} set={set} errors={errors} brands={brands} edit={edit} />,
    pricing: <Pricing f={f} set={set} errors={errors} />,
    photos: <Photos f={f} set={set} errors={errors} />,
    showcase: <Showcase f={f} set={set} />,
    review: <Review f={f} />,
  }[section]

  return (
    <dialog
      ref={ref}
      className="pr-dialog pe-dialog"
      onClose={onClose}
      onCancel={(e) => { if (dirty && !busy) { e.preventDefault(); setAsk('close') } }}
      onClick={(e) => e.target === ref.current && close()}
      aria-labelledby="pe-title"
    >
      <div className="pe-shell">
        <header className="pe-head">
          <div>
            <div className="adm-label">{edit ? <>{row.brand} · <span className="mono">{row.id}</span></> : 'Catalog · new product'}</div>
            <h2 id="pe-title">{edit ? row.name : 'Add product'}</h2>
          </div>
          <button type="button" className="pr-x" onClick={close} aria-label="Close">×</button>
        </header>

        <nav ref={nav} className={`pe-steps ${edit ? 'tabs' : ''}`} aria-label={edit ? 'Edit sections' : 'Steps'}>
          {sections.map(([k, label], i) => (
            <button type="button" key={k} aria-current={section === k ? 'step' : undefined} className={visited.includes(k) ? 'seen' : ''} onClick={() => go(k)}>
              {!edit && <span className="n">{i + 1}</span>}<span className="lbl">{label}</span>
              {Object.keys(errors).some((e) => (SECTION_OF[e] ?? 'basics') === k) && <span className="dot" aria-label="has errors" />}
            </button>
          ))}
        </nav>

        <div className="pe-body" key={section}>{body}</div>

        {msg && <p className="pr-error" role="alert">{msg}</p>}

        <footer className="pe-foot">
          {ask === 'close' ? (
            <div className="pe-ask">
              <span>Discard unsaved changes?</span>
              <button type="button" className="adm-btn danger" onClick={() => ref.current.close()}>Discard</button>
              <button type="button" className="adm-btn" onClick={() => setAsk(null)}>Keep editing</button>
            </div>
          ) : ask === 'delete' ? (
            <div className="pe-ask">
              {row.has_orders ? (
                <>
                  <span>This product has orders, so it can't be deleted. Hide it from the store instead?</span>
                  <button type="button" className="adm-btn primary" disabled={busy} onClick={() => remove(true)}>Hide product</button>
                </>
              ) : (
                <>
                  <span>Delete permanently, with its photos?</span>
                  <button type="button" className="adm-btn danger solid" disabled={busy} onClick={() => remove(false)}>Delete</button>
                </>
              )}
              <button type="button" className="adm-btn" onClick={() => setAsk(null)}>Cancel</button>
            </div>
          ) : (
            <>
              <div className="adm-row">
                {edit ? (
                  <button type="button" className="adm-btn danger" onClick={() => setAsk('delete')}>Delete</button>
                ) : idx > 0 && <button type="button" className="adm-btn" onClick={() => go(sections[idx - 1][0])}>Back</button>}
              </div>
              <div className="adm-row">
                {edit ? (
                  <>
                    <button type="button" className="adm-btn" onClick={close}>Cancel</button>
                    <button type="button" className="adm-btn primary" disabled={!dirty || busy} onClick={() => save()}>
                      {busy ? <><span className="pr-spin" /> Saving</> : 'Save changes'}
                    </button>
                  </>
                ) : section !== 'review' ? (
                  <button type="button" className="adm-btn primary" onClick={() => go(sections[idx + 1][0])}>Next</button>
                ) : (
                  <>
                    <button type="button" className="adm-btn" disabled={busy} onClick={() => save(false)}>Create as hidden</button>
                    <button type="button" className="adm-btn primary" disabled={busy} onClick={() => save(true)}>
                      {busy ? <><span className="pr-spin" /> Creating</> : 'Create & publish'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </footer>
      </div>
    </dialog>
  )
}
