import * as THREE from 'three'

// Procedural low-top sneaker (ported from ori-proto).
// Geometry is cached per style + detail; a colorway only swaps materials.

const DETAIL = {
  full: { nu: 200, nv: 90, k: 1, extras: true },
  lite: { nu: 56, nv: 24, k: 0.32, extras: false },
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// Catmull-Rom through [t, value] knots
function curve(pts) {
  return (t) => {
    let i = 0
    while (i < pts.length - 2 && t > pts[i + 1][0]) i++
    const p0 = pts[Math.max(0, i - 1)][1], p1 = pts[i][1], p2 = pts[i + 1][1], p3 = pts[Math.min(pts.length - 1, i + 2)][1]
    const u = clamp((t - pts[i][0]) / (pts[i + 1][0] - pts[i][0]), 0, 1)
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)
  }
}

// Leather grain normal map: alpha-composited bumps on a height field
function grainNormal(size, blobs, rMin, rMax) {
  const h = new Float32Array(size * size).fill(0.5)
  for (let i = 0; i < blobs; i++) {
    const cx = Math.random() * size, cy = Math.random() * size, r = rMin + Math.random() * (rMax - rMin)
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r
      if (d >= 1) continue
      const a = 0.35 - 0.23 * d, c = 1 - d, o = ((y + size) % size) * size + ((x + size) % size)
      h[o] = h[o] * (1 - a) + c * a
    }
  }
  const out = new Uint8Array(size * size * 4)
  const H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)]
  const n = new THREE.Vector3()
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    n.set(-(H(x + 1, y) - H(x - 1, y)) * 2.2, -(H(x, y + 1) - H(x, y - 1)) * 2.2, 1).normalize()
    const o = (y * size + x) * 4
    out[o] = (n.x * 0.5 + 0.5) * 255
    out[o + 1] = (n.y * 0.5 + 0.5) * 255
    out[o + 2] = (n.z * 0.5 + 0.5) * 255
    out[o + 3] = 255
  }
  const t = new THREE.DataTexture(out, size, size)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

let textures
const getTextures = () => (textures ??= { leather: grainNormal(512, 9000, 1.2, 3.4), mesh: grainNormal(256, 2500, 2.5, 3.5) })

// Side graphics as (u, v) -> [t, y] bands
const STRIPES = {
  swoosh: [(u, v) => {
    const yc = 0.158 - 0.095 * u + 0.022 * Math.sin(Math.PI * u), w = 0.005 + 0.024 * Math.sin(Math.PI * Math.pow(u, 0.7))
    return [0.22 + u * 0.54, yc - w + 2 * w * v]
  }],
  three: [0, 1, 2].map((i) => (u, v) => {
    const t0 = 0.33 + i * 0.068
    return [t0 + u * 0.11 + (v - 0.5) * 0.026, 0.035 + u * 0.13]
  }),
  jazz: [(u, v) => {
    const t = 0.73 - u * 0.62
    const yc = 0.03 + 0.12 * u + 0.022 * Math.sin(Math.PI * 2.2 * u), w = 0.006 + 0.013 * Math.sin(Math.PI * Math.min(1, u * 1.15))
    return [t, yc - w + 2 * w * v]
  }],
  tiger: [
    ...[0, 1].map((i) => (u, v) => [0.34 + i * 0.045 + u * 0.2 + (v - 0.5) * 0.014, 0.16 - u * 0.12]),
    ...[0, 1].map((i) => (u, v) => [0.36 + i * 0.045 + u * 0.2 + (v - 0.5) * 0.014, 0.04 + u * 0.12]),
    (u, v) => [0.6 + (v - 0.5) * 0.016, 0.045 + u * 0.075],
  ],
  n: [
    (u, v) => [0.38 + (v - 0.5) * 0.028, 0.045 + u * 0.11],
    (u, v) => [0.38 + u * 0.14 + (v - 0.5) * 0.026, 0.155 - u * 0.11],
    (u, v) => [0.52 + (v - 0.5) * 0.028, 0.045 + u * 0.11],
  ],
  line: [(u, v) => {
    const yc = 0.115 - 0.05 * u, w = 0.007
    return [0.1 + u * 0.66, yc - w + 2 * w * v]
  }],
  none: [],
}

const geometryCache = new Map()

