import { useState } from 'react'

// Shows the first product photo; until real images exist, a labeled placeholder.
export default function ProductImage({ product: p, src = p.images[0] }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className="img">
      {broken || !src ? (
        <span>{p.brand}<br />{p.name}</span>
      ) : (
        <img src={src} alt={p.name} loading="lazy" onError={() => setBroken(true)} />
      )}
    </div>
  )
}
