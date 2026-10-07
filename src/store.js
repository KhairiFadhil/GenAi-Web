import { useEffect, useState } from 'react'
import products from './data/products.json'

export { products }
export const findProduct = (id) => products.find((p) => p.id === id?.trim().toUpperCase())
export const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function read(storage, key, initial) {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : initial
  } catch {
    return initial // corrupted / blocked storage must never crash the app
  }
}

// Same API as useState, persisted to storage and synced across every component using the same key.
export function useStoredState(key, initial, storage = localStorage) {
  const [value, setValue] = useState(() => read(storage, key, initial))

  useEffect(() => {
    const sync = (e) => e.detail === key && setValue(read(storage, key, initial))
    window.addEventListener('ori-storage', sync)
    return () => window.removeEventListener('ori-storage', sync)
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
export const useOrder = () => useStoredState('ori-order', null, sessionStorage)

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
