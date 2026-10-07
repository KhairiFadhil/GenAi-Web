import * as THREE from 'three'
import { MODELS } from './models.js'
import { decalTexture, maps, zebraMap } from './textures.js'

// Procedural sneaker builder.
// A model (models.js) describes shape, panels and trims; geometry is cached
// per model + detail, and a colorway only swaps materials.

const DETAIL = {
  full: { nu: 220, nv: 64, k: 1, extras: true },
  lite: { nu: 60, nv: 16, k: 0.3, extras: false },
}
const { PI, sin, cos, asin, acos, pow, max, min, abs, sqrt, exp, round } = Math
const clamp = (v, a, b) => min(b, max(a, v))
const lerp = (a, b, k) => a + (b - a) * k
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

// Monotone cubic through [x, y] knots (no overshoot)
export function knots(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  if (n === 1) return () => ys[0]
  const d = [], m = new Array(n)
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]))
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b
    if (s > 9) { const k = 3 / sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i] }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h, u2 = u * u, u3 = u2 * u
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1]
  }
}

// Geometry helpers
function gridGeometry(pts, nu, nv, { flipTest = true, uv1 = false } = {}) {
  const cols = nv + 1, pos = [], nor = [], uv = [], uvB = [], idx = []
  for (const q of pts) {
    pos.push(q.p.x, q.p.y, q.p.z)
    nor.push(q.n.x, q.n.y, q.n.z)
    uv.push(q.u, q.v)
    if (uv1) uvB.push(q.u1, q.v1)
  }
  let flip = false
  if (flipTest) {
    const a = pts[0], b = pts[cols], c = pts[1]
    flip = b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p)).dot(a.n) < 0
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * cols + j, b = a + cols
    flip ? idx.push(a, a + 1, b, b, a + 1, b + 1) : idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  if (uv1) g.setAttribute('uv1', new THREE.Float32BufferAttribute(uvB, 2))
  g.setIndex(idx)
  return g
}

// Grid of (point, normal) -> solid with thickness d
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

const geometryCache = new Map()

