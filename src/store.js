import { useEffect, useState } from 'react'
import products from './data/products.json'

export { products }
export const brands = [...new Set(products.map((p) => p.brand))]
export const categories = [...new Set(products.map((p) => p.category))]
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const sizeRank = (s) => (isNaN(s) ? 100 + SIZE_ORDER.indexOf(s) : Number(s))
export const allSizes = [...new Set(products.flatMap((p) => p.sizes))].sort((a, b) => sizeRank(a) - sizeRank(b))
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

export const orderNumber = () =>
  'ORI-DEMO-' + Math.random().toString(36).slice(2, 7).toUpperCase().padEnd(5, '0')
