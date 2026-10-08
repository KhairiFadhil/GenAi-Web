import { useEffect, useState } from 'react'
import products from './data/products.json'
import { api } from './api.js'

export { products }
// Hidden in the admin = not shown in listings (still resolvable by id for carts and past orders)
export const listed = (p) => p.active !== false
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const sizeRank = (s) => (isNaN(s) ? 100 + SIZE_ORDER.indexOf(s) : Number(s))
// Live bindings: recomputed whenever the catalog changes, so importers always read current values
export let brands, categories, allSizes
function derive() {
  const live = products.filter(listed)
  brands = [...new Set(live.map((p) => p.brand))]
  categories = [...new Set(live.map((p) => p.category))]
  allSizes = [...new Set(live.flatMap((p) => p.sizes))].sort((a, b) => sizeRank(a) - sizeRank(b))
}
derive()
export const has3D = (p) => !!p.model3D
export const findProduct = (id) => products.find((p) => p.id === id?.trim().toUpperCase())
export const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

// Blocked storage falls back to memory for the session
const memory = new Map()
function safeStorage(name) {
  try {
    const s = window[name]
    s.getItem('ori')
    return s
  } catch {
    return { getItem: (k) => memory.get(name + k) ?? null, setItem: (k, v) => memory.set(name + k, v) }
  }
}
const local = safeStorage('localStorage')
const session = safeStorage('sessionStorage')

function read(storage, key, initial) {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : initial
  } catch {
    return initial // corrupted / blocked storage must never crash the app
  }
}

// Same API as useState, persisted to storage and synced across every component using the same key.
export function useStoredState(key, initial, storage = local) {
  const [value, setValue] = useState(() => read(storage, key, initial))

  useEffect(() => {
    const sync = (e) => (e.detail ?? e.key) === key && setValue(read(storage, key, initial))
    window.addEventListener('ori-storage', sync)
    window.addEventListener('storage', sync)
    return () => (window.removeEventListener('ori-storage', sync), window.removeEventListener('storage', sync))
  }, [key])

  const set = (next) => {
    const v = typeof next === 'function' ? next(read(storage, key, initial)) : next
    try { storage.setItem(key, JSON.stringify(v)) } catch {}
    setValue(v)
    window.dispatchEvent(new CustomEvent('ori-storage', { detail: key }))
  }
  return [value, set]
}

// Cart items are { id, size, qty }; name/price always come from products.json.
export const useCart = () => useStoredState('ori-cart', [])
export const useWishlist = () => useStoredState('ori-wishlist', [])
export const useOrder = () => useStoredState('ori-order', null, session)
export const useVerified = () => useStoredState('ori-verified', [], session)

export const toggleIn = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

// Fire-and-forget toast: toast('Added to cart', { to: '/cart', label: 'View cart' })
export const toast = (message, action) => window.dispatchEvent(new CustomEvent('ori-toast', { detail: { message, action, id: Date.now() } }))

export const cartTotal = (cart) =>
  cart.reduce((sum, item) => sum + (findProduct(item.id)?.price ?? 0) * item.qty, 0)

export function addToCart(cart, id, size) {
  const stock = findProduct(id).stock
  const hit = cart.find((i) => i.id === id && i.size === size)
  if (!hit) return [...cart, { id, size, qty: 1 }]
  return cart.map((i) => (i === hit ? { ...i, qty: Math.min(i.qty + 1, stock) } : i))
}

// Live price/stock applied onto the bundled catalog
export function applyInventory(items = []) {
  for (const it of items) {
    const p = products.find((x) => x.id === it.id)
    if (!p) continue
    if (Number.isInteger(it.stock)) p.stock = it.stock
    if (Number.isInteger(it.price)) p.price = it.price
  }
  window.dispatchEvent(new Event('ori-inventory'))
}

// Database catalog over the bundled one: live price/stock/visibility, admin-edited details,
// and products created in the admin (their photos, 3D spec and hotspots come in `media`)
const DETAILS = ['brand', 'name', 'category', 'condition', 'color', 'description', 'sizes', 'price', 'stock', 'active']
export let catalogVersion = 0
export function applyCatalog(items = []) {
  for (const it of items) {
    let p = products.find((x) => x.id === it.id)
    if (!p) products.push((p = { id: it.id, images: [], model3D: null, hotspots: [] }))
    for (const k of DETAILS) if (it[k] !== undefined && it[k] !== null) p[k] = it[k]
    const m = it.media ?? {}
    if (m.images?.length) p.images = m.images
    if ('model3D' in m) p.model3D = m.model3D
    if (m.hotspots) p.hotspots = m.hotspots
    if (m.swatch) p.swatch = m.swatch
  }
  derive()
  catalogVersion++
  window.dispatchEvent(new Event('ori-inventory'))
}

export async function syncInventory() {
  const r = await api('catalog')
  if (r.ok) applyCatalog(r.data.items)
}

export const orderNumber = () => {
  const d = new Date(), pad = (n) => String(n).padStart(2, '0')
  return `ORI-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` + Math.random().toString(36).slice(2, 7).toUpperCase().padEnd(5, '0')
}

// Signed-in account shared across the app: undefined while loading, null when signed out
// (or when there is no database: accounts need the backend).
let account
let loading
export function refreshAccount() {
  loading = api('auth/me').then((r) => {
    account = r.ok ? r.data.account : null
    window.dispatchEvent(new Event('ori-auth'))
    return account
  })
  return loading
}
export function setAccount(a) {
  account = a
  window.dispatchEvent(new Event('ori-auth'))
}
export function useAccount() {
  const [a, setA] = useState(account)
  useEffect(() => {
    const on = () => setA(account)
    window.addEventListener('ori-auth', on)
    if (account === undefined && !loading) refreshAccount()
    else on()
    return () => window.removeEventListener('ori-auth', on)
  }, [])
  return a
}
export async function logout() {
  await api('auth/logout', { body: {} })
  setAccount(null)
}