function build(key, detail) {
  const M = MODELS[key]
  const { nu: NU, nv: NV, k, extras: X } = DETAIL[detail]
  const res = (n) => max(3, round(n * k))
  const parts = []
  const add = (geometry, role, cast = true) => (parts.push({ geometry, role, cast }), geometry)
  const addInstanced = (geometry, role, matrices) => matrices.length && parts.push({ geometry, role, cast: false, matrices })

  // Last shape
  const fW = knots(M.width), fH = knots(M.height), fS = knots(M.sole.height), fP = knots(M.round ?? [[0, 0.55], [1, 0.55]])
  const fC = knots(M.collar), fG = knots(M.gap)
  const [tS, tE] = M.throat
  const hr = M.heelRound ?? 0.07, tr = M.toeRound ?? 0.16, he = M.heelExp ?? 0.35, te = M.toeExp ?? 0.8
  const capF = (u) => sqrt(max(0, 1 - u * u))
  const heelCap = (t) => (t < hr ? capF((hr - t) / hr) : 1)
  const toeCap = (t) => (t > 1 - tr ? capF((t - (1 - tr)) / tr) : 1)
  const W = (t) => fW(t) * heelCap(t) * toeCap(t)
  const H = (t) => fH(t) * pow(heelCap(t), he) * pow(toeCap(t), te)
  const S = (t) => fS(t)
  const spring = (t) => (M.toeSpring ?? 0.05) * pow(max(0, (t - 0.68) / 0.32), 2) + (M.heelSpring ?? 0.012) * pow(max(0, (0.12 - t) / 0.12), 2)
  const archK = M.arch ?? 0.06
  const zScale = (t, c) => (c >= 0 ? 1 : 1 - archK * exp(-(((t - 0.47) / 0.16) ** 2)) * min(1, (c / -0.5) ** 2))
  const prof = (t, th) => pow(max(sin(th), 0), fP(t))
  const xOf = (t) => t - 0.5

  const P = (t, th) => {
    t = clamp(t, 0, 1)
    const c = cos(th)
    return V(xOf(t), S(t) + spring(t) + H(t) * prof(t, th), W(t) * c * zScale(t, c))
  }
  const N = (t, th) => {
    const e = 1e-3, tt = clamp(t, 0.002, 0.998), hh = clamp(th, 0.002, PI - 0.002)
    return P(tt + e, hh).sub(P(tt - e, hh)).cross(P(tt, hh + e).sub(P(tt, hh - e))).normalize()
  }
  const PO = (t, th, off) => P(t, th).add(N(t, th).multiplyScalar(off))
  const mirror = (th, side) => (side > 0 ? th : PI - th)
  const thY = (t, y, side = 1) => mirror(asin(pow(clamp(y / max(H(t), 1e-5), 0, 1), 1 / fP(t))), side)
  const thZ = (t, z, side = 1) => mirror(acos(clamp(z / max(W(t), 1e-5), -1, 1)), side)
  const yRel = (t, th) => H(t) * prof(t, th)
  const dTh = (t, th) => max(1e-4, P(t, th + 1e-3).distanceTo(P(t, th)) / 1e-3)

  // Foot opening + throat: removed where yRel > collar(t) and |z| < gap(t)
  const thB = (t) => {
    const g = fG(t), c = fC(t), w = W(t), h = H(t)
    if (g <= 1e-4 || c >= h) return PI / 2
    const a = g >= w ? 0 : acos(g / w)
    const b = c <= 0 ? 0 : asin(pow(c / h, 1 / fP(t)))
    return min(PI / 2, max(a, b))
  }
  let tO = 0
  while (tO < tS && thB(tO) > PI / 2 - 1e-3) tO += 0.0005
  const zB = (t) => W(t) * cos(thB(t))

  const surf = (t, th) => ({ p: P(t, th), n: N(t, th), u: t * 16, v: th * 2.6 })

  // Heel back: (height above ground, z) -> (t, th) by bisection along t
  const backAt = (y, z) => {
    const yr = (t) => y - S(t) - spring(t)
    const zAt = (t) => { const h = yr(t); if (h <= 0 || h >= H(t)) return h >= H(t) ? 0 : W(t); return W(t) * cos(thY(t, h)) }
    let a = 0.0005, b = 0.35
    for (let i = 0; i < 40; i++) { const m = (a + b) / 2; zAt(m) < abs(z) ? (a = m) : (b = m) }
    const t = (a + b) / 2, th = thY(t, max(0, yr(t)))
    return { t, th: z >= 0 ? th : PI - th }
  }

  // Upper shell, lateral and medial halves meeting on the top line
  for (const side of [1, -1]) {
    const pts = []
    // Cosine spacing: dense at the heel and toe tips so both close cleanly
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const t = 0.5 - 0.5 * cos((PI * i) / NU), th = mirror((j / NV) * thB(t), side)
      // Pattern v follows real height: 0 lateral sole edge, 0.5 top line, 1 medial sole edge
      const hk = prof(t, th) * 0.5
      pts.push({ ...surf(t, th), u1: t, v1: side > 0 ? hk : 1 - hk })
    }
    const g = gridGeometry(pts, NU, NV, { uv1: true })
    add(g, 'base')
    add(g, 'lining', false)
  }

  // Panels: 't' mode spans t, with th range per t on each side
  const seams = []
  const inset = (t, th, dist, dir) => th + (dir * dist) / dTh(t, th)
  const panel = (role, t0, t1, a, b, o = {}) => {
    const sides = o.sides ?? [1, -1]
    for (const side of sides) {
      const range = (t) => {
        let A = a(t), B = b(t)
        if (o.clampOpen !== false) B = min(B, thB(t))
        return [A, max(A, B)]
      }
      add(slab((u, v) => {
        const t = lerp(t0, t1, (1 - cos(PI * u)) / 2), [A, B] = range(t)
        return surf(t, mirror(lerp(A, B, v), side))
      }, res(o.nu ?? 60), res(o.nv ?? 10), o.d ?? 0.0022, { lift: o.lift ?? 0.0006, walls: o.walls }), role)
      if (X && o.stitch) for (const edge of o.stitch) {
        const path = []
        for (let i = 0; i <= 80; i++) {
          const t = lerp(t0 + (o.stitchTrim ?? 0.004), t1 - (o.stitchTrim ?? 0.004), i / 80), [A, B] = range(t)
          if (B - A < 0.02) continue
          const th = edge === 'b' ? inset(t, B, 0.006, -1) : inset(t, A, 0.006, 1)
          path.push({ p: PO(t, mirror(th, side), (o.lift ?? 0.0006) + (o.d ?? 0.0022)), n: N(t, mirror(th, side)) })
        }
        if (path.length > 2) seams.push(path)
      }
    }
  }
  // 'th' mode spans th across both sides, with t range per th
  const cap = (role, th0, th1, a, b, o = {}) => {
    add(slab((u, v) => {
      const th = lerp(th0, th1, u)
      return surf(lerp(a(th), b(th), v), th)
    }, res(o.nu ?? 60), res(o.nv ?? 20), o.d ?? 0.0022, { lift: o.lift ?? 0.0004, walls: o.walls }), role)
    if (X && o.stitch) {
      const path = []
      for (let i = 0; i <= 90; i++) {
        const th = lerp(th0 + 0.03, th1 - 0.03, i / 90), t = a(th) + 0.009
        path.push({ p: PO(t, th, (o.lift ?? 0.0004) + (o.d ?? 0.0022)), n: N(t, th) })
      }
      seams.push(path)
    }
  }
  // Side graphics: (u, v) -> [t, yRel]
  const band = (role, fn, o = {}) => {
    const lift = o.lift ?? 0.0016, d = o.d ?? 0.0018
    for (const side of o.sides ?? [1, -1]) {
      add(slab((u, v) => {
        const [t, y] = fn(u, v)
        return surf(t, thY(t, y, side))
      }, res(o.nu ?? 70), res(o.nv ?? 8), d, { lift }), role)
      // Stitch just inside both long edges
      if (X && o.stitch) for (const v of [0.12, 0.88]) {
        const path = []
        for (let i = 0; i <= 120; i++) {
          const u = 0.03 + (i / 120) * 0.94, [t, y] = fn(u, v), [, y0] = fn(u, 0), [, y1] = fn(u, 1)
          if (abs(y1 - y0) < 0.012) continue
          const th = thY(t, y, side)
          path.push({ p: PO(t, th, lift + d), n: N(t, th) })
        }
        if (path.length > 2) seams.push(path)
      }
    }
  }

  // Punched holes at (t, th) positions on the given surface lift
  const perfs = (list, r = 0.0032, lift = 0.0028) => {
    if (!X) return
    const o = new THREE.Object3D(), mats = []
    for (const [t, th] of list) {
      const p = PO(t, th, lift), n = N(t, th)
      o.position.copy(p)
      o.lookAt(p.clone().add(n))
      o.updateMatrix()
      mats.push(...o.matrix.elements)
    }
    addInstanced(new THREE.CircleGeometry(r, 12), 'hole', mats)
  }
  const ctx = { perfs, backAt, seams, P, N, PO, W, H, S, spring, thY, thZ, thB, zB, yRel, tO, tS, tE, mirror, panel, cap, band, add, addInstanced, X, res, slab, surf, knots, fC, fG }
  for (const fn of M.panels ?? []) fn(ctx)

  // Eyestays along the throat
  const eye = M.eyestay ?? { w: 0.032 }
  if (eye.w) {
    panel('eyestay', tS + (eye.from ?? 0.012), tE, (t) => max(thB(t) - (eye.maxAngle ?? 0.5), thZ(t, min(W(t) * 0.995, zB(t) + eye.w))), (t) => thB(t), {
      lift: 0.0018, d: eye.d ?? 0.003, nu: 70, nv: 6, stitch: X ? ['a', 'b'] : null, clampOpen: true,
    })
  }

  // Padded collar following the opening edge
  if (M.collarPad) {
    const r = M.collarPad, path = []
    const pt = (t, side) => {
      const th = mirror(thB(t), side), p = P(t, th), n = N(t, th)
      const inward = P(t, PI / 2).sub(p).normalize()
      return p.add(n.multiplyScalar(r * (M.collarOut ?? 0.15))).add(inward.multiplyScalar(r * 0.55)).add(V(0, -r * 0.25, 0))
    }
    const tEnd = tS + (M.collarFront ?? 0.005)
    for (let i = 0; i <= 60; i++) path.push(pt(lerp(tEnd, tO + 0.001, i / 60), -1))
    for (let i = 1; i <= 60; i++) path.push(pt(lerp(tO + 0.001, tEnd, i / 60), 1))
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), res(220), r, X ? 14 : 6, false), 'collar')
  }

  // Tongue: follows the throat, then rises above the collar
  const tg = M.tongue
  const tongueAt = (t, z, lift) => {
    const th = z >= 0 ? thZ(t, z) : thZ(t, -z, -1)
    return { p: PO(t, th, lift), n: N(t, th) }
  }
  const tongueHW = (t) => min(W(t) * 0.9, max(fG(max(t, tS + 0.02)), 0.02) + tg.wide)
  const tFront = tE + 0.035
  const tongueTop = V(-tg.back, tg.rise, 0)
  const tonguePt = (u, v, extra = 0) => {
    const f = 0.78
    // Puffed inside the throat gap, tucked under the eyestays outside it
    const off = (vv, t) => {
      const z = abs(2 * vv - 1) * tongueHW(t), g = max(fG(max(t, tS + 0.02)), 0.015)
      return z < g ? tg.lift * (1 - (z / g) ** 2) - 0.0008 : -0.0035
    }
    if (u <= f) {
      const t = lerp(tFront, tS, u / f), hw = tongueHW(t)
      const q = tongueAt(t, (v - 0.5) * 2 * hw, off(v, t) + extra)
      return { ...q, u: u * 4, v: v * 2 }
    }
    // Upper tongue: flatter arch, rising almost upright
    const kk = (u - f) / (1 - f), e = sin((kk * PI) / 2), hw = tongueHW(tS) * (1 - 0.1 * kk)
    const q = tongueAt(tS, (v - 0.5) * 2 * hw, tg.lift * 0.6 * (1 - (2 * v - 1) ** 2) + extra)
    const mid = tongueAt(tS, 0, tg.lift * 0.6 + extra)
    q.p.y = lerp(q.p.y, mid.p.y - 0.018 * (2 * v - 1) ** 2, 0.65 * kk)
    q.p.add(tongueTop.clone().multiplyScalar(e))
    q.n.lerp(V(0.75, 0.66, 0), kk).normalize()
    return { ...q, u: u * 4, v: v * 2 }
  }
  add(slab((u, v) => tonguePt(u, v), res(48), res(16), tg.d ?? 0.006, { lift: 0 }), 'tongue')
  {
    const rim = []
    for (let j = 0; j <= 16; j++) rim.push(tonguePt(1, 0.04 + (j / 16) * 0.92, (tg.d ?? 0.006) * 0.5).p)
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim), 24, tg.rim ?? (tg.d ?? 0.006) * 0.6, X ? 10 : 5, false), 'tongue')
  }
  const tagPos = tonguePt(0.93, 0.5, (tg.d ?? 0.006) + 0.0008)
  if (tg.tag) {
    const tag = new THREE.PlaneGeometry(tg.tag[0], tg.tag[1])
    const m = new THREE.Matrix4().lookAt(V(), tagPos.n, V(0, 1, 0))
    tag.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromRotationMatrix(m)))
    tag.rotateY(0)
    tag.translate(tagPos.p.x, tagPos.p.y, tagPos.p.z)
    parts.push({ geometry: tag, role: 'tag', cast: false })
  }

  // Eyelets + laces
  const L = M.laces
  const rows = []
  for (let r = 0; r < L.rows; r++) rows.push(lerp(tS + (L.start ?? 0.02), tE - (L.end ?? 0.05), r / (L.rows - 1)))
  const eyeZ = (t) => zB(t) + (eye.w ? eye.w * 0.42 : 0.012)
  const eyePt = (t, side) => {
    const th = thZ(t, min(W(t) * 0.99, eyeZ(t)), side)
    return { p: PO(t, th, 0.0045), n: N(t, th) }
  }
  {
    const o = new THREE.Object3D(), mats = []
    for (const t of rows) for (const side of [1, -1]) {
      const e = eyePt(t, side)
      o.position.copy(e.p)
      o.lookAt(e.p.clone().add(e.n))
      o.updateMatrix()
      mats.push(...o.matrix.elements)
    }
    const metal = L.eyelets === 'metal'
    if (L.eyelets !== 'none') addInstanced(metal ? new THREE.TorusGeometry(0.0058, 0.0019, X ? 8 : 4, X ? 20 : 8) : new THREE.CircleGeometry(0.0045, 14), metal ? 'ring' : 'hole', mats)
  }
  const laceLift = (tg.lift ?? 0.004) + (tg.d ?? 0.006) + 0.003
  const lacePath = (ta, za, tb, zb) => {
    const a = tongueAt(ta, za, 0.0045), b = tongueAt(tb, zb, 0.0045)
    const pts = [a.p], nrm = [a.n]
    for (const q of [0.22, 0.5, 0.78]) {
      const t = lerp(ta, tb, q), z = lerp(za, zb, q)
      const c = tongueAt(t, z, laceLift * (1 - abs(q - 0.5) * 0.6) + (L.arch ?? 0.004) * (1 - (2 * q - 1) ** 2))
      pts.push(c.p)
      nrm.push(c.n)
    }
    pts.push(b.p)
    nrm.push(b.n)
    return [pts, nrm]
  }
  const laceGeo = (pts, nrm) => {
    if (L.style === 'rope') return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), res(40), L.w / 2, X ? 8 : 4, false)
    const c = new THREE.CatmullRomCurve3(pts), nc = new THREE.CatmullRomCurve3(nrm)
    return slab((u, v) => {
      const p = c.getPoint(u), tan = c.getTangent(u), n = nc.getPoint(u).normalize()
      const sd = V().crossVectors(tan, n).normalize()
      return { p: p.add(sd.multiplyScalar((v - 0.5) * L.w)), n, u: u * 6, v }
    }, res(40), 2, L.d ?? 0.0022, { lift: 0 })
  }
  for (let r = 0; r < rows.length - 1; r++) for (const side of [1, -1]) {
    const lift = side > 0 ? 0.0022 : 0
    const [pts, nrm] = lacePath(rows[r + 1], side * eyeZ(rows[r + 1]), rows[r], -side * eyeZ(rows[r]))
    pts.forEach((p, i) => i > 0 && i < pts.length - 1 && p.add(nrm[i].clone().multiplyScalar(lift)))
    add(laceGeo(pts, nrm), 'lace')
  }
  {
    const [pts, nrm] = lacePath(rows[0], eyeZ(rows[0]), rows[0], -eyeZ(rows[0]))
    add(laceGeo(pts, nrm), 'lace')
  }
  // Bow resting on the top bar
  if (L.bow) {
    const c = tongueAt(rows[0] + 0.012, 0, laceLift + 0.004)
    for (const side of [1, -1]) {
      const loop = [c.p.clone(), c.p.clone().add(V(-0.012, 0.012, side * 0.035)), c.p.clone().add(V(0.022, 0.02, side * 0.07)), c.p.clone().add(V(0.05, 0.008, side * 0.05)), c.p.clone().add(V(0.012, 0.002, side * 0.008))]
      add(laceGeo(loop, loop.map(() => V(0, 1, 0))), 'lace')
      const tail = [c.p.clone(), c.p.clone().add(V(0.03, -0.004, side * 0.03)), c.p.clone().add(V(0.06, -0.03, side * 0.075)), c.p.clone().add(V(0.075, -0.07, side * 0.11))]
      add(laceGeo(tail, tail.map(() => V(side * 0.3, 1, 0).normalize())), 'lace')
    }
  }

  // Sole
  const sole = M.sole
  const outline = (n = res(160)) => {
    const pts = []
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([xOf(t), W(t), t]) }
    const ring = [...pts]
    for (let i = pts.length - 2; i > 0; i--) ring.push([pts[i][0], -pts[i][1] * zScale(pts[i][2], -1), pts[i][2]])
    let arc = 0
    const out = ring.map((p, i) => {
      const a = ring[(i - 1 + ring.length) % ring.length], b = ring[(i + 1) % ring.length]
      const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1
      if (i > 0) arc += Math.hypot(p[0] - ring[i - 1][0], p[1] - ring[i - 1][1])
      return { x: p[0], z: p[1], nx: -tz / l, nz: tx / l, t: p[2], arc }
    })
    const area = out.reduce((acc, p, i) => { const q = out[(i + 1) % out.length]; return acc + p.x * q.z - q.x * p.z }, 0)
    if (area < 0) out.reverse()
    return out
  }
  const ringAt = (base, grow, h) => base.map((p) => {
    const g = typeof grow === 'function' ? grow(p, h) : grow
    return V(p.x + p.nx * g, h * S(p.t) + spring(p.t) + (sole.toeWrap ?? 0) * h * pow(max(0, (p.t - 0.9) / 0.1), 2), p.z + p.nz * g)
  })
  // Vertical ribs around the perimeter (Boost cage)
  const R = sole.rib
  const ribGrow = R ? (p) => R.base + R.depth * pow(0.5 + 0.5 * cos((p.arc * 2 * PI) / R.pitch), 1.5) : 0
  const loft = (profile, role) => {
    const base = outline(res(R ? 480 : 160))
    const rings = profile.map(([g, h]) => ringAt(base, g === 'rib' ? ribGrow : g, h))
    const n = rings[0].length, pos = [], idx = []
    rings.forEach((r) => r.forEach((p) => pos.push(p.x, p.y, p.z)))
    for (let q = 0; q < rings.length - 1; q++) for (let i = 0; i < n; i++) {
      const a = q * n + i, b = q * n + ((i + 1) % n)
      idx.push(a, a + n, b, b, a + n, b + n)
    }
    const capRing = (q, up) => {
      const c = V()
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
    const uv = []
    for (const r of rings) r.forEach((_, i) => uv.push((base[i].arc ?? 0) * 12, 0))
    uv.push(0, 0, 0, 0)
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return add(g, role)
  }
  for (const layer of sole.layers) loft(layer.profile, layer.role)
  if (X) for (const line of sole.lines ?? []) {
    const r = ringAt(outline(), line.grow, line.h)
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(r, true), 500, line.r ?? 0.0011, 5, true), line.role ?? 'groove', false)
  }
  if (X && sole.stitch) {
    const r = ringAt(outline(), sole.stitch.grow, sole.stitch.h)
    seams.push([...r, r[0]].map((p) => ({ p, n: V(p.x, 0, p.z).normalize() })))
  }
  loft([[-0.012, 1.0], [-0.018, 1.0 + 0.1]], 'insole')

  for (const fn of M.trims ?? []) fn(ctx)

  // Stitching along every seam
  if (X && seams.length) {
    const marks = [], STEP = M.stitchStep ?? 0.0062, o = new THREE.Object3D(), basis = new THREE.Matrix4(), mats = []
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
    for (const { p, n, dir } of marks) {
      basis.makeBasis(dir, n, V().crossVectors(n, dir).normalize())
      o.position.copy(p).add(n.clone().multiplyScalar(0.0005))
      o.quaternion.setFromRotationMatrix(basis)
      o.updateMatrix()
      mats.push(...o.matrix.elements)
    }
    addInstanced(new THREE.CapsuleGeometry(0.00065, 0.0032, 2, 6).rotateZ(PI / 2), 'thread', mats)
  }

  // Hotspot anchors
  const at = (p, n) => ({ position: p.toArray().map((x) => +x.toFixed(4)), normal: n.toArray().map((x) => +x.toFixed(3)) })
  const sideT = 0.56
  const stripeAt = M.stripeAnchor ?? [0.45, 0.1]
  const anchors = {
    toe: at(PO(0.9, PI / 2, 0.008), N(0.9, PI / 2)),
    laces: at(tongueAt(lerp(tS, tE, 0.45), 0, laceLift + 0.004).p, V(0.2, 1, 0.3).normalize()),
    tongue: at(tagPos.p, tagPos.n),
    collar: at(PO(tO + 0.01, thB(tO + 0.01), 0.016), N(tO + 0.01, thB(tO + 0.01))),
    heel: at(PO(0.012, PI / 2 - 0.6, 0.006), N(0.012, PI / 2 - 0.6)),
    stripe: at(PO(stripeAt[0], thY(stripeAt[0], stripeAt[1]), 0.005), N(stripeAt[0], thY(stripeAt[0], stripeAt[1]))),
    stitching: at(PO(0.62, thY(0.62, 0.03), 0.004), N(0.62, thY(0.62, 0.03))),
    sole: at(V(xOf(sideT), 0.5 * S(sideT) + spring(sideT), W(sideT) + 0.02), V(0, 0, 1)),
  }

  return { parts, anchors }
}