function build(style, detail) {
  const { nu: NU, nv: NV, k, extras } = DETAIL[detail]
  const res = (n) => Math.max(3, Math.round(n * k))
  const L = 1.0, SOLE = 0.075 * (style.sole ?? 1), s = SOLE / 0.075

  // Silhouette
  const cap = (t, a, b) => Math.sqrt(Math.max(0, 1 - ((t - a) / (b - a)) ** 2))
  const heelCap = (t) => (t < 0.07 ? cap(t, 0.07, 0) : 1)
  const toeCap = (t) => (t > 0.84 ? cap(t, 0.84, 1) : 1)
  const baseW = curve([[0, 0.118], [0.15, 0.132], [0.4, 0.138], [0.68, 0.176], [0.86, 0.165], [1, 0.13]])
  const baseH = curve([[0, 0.25], [0.2, 0.262], [0.4, 0.232], [0.62, 0.17], [0.84, 0.118], [1, 0.1]])
  const halfW = (t) => baseW(t) * heelCap(t) * toeCap(t)
  const height = (t) => baseH(t) * Math.pow(heelCap(t), 0.35) * Math.pow(toeCap(t), 0.8)
  const spring = (t) => 0.065 * Math.pow(Math.max(0, (t - 0.72) / 0.28), 2) + 0.012 * Math.pow(Math.max(0, (0.12 - t) / 0.12), 2)
  const xOf = (t) => (t - 0.5) * L
  const OPEN = { t: 0.235, a: 0.162, b: 0.116 }
  const inOpening = (t, z) => ((t - OPEN.t) / OPEN.a) ** 2 + (z / OPEN.b) ** 2 < 1
  const yOn = (t, th) => height(t) * Math.pow(Math.sin(th), 0.55)
  const thForZ = (t, z) => Math.acos(clamp(z / Math.max(halfW(t), 1e-4), -1, 1))
  const thForY = (t, y, side) => {
    const th = Math.asin(Math.pow(clamp(y / height(t), 0.0005, 0.9995), 1 / 0.55))
    return side > 0 ? th : Math.PI - th
  }

  // Upper surface + normal
  const P = (t, th) => {
    t = clamp(t, 0.0005, 0.9995)
    return new THREE.Vector3(xOf(t), SOLE + spring(t) + yOn(t, th), halfW(t) * Math.cos(th))
  }
  const N = (t, th) => {
    const e = 1e-3, tt = clamp(t, 0.002, 0.998), hh = clamp(th, 0.002, Math.PI - 0.002)
    const a = P(tt + e, hh).sub(P(tt - e, hh)), b = P(tt, hh + e).sub(P(tt, hh - e))
    return a.cross(b).normalize()
  }
  const PO = (t, th, off) => P(t, th).add(N(t, th).multiplyScalar(off))

  // Grid of (point, normal) -> solid with thickness
  function slab(fn, nu, nv, d, opts = {}) {
    const pos = [], uv = [], idx = [], cols = nv + 1, layer = (nu + 1) * cols, pts = []
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) pts.push(fn(i / nu, j / nv))
    for (const off of [d, 0]) for (const { p, n, u, v } of pts) {
      const q = p.clone().add(n.clone().multiplyScalar(off + (opts.lift ?? 0.0004)))
      pos.push(q.x, q.y, q.z)
      uv.push(u, v)
    }
    const f0 = pts[0], fu = pts[cols], fv = pts[1]
    const flip = fu.p.clone().sub(f0.p).cross(fv.p.clone().sub(f0.p)).dot(f0.n) < 0
    const walls = opts.walls ?? [1, 1, 1, 1]
    const quad = (a, b, c, e, fl) => (fl ? idx.push(a, c, b, b, c, e) : idx.push(a, b, c, b, e, c))
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i * cols + j, b = a + cols
      quad(a, b, a + 1, b + 1, flip)
      quad(a + layer, b + layer, a + 1 + layer, b + 1 + layer, !flip)
    }
    const wall = (list) => { for (let q = 0; q < list.length - 1; q++) quad(list[q], list[q + 1], list[q] + layer, list[q + 1] + layer, flip) }
    const rowA = [], rowB = [], colA = [], colB = []
    for (let j = 0; j <= nv; j++) { rowA.push(j); rowB.push(nu * cols + j) }
    for (let i = 0; i <= nu; i++) { colA.push(i * cols); colB.push(i * cols + nv) }
    if (walls[0]) wall(rowA.reverse())
    if (walls[1]) wall(rowB)
    if (walls[2]) wall(colA)
    if (walls[3]) wall(colB.reverse())
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  const surf = (t, th) => ({ p: P(t, th), n: N(t, th), u: t * 16, v: th * 2.6 })

  // Flat ribbon (laces)
  function ribbon(points, normals, w, d) {
    const c = new THREE.CatmullRomCurve3(points), nc = new THREE.CatmullRomCurve3(normals)
    return slab((u, v) => {
      const p = c.getPoint(u), tan = c.getTangent(u), n = nc.getPoint(u).normalize()
      const side = new THREE.Vector3().crossVectors(tan, n).normalize()
      return { p: p.add(side.multiplyScalar((v - 0.5) * w)), n, u: u * 6, v }
    }, res(Math.max(12, points.length * 10)), 3, d, { lift: 0 })
  }

  // Sole outline pushed out by `grow`
  function soleRing(grow, y) {
    const n = res(140), pts = []
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([xOf(t), halfW(t), t]) }
    const ring = [...pts]
    for (let i = pts.length - 2; i > 0; i--) ring.push([pts[i][0], -pts[i][1], pts[i][2]])
    const out = ring.map((p, i) => {
      const a = ring[(i - 1 + ring.length) % ring.length], b = ring[(i + 1) % ring.length]
      const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1
      return { x: p[0] - (tz / l) * grow, z: p[1] + (tx / l) * grow, t: p[2] }
    })
    const area = out.reduce((acc, p, i) => { const q = out[(i + 1) % out.length]; return acc + p.x * q.z - q.x * p.z }, 0)
    if (area < 0) out.reverse()
    return out.map((p) => new THREE.Vector3(p.x, y + spring(p.t), p.z))
  }
  // Lofted sole: profile = [[grow, y], ...] bottom to top
  function loftSole(profile) {
    const rings = profile.map(([g, y]) => soleRing(g, y))
    const n = rings[0].length, pos = [], idx = []
    rings.forEach((r) => r.forEach((p) => pos.push(p.x, p.y, p.z)))
    for (let q = 0; q < rings.length - 1; q++) for (let i = 0; i < n; i++) {
      const a = q * n + i, b = q * n + ((i + 1) % n)
      idx.push(a, a + n, b, b, a + n, b + n)
    }
    const capRing = (q, up) => {
      const c = new THREE.Vector3()
      rings[q].forEach((p) => c.add(p))
      c.divideScalar(n)
      const ci = pos.length / 3
      pos.push(c.x, c.y, c.z)
      for (let i = 0; i < n; i++) { const a = q * n + i, b = q * n + ((i + 1) % n); up ? idx.push(ci, a, b) : idx.push(ci, b, a) }
    }
    capRing(0, true)
    capRing(rings.length - 1, false)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }

  const parts = []
  const add = (geometry, role, cast = true) => parts.push({ geometry, role, cast })
  const addInstanced = (geometry, role, matrices) => matrices.length && parts.push({ geometry, role, cast: false, matrices })

  // Base upper with the opening cut
  {
    const pos = [], uv = [], idx = []
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const p = P(i / NU, (Math.PI * j) / NV)
      pos.push(p.x, p.y, p.z)
      uv.push((i / NU) * 16, ((Math.PI * j) / NV) * 2.6)
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1, tm = (i + 0.5) / NU, thm = (Math.PI * (j + 0.5)) / NV
      if (inOpening(tm, halfW(tm) * Math.cos(thm)) && yOn(tm, thm) > 0.09) continue
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    add(g, 'base')
    add(g, 'lining', false)
  }

  const seams = []
  const edge = (fn, n) => { const r = []; for (let i = 0; i <= n; i++) { const [t, th] = fn(i / n); r.push({ p: P(t, th), n: N(t, th) }) } return r }
  const D = 0.0022

  // Toe cap
  const toeB = (th) => 0.8 + 0.045 * Math.abs(Math.cos(th))
  add(slab((u, v) => { const th = Math.PI * (0.02 + 0.96 * u), t = toeB(th) + v * (0.999 - toeB(th)); return surf(t, th) }, res(60), res(24), D, { walls: [1, 1, 1, 0] }), 'panel')
  seams.push(edge((u) => { const th = Math.PI * (0.03 + 0.94 * u); return [toeB(th) + 0.009, th] }, 80))

  // Mudguard band
  const mudTop = 0.034
  for (const side of [1, -1]) {
    add(slab((u, v) => { const t = 0.16 + u * 0.66; return surf(t, thForY(t, 0.002 + v * mudTop, side)) }, res(80), res(8), D * 0.8), 'base')
    seams.push(edge((u) => { const t = 0.17 + u * 0.64; return [t, thForY(t, mudTop - 0.006, side)] }, 80))
  }

  // Heel counter
  const heelTop = (t) => clamp(((0.205 - t) / 0.075) * 0.26, 0, 0.26)
  const heelEndCache = new Map()
  const heelEnd = (th) => {
    if (heelEndCache.has(th)) return heelEndCache.get(th)
    let end = 0.2
    for (let t = 0.001; t < 0.25; t += 0.001) {
      const y = yOn(t, th)
      if (y > heelTop(t) || (inOpening(t, halfW(t) * Math.cos(th)) && y > 0.09)) { end = Math.max(0.002, t - 0.001); break }
    }
    heelEndCache.set(th, end)
    return end
  }
  add(slab((u, v) => { const th = Math.PI * (0.015 + 0.97 * u); return surf(0.001 + v * heelEnd(th), th) }, res(90), res(24), D * 1.2, { walls: [1, 1, 0, 1] }), 'panel')
  seams.push(edge((u) => { const th = Math.PI * (0.03 + 0.94 * u); return [heelEnd(th) - 0.008, th] }, 90).filter((q) => q.p.y < SOLE + 0.17))

  // Eyestays
  for (const side of [1, -1]) {
    add(slab((u, v) => { const t = 0.37 + u * 0.33, z = side * (0.05 + v * 0.05); return surf(t, thForZ(t, z)) }, res(50), res(8), D), 'panel')
    seams.push(edge((u) => { const t = 0.38 + u * 0.31; return [t, thForZ(t, side * 0.094)] }, 50))
  }

  // Side graphics
  for (const band of STRIPES[style.stripe ?? 'swoosh']) for (const side of [1, -1]) {
    add(slab((u, v) => { const [t, y] = band(u, v); return surf(t, thForY(t, y, side)) }, res(70), res(8), D), 'stripe')
  }

  // Padded collar
  const collarPts = []
  for (let q = 0; q <= 96; q++) {
    const a = (q / 96) * Math.PI * 2, t = OPEN.t + OPEN.a * Math.cos(a), z = OPEN.b * Math.sin(a)
    collarPts.push(PO(t, thForZ(t, z), -0.002))
  }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(collarPts, true), res(200), 0.012, extras ? 16 : 8, true), 'panel')

  // Heel tab
  add(slab((u, v) => surf(0.002 + v * 0.02, Math.PI * (0.44 + 0.12 * u)), 8, 6, 0.004), 'stripe')

  // Tongue
  const T0 = 0.3, T1 = 0.42, TE = 0.68
  add(slab((u, v) => {
    const t = T0 + u * (TE - T0), tt = Math.max(t, T1), q = Math.max(0, (T1 - t) / (T1 - T0))
    const z = (v - 0.5) * 0.12 * (1 - 0.12 * q)
    const th = thForZ(tt, z), p = PO(tt, th, 0.003)
    p.x -= q * 0.012
    p.y += q * 0.06 - 0.012 * Math.cos(th) ** 2 * q
    return { p, n: N(tt, th), u: u * 4, v: v * 2 }
  }, res(34), res(14), 0.005), 'tongue')
  const tTop = []
  for (let j = 0; j <= 14; j++) {
    const z = (j / 14 - 0.5) * 0.12 * 0.88, th = thForZ(T1, z), p = PO(T1, th, 0.0055)
    p.x -= 0.012
    p.y += 0.06 - 0.012 * Math.cos(th) ** 2
    tTop.push(p)
  }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tTop), 30, 0.0045, extras ? 10 : 6, false), 'tongue')
  const tag = new THREE.BoxGeometry(0.004, 0.026, 0.04)
  tag.rotateZ(0.35)
  const tagAt = tTop[7].clone().add(new THREE.Vector3(0.006, -0.018, 0))
  tag.translate(tagAt.x, tagAt.y, tagAt.z)
  add(tag, 'panel')

  // Laces: criss-cross runs plus a straight top bar
  const rows = [0.405, 0.452, 0.5, 0.548, 0.596, 0.644]
  const eye = (t, sd) => { const th = thForZ(t, sd * 0.074); return { p: PO(t, th, 0.0035), n: N(t, th) } }
  for (let r = 0; r < rows.length - 1; r++) for (const sd of [1, -1]) {
    const a = eye(rows[r + 1], sd), b = eye(rows[r], -sd), lift = 0.0115 + (sd > 0 ? 0.0025 : 0)
    const path = [a.p], nrm = [a.n]
    for (const q of [0.25, 0.5, 0.75]) {
      const t = rows[r + 1] + (rows[r] - rows[r + 1]) * q, th = thForZ(t, sd * 0.074 * (1 - 2 * q))
      path.push(PO(t, th, lift))
      nrm.push(N(t, th))
    }
    path.push(b.p)
    nrm.push(b.n)
    add(ribbon(path, nrm, 0.0085, 0.0018), 'lace')
  }
  {
    const path = [], nrm = []
    for (let q = 0; q <= 6; q++) {
      const z = 0.074 * (1 - (2 * q) / 6), th = thForZ(rows[0], z)
      path.push(PO(rows[0], th, q === 0 || q === 6 ? 0.0035 : 0.009))
      nrm.push(N(rows[0], th))
    }
    add(ribbon(path, nrm, 0.0085, 0.0018), 'lace')
  }

  // Eyelets
  const eyelet = new THREE.TorusGeometry(0.0062, 0.0018, extras ? 8 : 4, extras ? 20 : 8)
  const o = new THREE.Object3D()
  const eyeMats = []
  for (const t of rows) for (const sd of [1, -1]) {
    const e = eye(t, sd)
    o.position.copy(e.p)
    o.lookAt(e.p.clone().add(e.n))
    o.updateMatrix()
    eyeMats.push(...o.matrix.elements)
  }
  addInstanced(eyelet, 'ring', eyeMats)

  // Toe perforations
  if (extras && style.perf !== false) {
    const holeMats = []
    for (let i = 0; i < 6; i++) for (let j = 0; j < 11; j++) {
      const t = 0.848 + i * 0.021, th = Math.PI * (0.28 + j * 0.044 + (i % 2) * 0.022)
      if (t > 0.955 || th > Math.PI * 0.74) continue
      const p = PO(t, th, D + 0.0007), n = N(t, th)
      o.position.copy(p)
      o.lookAt(p.clone().add(n))
      o.updateMatrix()
      holeMats.push(...o.matrix.elements)
    }
    addInstanced(new THREE.CircleGeometry(0.0032, 12), 'hole', holeMats)
  }

  // Cupsole: outsole, midsole wall, grooves
  add(loftSole([[0.004, 0], [0.013, 0.003 * s], [0.015, 0.012 * s]]), 'out')
  add(loftSole([[0.015, 0.011 * s], [0.017, 0.02 * s], [0.016, 0.05 * s], [0.0145, SOLE + 0.004], [0.006, SOLE + 0.008], [-0.01, SOLE + 0.006]]), 'mid')
  if (extras) for (const y of [0.03 * s, 0.038 * s]) {
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(soleRing(0.0175, y), true), 400, 0.0011, 4, true), 'groove', false)
  }
  add(loftSole([[-0.012, SOLE + 0.006], [-0.016, SOLE + 0.012]]), 'insole', false)

  // Stitching along every seam
  if (extras) {
    const sr = soleRing(0.0158, SOLE - 0.009)
    seams.push(sr.map((p) => ({ p, n: new THREE.Vector3(p.x, 0, p.z).normalize() })).concat([{ p: sr[0], n: new THREE.Vector3(sr[0].x, 0, sr[0].z).normalize() }]))
    const marks = [], STEP = 0.0065
    for (const path of seams) {
      let acc = 0
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i], seg = a.p.distanceTo(b.p)
        for (let d = (STEP - acc) % STEP; d < seg; d += STEP) {
          const q = d / seg
          marks.push({ p: a.p.clone().lerp(b.p, q), n: a.n.clone().lerp(b.n, q).normalize(), dir: b.p.clone().sub(a.p).normalize() })
        }
        acc = (acc + seg) % STEP
      }
    }
    const basis = new THREE.Matrix4(), stitchMats = []
    for (const { p, n, dir } of marks) {
      basis.makeBasis(dir, n, new THREE.Vector3().crossVectors(n, dir).normalize())
      o.position.copy(p).add(n.clone().multiplyScalar(0.0006))
      o.quaternion.setFromRotationMatrix(basis)
      o.updateMatrix()
      stitchMats.push(...o.matrix.elements)
    }
    addInstanced(new THREE.CapsuleGeometry(0.0007, 0.0034, 2, 6).rotateZ(Math.PI / 2), 'thread', stitchMats)
  }

  // Hotspot anchors in model space
  const at = (p, n) => ({ position: p.toArray().map((x) => +x.toFixed(4)), normal: n.toArray().map((x) => +x.toFixed(3)) })
  const sideT = 0.56
  const anchors = {
    toe: at(PO(0.9, Math.PI / 2, 0.006), N(0.9, Math.PI / 2)),
    laces: at(PO(0.52, Math.PI / 2, 0.016), N(0.52, Math.PI / 2)),
    tongue: at(tagAt.clone().add(new THREE.Vector3(0.006, 0, 0)), new THREE.Vector3(0.3, 1, 0).normalize()),
    collar: at(PO(0.09, Math.PI / 2, 0.012), N(0.09, Math.PI / 2)),
    heel: at(PO(0.014, Math.PI / 2, 0.004), N(0.014, Math.PI / 2)),
    stripe: at(PO(0.47, thForY(0.47, 0.105, 1), 0.004), N(0.47, thForY(0.47, 0.105, 1))),
    stitching: at(PO(0.64, thForY(0.64, mudTop - 0.006, 1), 0.003), N(0.64, thForY(0.64, mudTop - 0.006, 1))),
    sole: at(new THREE.Vector3(xOf(sideT), 0.045 * s + spring(sideT), halfW(sideT) + 0.018), new THREE.Vector3(0, 0, 1)),
  }

  return { parts, anchors }
}

