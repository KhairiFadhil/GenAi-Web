import * as THREE from 'three'

// Procedural material maps, generated once per page

function dataTexture(size, fill, repeat = true) {
  const out = new Uint8Array(size * size * 4)
  fill(out)
  const t = new THREE.DataTexture(out, size, size)
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

// Height field (wrapping) -> tangent-space normal map
function normalFromHeight(h, size, strength) {
  const H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)]
  const n = new THREE.Vector3()
  return dataTexture(size, (out) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      n.set(-(H(x + 1, y) - H(x - 1, y)) * strength, -(H(x, y + 1) - H(x, y - 1)) * strength, 1).normalize()
      const o = (y * size + x) * 4
      out[o] = (n.x * 0.5 + 0.5) * 255
      out[o + 1] = (n.y * 0.5 + 0.5) * 255
      out[o + 2] = (n.z * 0.5 + 0.5) * 255
      out[o + 3] = 255
    }
  })
}

// Pebbled leather: alpha-composited bumps
function grain(size, blobs, rMin, rMax, strength) {
  const h = new Float32Array(size * size).fill(0.5)
  for (let i = 0; i < blobs; i++) {
    const cx = Math.random() * size, cy = Math.random() * size, r = rMin + Math.random() * (rMax - rMin)
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r
      if (d >= 1) continue
      const a = 0.35 - 0.23 * d, o = ((y + size) % size) * size + ((x + size) % size)
      h[o] = h[o] * (1 - a) + (1 - d) * a
    }
  }
  return normalFromHeight(h, size, strength)
}

// Fine random fibres (suede, foam)
function noise(size, strength) {
  const h = new Float32Array(size * size)
  for (let i = 0; i < h.length; i++) h[i] = Math.random()
  return normalFromHeight(h, size, strength)
}

// Plain weave (canvas)
function weave(size, cells, strength) {
  const h = new Float32Array(size * size), c = size / cells
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = Math.floor(x / c), cy = Math.floor(y / c), fx = (x % c) / c, fy = (y % c) / c
    const warp = (cx + cy) % 2 === 0
    h[y * size + x] = (warp ? Math.sin(Math.PI * fx) : Math.sin(Math.PI * fy)) * 0.8 + Math.random() * 0.2
  }
  return normalFromHeight(h, size, strength)
}

// Knit: rows of V stitches
function knit(size, cols, rows, strength) {
  const h = new Float32Array(size * size), cw = size / cols, rh = size / rows
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = (x % cw) / cw, fy = (y % rh) / rh
    const leg = Math.abs(fx - 0.5) * 2, v = 1 - Math.abs(leg - fy)
    h[y * size + x] = Math.pow(Math.max(0, v), 2) * 0.85 + Math.random() * 0.15
  }
  return normalFromHeight(h, size, strength)
}

// Engineered mesh: staggered round holes
function mesh(size, cells, strength) {
  const h = new Float32Array(size * size), c = size / cells
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = Math.floor(y / c), ox = row % 2 ? c / 2 : 0
    const fx = (((x + ox) % c) + c) % c / c - 0.5, fy = (y % c) / c - 0.5
    h[y * size + x] = Math.min(1, Math.hypot(fx, fy) * 3.2)
  }
  return normalFromHeight(h, size, strength)
}

// Vertical ribs (waffle sidewall, foxing texture)
function ribs(size, count, strength) {
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = Math.pow(Math.abs(Math.sin((Math.PI * x * count) / size)), 0.6)
  return normalFromHeight(h, size, strength)
}

let cache
export function maps() {
  if (cache) return cache
  cache = {
    leather: grain(512, 9000, 1.2, 3.4, 2.2),
    tumbled: grain(512, 4000, 2.5, 6, 2.6),
    suede: noise(256, 0.9),
    foam: noise(128, 0.35),
    canvas: weave(256, 64, 1.6),
    knit: knit(256, 32, 24, 1.8),
    mesh: mesh(256, 24, 2.2),
    ribs: ribs(128, 16, 3),
  }
  return cache
}

// Zebra knit colour map in normalized (t, th/π) space: stripes sweep back from the top line
export function zebraMap(base = '#ecebe7', ink = '#1c1c1c') {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = base
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = ink
  const centre = (x, y) => x - 300 * Math.abs(y / c.height - 0.5) ** 1.2 + 22 * Math.sin(y * 0.035 + x * 0.013)
  const half = (x, y) => 7 + 6 * Math.sin(y * 0.022 + x * 0.05) ** 2 + 4 * Math.abs(y / c.height - 0.5)
  for (let x = -60; x < c.width + 360; x += 38 + 10 * Math.sin(x * 0.7)) {
    g.beginPath()
    for (let y = 0; y <= c.height; y += 6) g.lineTo(centre(x, y) - half(x, y), y)
    for (let y = c.height; y >= 0; y -= 6) g.lineTo(centre(x, y) + half(x, y), y)
    g.fill()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// Text or drawing on a transparent texture for decals
export function decalTexture(draw, w = 512, h = 128) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
