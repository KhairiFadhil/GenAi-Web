import { useState } from 'react'

// Product photo with a labeled placeholder if it fails to load
export default function ProductImage({ product: p, src = p.images[0], alt = p.name, hover, eager = false }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className="img">
      {broken || !src ? (
        <span>{p.brand}<br />{p.name}</span>
      ) : (
        <>
          <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setBroken(true)} />
          {hover && <img className="alt" src={hover} alt="" loading="lazy" decoding="async" />}
        </>
      )}
    </div>
  )
}