function geometry(style, detail) {
  const key = `${style.stripe ?? 'swoosh'}|${style.sole ?? 1}|${style.perf !== false}|${detail}`
  if (!geometryCache.has(key)) geometryCache.set(key, build(style, detail))
  return geometryCache.get(key)
}

const materialCache = new Map()

function materials(colors, detail) {
  const key = detail + JSON.stringify(colors)
  if (materialCache.has(key)) return materialCache.get(key)
  // Grain is invisible at shelf scale; skip the costly maps there
  const tex = detail === 'full' ? getTextures() : {}
  const v2 = (n) => new THREE.Vector2(n, n)
  const bump = (map, scale) => (map ? { normalMap: map, normalScale: v2(scale) } : {})
  const leather = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.55, ...bump(tex.leather, 0.35) })
  const m = {
    base: leather(colors.base),
    panel: leather(colors.panel),
    stripe: leather(colors.stripe),
    lining: new THREE.MeshStandardMaterial({ color: colors.lining, roughness: 0.95, ...bump(tex.mesh, 0.6), side: THREE.BackSide }),
    tongue: new THREE.MeshStandardMaterial({ color: colors.base, roughness: 0.8, ...bump(tex.mesh, 0.5) }),
    lace: new THREE.MeshStandardMaterial({ color: colors.lace, roughness: 0.85, side: THREE.DoubleSide }),
    ring: new THREE.MeshStandardMaterial({ color: '#cfcfcf', metalness: 1, roughness: 0.28 }),
    hole: new THREE.MeshBasicMaterial({ color: '#141414' }),
    out: new THREE.MeshStandardMaterial({ color: colors.out, roughness: 0.92 }),
    mid: new THREE.MeshPhysicalMaterial({ color: colors.sole, roughness: 0.6, clearcoat: 0.1 }),
    groove: new THREE.MeshStandardMaterial({ color: '#000000', roughness: 1, transparent: true, opacity: 0.35 }),
    insole: new THREE.MeshStandardMaterial({ color: colors.lining, roughness: 1, ...bump(tex.mesh, 1) }),
    thread: new THREE.MeshStandardMaterial({ color: colors.thread, roughness: 0.9 }),
  }
  materialCache.set(key, m)
  return m
}

// spec = products.json model3D object: { stripe, sole, perf, colors }
export function createShoe(spec, detail = 'full') {
  const { parts } = geometry(spec, detail)
  const mats = materials(spec.colors, detail)
  const group = new THREE.Group()
  for (const p of parts) {
    let mesh
    if (p.matrices) {
      mesh = new THREE.InstancedMesh(p.geometry, mats[p.role], p.matrices.length / 16)
      mesh.instanceMatrix.array.set(p.matrices)
      mesh.computeBoundingSphere()
    } else {
      mesh = new THREE.Mesh(p.geometry, mats[p.role])
    }
    mesh.castShadow = p.cast
    mesh.receiveShadow = true
    group.add(mesh)
  }
  return group
}

export const shoeAnchors = (spec) => geometry(spec, 'full').anchors

// Ground footprint: length 1 along x, toe at +x
export const SHOE_SIZE = { length: 1.04, width: 0.39, height: 0.36 }