function geometry(model, detail) {
  const key = `${model}|${detail}`
  if (!geometryCache.has(key)) geometryCache.set(key, build(model, detail))
  return geometryCache.get(key)
}

// Material kinds
const materialCache = new Map()
const KIND = {
  leather: (c, m) => ({ type: 'physical', color: c, roughness: 0.5, clearcoat: 0.22, clearcoatRoughness: 0.55, normalMap: m.leather, normalScale: 0.35 }),
  tumbled: (c, m) => ({ type: 'physical', color: c, roughness: 0.62, clearcoat: 0.12, clearcoatRoughness: 0.7, normalMap: m.tumbled, normalScale: 0.5 }),
  patent: (c) => ({ type: 'physical', color: c, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
  suede: (c, m) => ({ type: 'physical', color: c, roughness: 1, sheen: 0.8, sheenRoughness: 0.55, sheenTint: 0.12, normalMap: m.suede, normalScale: 0.6 }),
  canvas: (c, m) => ({ type: 'physical', color: c, roughness: 0.96, sheen: 0.6, sheenRoughness: 0.8, sheenTint: 0.3, normalMap: m.canvas, normalScale: 0.9, repeat: 3 }),
  knit: (c, m) => ({ type: 'physical', color: c, roughness: 0.92, sheen: 0.8, sheenRoughness: 0.7, sheenTint: 0.4, normalMap: m.knit, normalScale: 1.1, repeat: 4 }),
  mesh: (c, m) => ({ type: 'physical', color: c, roughness: 0.9, sheen: 0.5, sheenRoughness: 0.8, sheenTint: 0.3, normalMap: m.mesh, normalScale: 1, repeat: 2.5 }),
  nylon: (c, m) => ({ type: 'physical', color: c, roughness: 0.75, sheen: 0.4, sheenRoughness: 0.5, sheenTint: 0.5, normalMap: m.canvas, normalScale: 0.4, repeat: 4 }),
  foam: (c, m) => ({ type: 'physical', color: c, roughness: 0.62, clearcoat: 0.08, normalMap: m.foam, normalScale: 0.25 }),
  rubber: (c) => ({ type: 'standard', color: c, roughness: 0.9 }),
  boost: (c, m) => ({ type: 'physical', color: c, roughness: 0.85, sheen: 0.3, normalMap: m.suede, normalScale: 1.2, repeat: 2 }),
  ribbed: (c, m) => ({ type: 'standard', color: c, roughness: 0.88, normalMap: m.ribs, normalScale: 0.8, repeat: 1 }),
  lace: (c, m) => ({ type: 'physical', color: c, roughness: 0.85, sheen: 0.5, sheenTint: 0.4, normalMap: m.canvas, normalScale: 0.5, repeat: 2, side: THREE.DoubleSide }),
  lining: (c, m) => ({ type: 'standard', color: c, roughness: 0.95, normalMap: m.mesh, normalScale: 0.5, side: THREE.BackSide, repeat: 2 }),
  plain: (c) => ({ type: 'standard', color: c, roughness: 0.8 }),
  metal: (c) => ({ type: 'standard', color: c, metalness: 1, roughness: 0.3 }),
  hole: () => ({ type: 'basic', color: '#141414' }),
  groove: () => ({ type: 'standard', color: '#000000', roughness: 1, transparent: true, opacity: 0.3 }),
}

function makeMaterial(kind, color, detail, extra = {}) {
  const m = detail === 'full' ? maps() : {}
  const spec = { ...KIND[kind](color, m), ...extra }
  const { type, normalMap, normalScale, repeat, sheenTint, ...rest } = spec
  if (rest.sheen && sheenTint !== undefined) rest.sheenColor = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), sheenTint)
  if (normalMap && detail === 'full') {
    const nm = repeat ? normalMap.clone() : normalMap
    if (repeat) { nm.repeat.set(repeat, repeat); nm.needsUpdate = true }
    rest.normalMap = nm
    rest.normalScale = new THREE.Vector2(normalScale ?? 1, normalScale ?? 1)
  }
  // Shelf detail: plain standard materials keep shader programs few
  if (detail !== 'full' && type === 'physical') {
    for (const k of ['clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'sheenColor']) delete rest[k]
    return new THREE.MeshStandardMaterial(rest)
  }
  const C = type === 'physical' ? THREE.MeshPhysicalMaterial : type === 'basic' ? THREE.MeshBasicMaterial : THREE.MeshStandardMaterial
  return new C(rest)
}

// Role -> colour fallbacks
const FALLBACK = { toe: 'base', mudguard: 'base', heel: 'base', eyestay: 'base', collar: 'heel', tongue: 'base', tab: 'heel', quarter: 'base', accent: 'stripe', foxing: 'mid', insole: 'lining', tag: 'tongue' }
const colorOf = (colors, role) => colors[role] ?? (FALLBACK[role] ? colorOf(colors, FALLBACK[role]) : '#ff00ff')

function materials(spec, detail) {
  const key = detail + spec.model + JSON.stringify(spec.colors)
  if (materialCache.has(key)) return materialCache.get(key)
  const M = MODELS[spec.model], kinds = { mid: 'foam', out: 'rubber', lace: 'lace', lining: 'lining', insole: 'plain', thread: 'plain', ...M.materials }
  const out = new Proxy({}, {
    get(cacheObj, role) {
      if (!(role in cacheObj)) {
        if (role === 'hole') cacheObj[role] = makeMaterial('hole', '#141414', detail)
        else if (role === 'groove') cacheObj[role] = makeMaterial('groove', '#000', detail)
        else if (role === 'ring') cacheObj[role] = makeMaterial('metal', spec.colors.eyelet ?? '#cfcfcf', detail)
        else {
          const extra = M.maps?.[role]?.(spec.colors, detail) ?? {}
          cacheObj[role] = makeMaterial(kinds[role] ?? 'leather', colorOf(spec.colors, role), detail, extra)
        }
      }
      return cacheObj[role]
    },
  })
  materialCache.set(key, out)
  return out
}

export { zebraMap, decalTexture }

// spec = products.json model3D: { model, colors }
export function createShoe(spec, detail = 'full') {
  const { parts } = geometry(spec.model, detail)
  const mats = materials(spec, detail)
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

export const shoeAnchors = (spec) => geometry(spec.model, 'full').anchors

// Ground footprint: length 1 along x, toe at +x
export const SHOE_SIZE = { length: 1.04, width: 0.39, height: 0.36 }
