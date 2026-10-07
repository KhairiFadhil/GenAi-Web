// Sneaker models: shape knots are [t, value] with t = 0 heel .. 1 toe,
// heights are above the sole top, all in units of shoe length.

import { decalTexture, zebraMap } from './textures.js'

const { PI, sin, cos, abs, pow, max, min } = Math
const lerp = (a, b, k) => a + (b - a) * k

// Foot opening (collar line up to the throat) and the laced throat gap
const opening = (collar, tS, tE, g = 0.04) => ({
  collar: [[0, 0.7], ...collar, [tS + 0.015, 0.01], [1, 0.01]],
  gap: [[0, 0.3], [tS - 0.025, 0.3], [tS + 0.01, g], [lerp(tS, tE, 0.6), g * 0.88], [tE - 0.03, g * 0.7], [tE, 0]],
  throat: [tS, tE],
})

// Panel builders
const toeCap = (toeB, o = {}) => ({ cap }) =>
  cap(o.role ?? 'toe', 0.02 * PI, 0.98 * PI, toeB, () => 0.9995, { walls: [1, 1, 1, 0], stitch: o.stitch ?? true, lift: o.lift ?? 0.0004, d: o.d })
const mudguard = (pts, o = {}) => ({ panel, thY, knots }) => {
  const m = knots(pts)
  panel(o.role ?? 'mudguard', pts[0][0], 0.9995, () => 0, (t) => thY(t, m(t)), { lift: 0.0012, stitch: ['b'], nu: 100, ...o })
}
const counter = (pts, o = {}) => ({ panel, thY, knots }) => {
  const h = knots(pts)
  panel(o.role ?? 'heel', 0, pts[pts.length - 1][0], () => 0, (t) => thY(t, h(t)), { lift: 0.0016, stitch: ['b'], nu: 60, ...o })
}
// Upper band between a lower curve and the collar (ankle flaps, quarter overlays)
const upperBand = (role, pts, t0, t1, o = {}) => ({ panel, thY, knots }) => {
  const lo = knots(pts)
  panel(role, t0, t1, (t) => thY(t, lo(t)), () => PI / 2, { lift: 0.002, stitch: ['a'], nu: 70, ...o })
}
// Side graphic between two (t, y) curves sharing end points
const shape = (role, top, bot, o = {}) => ({ band, knots }) => {
  const T = knots(top), B = knots(bot), t0 = top[0][0], t1 = top[top.length - 1][0]
  band(role, (u, v) => { const t = lerp(t0, t1, u); return [t, lerp(B(t), T(t), v)] }, { nu: 120, stitch: true, lift: 0.0042, ...o })
}
// Straight slanted stripe from (t, y) to (t, y), width measured along t
const bar = (role, from, to, w, o = {}) => ({ band }) =>
  band(role, (u, v) => {
    const saw = o.serrate ? o.serrate * (abs(((u * 18) % 1) - 0.5) - 0.25) : 0
    return [lerp(from[0], to[0], u) + (v - 0.5) * w + (v > 0.5 ? saw : -saw), lerp(from[1], to[1], u)]
  }, { nu: 60, nv: 4, stitch: o.stitch ?? true, ...o })
// Curved stripe along a centre curve with width along y
const ribbon = (role, centre, width, t0, t1, o = {}) => ({ band, knots }) => {
  const c = knots(centre), w = knots(width)
  band(role, (u, v) => { const t = lerp(t0, t1, u); return [t, c(t) + (v - 0.5) * w(t)] }, { nu: 110, stitch: true, ...o })
}
const perfGrid = (t0, rows, cols, dt, th0, dth, lift = 0.0032, r = 0.0034, tMax = 0.955) => ({ perfs }) => {
  const list = []
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const t = t0 + i * dt, th = PI * (th0 + j * dth + (i % 2) * dth * 0.5)
    if (t < tMax && th < PI * (1 - th0 + 0.01)) list.push([t, th])
  }
  perfs(list, r, lift)
}
// Heel tab: strip over the back centre line, from sole to a height
const heelTab = (half, yTop, o = {}) => (ctx) => {
  const { slab, surf, backAt, S, spring, res, add } = ctx
  add(slab((u, v) => {
    const y0 = S(0.002) + spring(0.002) + (o.from ?? 0.004)
    const { t, th } = backAt(lerp(y0, yTop, u), (v - 0.5) * 2 * half * (1 - (o.taper ?? 0) * u))
    return surf(t, th)
  }, res(30), res(8), o.d ?? 0.0028, { lift: o.lift ?? 0.0018 }), o.role ?? 'tab')
}

// Canvas drawings for decals; colours may come from the colorway
const pick = (v, c) => (typeof v === 'function' ? v(c) : v)
const text = (str, o = {}) => (g, w, h, c) => {
  if (o.bg) { g.fillStyle = pick(o.bg, c); g.fillRect(0, 0, w, h) }
  g.font = o.font ?? 'italic 900 ' + h * 0.72 + 'px "Arial Black", Arial, sans-serif'
  g.letterSpacing = o.spacing ?? '0px'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = pick(o.color ?? '#000', c)
  g.fillText(str, w / 2, h / 2 + (o.dy ?? 0))
}
const label = (lines, o = {}) => (g, w, h, c) => {
  g.fillStyle = pick(o.bg, c)
  g.fillRect(0, 0, w, h)
  g.fillStyle = pick(o.color ?? '#fff', c)
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  lines.forEach((l, i) => {
    g.font = (i === 0 ? 800 : 600) + ' ' + h * (o.size ?? 0.34) + 'px Arial, sans-serif'
    g.fillText(l, w / 2, h * ((i + 1) / (lines.length + 1)))
  })
}
const tagMap = (draw) => (c) => ({ map: decalTexture((g, w, h) => draw(g, w, h, c), 256, 192), color: '#ffffff' })

// Sole profiles: [grow beyond the last, h as a fraction of sole height]
const CUP = (g = 0.021) => [
  { role: 'out', profile: [[g - 0.006, 0], [g, 0.012], [g + 0.001, 0.05], [g, 0.28]] },
  { role: 'mid', profile: [[g, 0.28], [g - 0.0005, 0.85], [g - 0.003, 0.97], [g - 0.011, 1.02], [-0.004, 1.03]] },
]
const VULC = (g = 0.011) => [
  { role: 'out', profile: [[g - 0.004, 0], [g, 0.04], [g + 0.0005, 0.22]] },
  { role: 'mid', profile: [[g + 0.0005, 0.22], [g + 0.0005, 0.9], [g - 0.002, 0.99], [g - 0.008, 1.02], [-0.004, 1.03]] },
]
const FLAT = (g = 0.01) => [
  { role: 'out', profile: [[g - 0.005, 0], [g, 0.15], [g + 0.0005, 0.6], [g - 0.001, 0.92], [g - 0.006, 1.02], [-0.004, 1.03]] },
]

export const MODELS = {
  af1: {
    width: [[0, 0.112], [0.15, 0.126], [0.38, 0.13], [0.62, 0.163], [0.8, 0.165], [0.92, 0.15], [1, 0.12]],
    height: [[0, 0.27], [0.15, 0.275], [0.3, 0.26], [0.4, 0.235], [0.5, 0.205], [0.6, 0.17], [0.7, 0.14], [0.8, 0.113], [0.9, 0.092], [1, 0.075]],
    round: [[0, 0.45], [0.5, 0.55], [1, 0.62]],
    heelRound: 0.075, toeRound: 0.17, heelExp: 0.3, toeExp: 0.9,
    toeSpring: 0.045, heelSpring: 0.01,
    ...opening([[0.03, 0.258], [0.12, 0.238], [0.22, 0.2], [0.3, 0.205], [0.333, 0.19]], 0.335, 0.68, 0.042),
    collarPad: 0.014, collarFront: -0.012,
    eyestay: { w: 0.055 },
    tongue: { wide: 0.03, rise: 0.07, back: 0.012, lift: 0.007, d: 0.012, rim: 0.011, tag: [0.034, 0.024] },
    laces: { rows: 6, w: 0.024, d: 0.0045, arch: 0.016, start: 0.02, end: 0.008 },
    sole: { height: [[0, 0.108], [0.6, 0.098], [1, 0.092]], layers: CUP(0.021), lines: [{ grow: 0.0212, h: 0.29 }], stitch: { grow: 0.0208, h: 0.8 } },
    stripeAnchor: [0.36, 0.09],
    materials: { out: 'ribbed' },
    maps: { tag: tagMap(label(['NIKE', 'AIR'], { bg: '#f2f1ec', color: '#9a9a9a' })) },
    trims: [
      ({ decal }) => decal('air', text('AIR', { color: '#c9c6bf' }), { t0: 0.07, t1: 0.2, y0: 0.38, y1: 0.72, onSole: true, grow: 0.0222, sides: [1] }),
      ({ backDecal }) => backDecal('tab', text('AIR', { color: '#cfccc4', font: '800 70px Arial, sans-serif', spacing: '10px' }), { y0: 0.25, y1: 0.29, half: 0.02, lift: 0.0065, w: 256, h: 96 }),
      perfGrid(0.83, 6, 13, 0.022, 0.24, 0.04),
      ({ perfs, thY }) => {
        const list = []
        for (const side of [1, -1]) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const t = 0.63 + i * 0.022 + j * 0.006
          list.push([t, thY(t, 0.075 + j * 0.02, side)])
        }
        perfs(list, 0.0034, 0.0007)
      },
    ],
    panels: [
      toeCap((th) => 0.79 + 0.045 * abs(cos(th))),
      mudguard([[0.17, 0.034], [0.45, 0.04], [0.7, 0.05], [0.88, 0.062], [1, 0.08]]),
      counter([[0, 0.3], [0.05, 0.21], [0.13, 0.14], [0.2, 0.07], [0.25, 0.005]]),
      shape('stripe',
        [[0.165, 0.165], [0.2, 0.142], [0.28, 0.128], [0.38, 0.126], [0.48, 0.135], [0.57, 0.15], [0.665, 0.172]],
        [[0.165, 0.165], [0.185, 0.128], [0.22, 0.085], [0.27, 0.058], [0.32, 0.05], [0.4, 0.058], [0.5, 0.088], [0.59, 0.128], [0.665, 0.172]]),
      heelTab(0.024, 0.33),
    ],
  },

  aj1: {
    width: [[0, 0.115], [0.15, 0.125], [0.32, 0.126], [0.6, 0.158], [0.8, 0.158], [0.92, 0.144], [1, 0.115]],
    height: [[0, 0.5], [0.12, 0.515], [0.22, 0.49], [0.3, 0.42], [0.38, 0.31], [0.48, 0.225], [0.6, 0.168], [0.7, 0.136], [0.8, 0.11], [0.9, 0.09], [1, 0.072]],
    round: [[0, 0.22], [0.25, 0.25], [0.42, 0.5], [1, 0.6]],
    heelRound: 0.08, toeRound: 0.17, heelExp: 0.12, toeExp: 0.9,
    toeSpring: 0.04, heelSpring: 0.008,
    ...opening([[0.025, 0.47], [0.1, 0.468], [0.18, 0.45], [0.24, 0.438], [0.262, 0.425]], 0.268, 0.68, 0.04),
    collarPad: 0.012, collarFront: -0.01,
    eyestay: { w: 0.05 },
    tongue: { wide: 0.028, rise: 0.06, back: 0.005, lift: 0.006, d: 0.01, rim: 0.009, tag: [0.034, 0.03] },
    laces: { rows: 9, w: 0.02, d: 0.004, arch: 0.012, start: 0.015, end: 0.008 },
    sole: { height: [[0, 0.075], [0.6, 0.068], [1, 0.065]], layers: CUP(0.016), lines: [{ grow: 0.0162, h: 0.3 }], stitch: { grow: 0.0158, h: 0.75 } },
    stripeAnchor: [0.33, 0.11],
    materials: { tongue: 'nylon' },
    maps: { tag: tagMap(label(['NIKE', 'AIR'], { bg: (c) => c.tag, color: '#ffffff' })) },
    trims: [
      perfGrid(0.84, 5, 12, 0.022, 0.26, 0.042),
      ({ decal }) => decal('wings', text('AIR JORDAN', { color: '#2b2b2b', font: 'italic 900 44px Arial, sans-serif' }), { t0: 0.07, t1: 0.2, y0: 0.39, y1: 0.43, sides: [1], lift: 0.0045, w: 512, h: 96 }),
    ],
    panels: [
      toeCap((th) => 0.8 + 0.04 * abs(cos(th)), { stitch: true }),
      mudguard([[0.42, 0.002], [0.5, 0.045], [0.58, 0.1], [0.64, 0.135], [0.7, 0.11], [0.78, 0.076], [0.88, 0.07], [0.95, 0.1], [1, 0.2]]),
      counter([[0, 0.6], [0.15, 0.36], [0.22, 0.3], [0.28, 0.2], [0.32, 0.1], [0.35, 0.03], [0.36, 0.002]]),
      upperBand('collar', [[0, 0.37], [0.08, 0.34], [0.16, 0.31], [0.22, 0.32], [0.27, 0.36]], 0, 0.272),
      shape('stripe',
        [[0.1, 0.25], [0.14, 0.23], [0.22, 0.205], [0.32, 0.185], [0.44, 0.168], [0.56, 0.155], [0.7, 0.14]],
        [[0.1, 0.25], [0.115, 0.215], [0.14, 0.165], [0.18, 0.115], [0.24, 0.082], [0.31, 0.072], [0.4, 0.08], [0.5, 0.098], [0.6, 0.12], [0.7, 0.14]]),
    ],
  },

  samba: {
    width: [[0, 0.104], [0.15, 0.113], [0.4, 0.116], [0.65, 0.14], [0.82, 0.14], [0.93, 0.124], [1, 0.094]],
    height: [[0, 0.232], [0.15, 0.236], [0.3, 0.222], [0.42, 0.195], [0.55, 0.158], [0.68, 0.122], [0.8, 0.094], [0.9, 0.075], [1, 0.058]],
    round: [[0, 0.5], [0.5, 0.58], [1, 0.66]],
    heelRound: 0.07, toeRound: 0.2, heelExp: 0.3, toeExp: 1,
    toeSpring: 0.035, heelSpring: 0.006, arch: 0.07,
    ...opening([[0.03, 0.214], [0.12, 0.2], [0.22, 0.175], [0.3, 0.178], [0.33, 0.17]], 0.335, 0.7, 0.036),
    collarPad: 0.008, collarFront: -0.012,
    eyestay: { w: 0.036 },
    tongue: { wide: 0.026, rise: 0.06, back: 0.02, lift: 0.004, d: 0.006, rim: 0.004, tag: [0.03, 0.022] },
    laces: { rows: 7, w: 0.016, d: 0.003, arch: 0.01, start: 0.02, end: 0.008 },
    sole: { height: [[0, 0.04], [0.6, 0.036], [1, 0.034]], toeWrap: 0.025, layers: FLAT(0.009) },
    stripeAnchor: [0.4, 0.1],
    materials: { toe: 'suede', out: 'rubber' },
    maps: { tag: tagMap(label(['SAMBA'], { bg: (c) => c.tag, color: '#ffffff', size: 0.4 })) },
    trims: [
      ({ decal }) => decal('samba', text('SAMBA', { color: '#b8913a', font: '700 64px Arial, sans-serif', spacing: '6px' }), { t0: 0.44, t1: 0.56, y0: 0.13, y1: 0.152, lift: 0.0035, w: 512, h: 96 }),
    ],
    panels: [
      // T-toe: toe cap plus a strip up the centre to the throat
      toeCap((th) => 0.84 - 0.13 * pow(max(0, cos((th - PI / 2) * 3.2)), 3) + 0.03 * abs(cos(th)), { lift: 0.0014, d: 0.0026 }),
      counter([[0, 0.24], [0.06, 0.16], [0.12, 0.09], [0.17, 0.04], [0.2, 0.004]]),
      bar('stripe', [0.35, 0.012], [0.25, 0.178], 0.026, { serrate: 0.004 }),
      bar('stripe', [0.415, 0.012], [0.315, 0.17], 0.026, { serrate: 0.004 }),
      bar('stripe', [0.48, 0.012], [0.38, 0.158], 0.026, { serrate: 0.004 }),
      heelTab(0.03, 0.24, { taper: 0.25 }),
    ],
  },

  yeezy: {
    width: [[0, 0.112], [0.15, 0.126], [0.4, 0.132], [0.65, 0.164], [0.82, 0.164], [0.93, 0.15], [1, 0.12]],
    height: [[0, 0.37], [0.1, 0.36], [0.22, 0.31], [0.34, 0.27], [0.46, 0.232], [0.6, 0.192], [0.74, 0.16], [0.86, 0.14], [0.95, 0.12], [1, 0.1]],
    round: [[0, 0.4], [0.4, 0.55], [0.75, 0.7], [1, 0.78]],
    heelRound: 0.09, toeRound: 0.2, heelExp: 0.15, toeExp: 0.45,
    toeSpring: 0.055, heelSpring: 0.012,
    ...opening([[0.025, 0.36], [0.07, 0.33], [0.14, 0.27], [0.21, 0.235], [0.28, 0.228], [0.305, 0.222]], 0.31, 0.64, 0.03),
    collarPad: 0.009, collarFront: -0.01,
    eyestay: { w: 0 },
    tongue: { wide: 0.03, rise: 0.02, back: 0.0, lift: 0.002, d: 0.004, rim: 0.005 },
    laces: { rows: 6, w: 0.009, style: 'rope', arch: 0.014, start: 0.02, end: 0.008, eyelets: 'none' },
    sole: {
      height: [[0, 0.125], [0.5, 0.105], [1, 0.09]],
      layers: [
        { role: 'out', profile: [[0.016, 0], [0.024, 0.035], [0.027, 0.13]] },
        { role: 'mid', profile: [['rib', 0.13], ['rib', 0.5], ['rib', 0.82], [0.02, 0.96], [0.008, 1.02], [-0.006, 1.03]] },
      ],
      rib: { base: 0.026, depth: 0.008, pitch: 0.068 },
    },
    stripeAnchor: [0.4, 0.1],
    materials: { base: 'knit', tongue: 'knit', collar: 'knit', mid: 'boost', out: 'rubber', lace: 'lace', stripe: 'nylon', tab: 'nylon' },
    trims: [
      ({ decal }) => decal('sply', text('SPLY-350', { color: '#c8102e', font: '700 70px Arial, sans-serif', spacing: '4px' }), { t0: 0.3, t1: 0.52, y0: 0.084, y1: 0.104, lift: 0.0026, mirrorMedial: true, w: 512, h: 80 }),
    ],
    // Zebra pattern lives in the shell's normalized uv1
    maps: { base: (c) => { const map = zebraMap(c.base, c.pattern ?? '#1c1c1c'); map.channel = 1; return { map, color: '#ffffff' } } },
    panels: [
      ribbon('stripe', [[0.05, 0.13], [0.2, 0.108], [0.4, 0.092], [0.6, 0.084], [0.68, 0.084]], [[0.05, 0.014], [0.68, 0.014]], 0.05, 0.68, { stitch: false, d: 0.0012, lift: 0.0012 }),
      // Pull tab standing proud of the heel collar
      ({ slab, backAt, P, N, res, add }) => {
        const { t, th } = backAt(0.43, 0)
        const base = P(t, th), n = N(t, th)
        add(slab((u, v) => {
          const p = base.clone().add(n.clone().multiplyScalar(0.004 + 0.012 * u)).setY(base.y - 0.06 + u * 0.1)
          p.z += (v - 0.5) * 0.034
          return { p, n, u, v }
        }, res(10), res(4), 0.004, { lift: 0 }), 'tab')
      },
    ],
  },

  nb550: {
    width: [[0, 0.114], [0.15, 0.127], [0.38, 0.132], [0.62, 0.164], [0.8, 0.165], [0.92, 0.15], [1, 0.12]],
    height: [[0, 0.27], [0.15, 0.272], [0.3, 0.258], [0.4, 0.232], [0.5, 0.2], [0.6, 0.168], [0.7, 0.138], [0.8, 0.112], [0.9, 0.092], [1, 0.075]],
    round: [[0, 0.45], [0.5, 0.55], [1, 0.62]],
    heelRound: 0.075, toeRound: 0.17, heelExp: 0.3, toeExp: 0.9,
    toeSpring: 0.045, heelSpring: 0.01,
    ...opening([[0.03, 0.255], [0.12, 0.24], [0.22, 0.205], [0.3, 0.208], [0.333, 0.195]], 0.335, 0.68, 0.042),
    collarPad: 0.016, collarFront: -0.012,
    eyestay: { w: 0.05 },
    tongue: { wide: 0.03, rise: 0.075, back: 0.012, lift: 0.007, d: 0.012, rim: 0.011, tag: [0.03, 0.03] },
    laces: { rows: 6, w: 0.022, d: 0.004, arch: 0.014, start: 0.02, end: 0.008 },
    sole: { height: [[0, 0.11], [0.6, 0.098], [1, 0.092]], layers: CUP(0.021), lines: [{ grow: 0.0212, h: 0.3 }], stitch: { grow: 0.0208, h: 0.78 } },
    stripeAnchor: [0.45, 0.1],
    materials: { out: 'ribbed' },
    maps: { tag: tagMap(label(['NB', '550'], { bg: '#f4f2ee', color: (c) => c.stripe })) },
    trims: [
      perfGrid(0.82, 6, 13, 0.022, 0.24, 0.04),
      ({ decal }) => decal('550', text('550', { color: '#ffffff', font: 'italic 900 80px Arial, sans-serif' }), { t0: 0.06, t1: 0.15, y0: 0.13, y1: 0.165, sides: [1], lift: 0.0045, w: 256, h: 96 }),
    ],
    panels: [
      toeCap((th) => 0.78 + 0.05 * abs(cos(th))),
      mudguard([[0.18, 0.036], [0.45, 0.042], [0.7, 0.05], [0.88, 0.064], [1, 0.085]]),
      counter([[0, 0.3], [0.05, 0.24], [0.12, 0.17], [0.2, 0.09], [0.26, 0.005]]),
      // Big N: two uprights and a diagonal
      bar('stripe', [0.375, 0.05], [0.395, 0.165], 0.03),
      bar('stripe', [0.398, 0.165], [0.5, 0.05], 0.034),
      bar('stripe', [0.5, 0.05], [0.52, 0.15], 0.03),
      heelTab(0.03, 0.31, { taper: 0.2 }),
    ],
  },

  nb990: {
    width: [[0, 0.11], [0.15, 0.124], [0.38, 0.128], [0.62, 0.158], [0.8, 0.158], [0.92, 0.14], [1, 0.108]],
    height: [[0, 0.255], [0.15, 0.258], [0.3, 0.24], [0.42, 0.21], [0.55, 0.17], [0.68, 0.135], [0.8, 0.105], [0.9, 0.085], [1, 0.068]],
    round: [[0, 0.45], [0.5, 0.55], [1, 0.65]],
    heelRound: 0.085, toeRound: 0.2, heelExp: 0.3, toeExp: 0.95,
    toeSpring: 0.06, heelSpring: 0.03,
    ...opening([[0.035, 0.238], [0.12, 0.222], [0.22, 0.19], [0.3, 0.192], [0.333, 0.18]], 0.335, 0.7, 0.04),
    collarPad: 0.016, collarFront: -0.012,
    eyestay: { w: 0.045 },
    tongue: { wide: 0.03, rise: 0.06, back: 0.015, lift: 0.007, d: 0.01, rim: 0.01, tag: [0.03, 0.03] },
    laces: { rows: 7, w: 0.016, d: 0.003, arch: 0.012, start: 0.02, end: 0.008 },
    sole: {
      height: [[0, 0.15], [0.35, 0.13], [0.7, 0.095], [1, 0.085]],
      layers: [
        { role: 'out', profile: [[0.012, 0], [0.019, 0.02], [0.021, 0.14]] },
        { role: 'accent', profile: [[0.021, 0.14], [0.027, 0.3], [0.027, 0.46]] },
        { role: 'mid', profile: [[0.027, 0.46], [0.025, 0.72], [0.019, 0.93], [0.008, 1.01], [-0.004, 1.03]] },
      ],
      lines: [{ grow: 0.0272, h: 0.46, r: 0.0012 }],
    },
    stripeAnchor: [0.45, 0.1],
    maps: { tag: tagMap(label(['990', 'MADE IN USA'], { bg: '#e8e8e8', color: '#4d5054', size: 0.24 })) },
    trims: [
      ({ decal }) => decal('990', text('990', { color: '#d9dadc', font: 'italic 900 80px Arial, sans-serif' }), { t0: 0.07, t1: 0.15, y0: 0.13, y1: 0.165, sides: [1], lift: 0.0045, w: 256, h: 96 }),
    ],
    materials: { base: 'mesh', toe: 'suede', mudguard: 'suede', heel: 'suede', eyestay: 'suede', collar: 'suede', stripe: 'leather', accent: 'foam', mid: 'foam', out: 'rubber' },
    panels: [
      toeCap((th) => 0.8 + 0.04 * abs(cos(th)), { d: 0.003 }),
      mudguard([[0.16, 0.04], [0.45, 0.05], [0.7, 0.06], [0.88, 0.075], [1, 0.1]], { d: 0.003 }),
      counter([[0, 0.28], [0.05, 0.24], [0.12, 0.17], [0.22, 0.08], [0.28, 0.005]], { d: 0.003 }),
      // Suede straps from the sole to the eyestay, either side of the N
      ...[[0.3, 0.355], [0.535, 0.59]].map(([a, b]) => ({ panel, thY }) =>
        panel('heel', a, b, () => 0, (t) => thY(t, 0.21), { lift: 0.0026, d: 0.003, stitch: ['a', 'b'], nu: 20, nv: 12 })),
      // Outlined N
      bar('logo', [0.37, 0.055], [0.39, 0.17], 0.036, { lift: 0.0062 }),
      bar('logo', [0.392, 0.17], [0.5, 0.055], 0.04, { lift: 0.0062 }),
      bar('logo', [0.5, 0.055], [0.52, 0.16], 0.036, { lift: 0.0062 }),
      bar('stripe', [0.37, 0.058], [0.39, 0.166], 0.024, { lift: 0.0082, stitch: false }),
      bar('stripe', [0.392, 0.166], [0.5, 0.058], 0.026, { lift: 0.0082, stitch: false }),
      bar('stripe', [0.5, 0.058], [0.52, 0.156], 0.024, { lift: 0.0082, stitch: false }),
      heelTab(0.03, 0.3, { taper: 0.2, role: 'heel' }),
    ],
  },

  chuck: {
    width: [[0, 0.104], [0.15, 0.114], [0.35, 0.116], [0.62, 0.148], [0.8, 0.148], [0.92, 0.134], [1, 0.108]],
    height: [[0, 0.46], [0.12, 0.475], [0.22, 0.455], [0.32, 0.37], [0.42, 0.275], [0.55, 0.198], [0.68, 0.148], [0.8, 0.116], [0.9, 0.094], [1, 0.072]],
    round: [[0, 0.2], [0.25, 0.24], [0.45, 0.5], [1, 0.62]],
    heelRound: 0.08, toeRound: 0.2, heelExp: 0.12, toeExp: 0.85,
    toeSpring: 0.03, heelSpring: 0.004,
    ...opening([[0.025, 0.44], [0.1, 0.438], [0.18, 0.425], [0.235, 0.418], [0.255, 0.405]], 0.26, 0.7, 0.038),
    collarPad: 0.005, collarFront: -0.006, collarOut: 0.3,
    eyestay: { w: 0.03 },
    tongue: { wide: 0.03, rise: 0.035, back: 0.005, lift: 0.004, d: 0.005, rim: 0.004 },
    laces: { rows: 9, w: 0.016, d: 0.003, arch: 0.01, start: 0.015, end: 0.008, eyelets: 'metal' },
    sole: {
      height: [[0, 0.088], [0.6, 0.085], [1, 0.085]],
      layers: VULC(0.011),
      lines: [{ grow: 0.0118, h: 0.62, r: 0.0042, role: 'accent' }, { grow: 0.0118, h: 0.18, r: 0.0011 }],
    },
    stripeAnchor: [0.45, 0.12],
    materials: { base: 'canvas', heel: 'canvas', eyestay: 'canvas', tongue: 'canvas', collar: 'canvas', mid: 'rubber', out: 'ribbed', toe: 'rubber' },
    trims: [
      ({ decal }) => decal('patch', (g, w, h) => {
        g.fillStyle = '#f4efe3'
        g.beginPath(); g.arc(w / 2, h / 2, w * 0.47, 0, 7); g.fill()
        g.strokeStyle = '#1b1b1b'; g.lineWidth = 6
        g.beginPath(); g.arc(w / 2, h / 2, w * 0.36, 0, 7); g.stroke()
        g.fillStyle = '#1d3f8a'; g.beginPath()
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? w * 0.09 : w * 0.22, a = -PI / 2 + (i * PI) / 5
          g.lineTo(w / 2 + r * cos(a), h / 2 + r * sin(a))
        }
        g.fill()
        g.fillStyle = '#1b1b1b'; g.font = '700 22px Arial, sans-serif'; g.textAlign = 'center'
        g.fillText('ALL STAR', w / 2, h * 0.86)
      }, { t0: 0.06, t1: 0.2, y0: 0.27, y1: 0.4, sides: [-1], lift: 0.004, w: 256, h: 256 }),
    ],
    panels: [
      // Rubber toe cap wrapping over the toe
      mudguard([[0.82, 0.02], [0.86, 0.05], [0.9, 0.09], [0.95, 0.12], [1, 0.2]], { role: 'toe', stitch: [], lift: 0.0016, d: 0.003 }),
      counter([[0, 0.12], [0.04, 0.09], [0.08, 0.04], [0.1, 0.004]], { stitch: ['b'] }),
    ],
  },

  vans: {
    width: [[0, 0.11], [0.15, 0.122], [0.38, 0.126], [0.62, 0.155], [0.8, 0.156], [0.92, 0.142], [1, 0.112]],
    height: [[0, 0.255], [0.15, 0.26], [0.3, 0.245], [0.42, 0.212], [0.55, 0.172], [0.68, 0.138], [0.8, 0.11], [0.9, 0.09], [1, 0.072]],
    round: [[0, 0.45], [0.5, 0.55], [1, 0.62]],
    heelRound: 0.075, toeRound: 0.18, heelExp: 0.3, toeExp: 0.9,
    toeSpring: 0.03, heelSpring: 0.004,
    ...opening([[0.03, 0.242], [0.12, 0.23], [0.22, 0.2], [0.3, 0.2], [0.333, 0.19]], 0.335, 0.7, 0.038),
    collarPad: 0.018, collarFront: -0.012, collarOut: 0.3,
    eyestay: { w: 0.045 },
    tongue: { wide: 0.03, rise: 0.06, back: 0.012, lift: 0.006, d: 0.01, rim: 0.01, tag: [0.03, 0.022] },
    laces: { rows: 6, w: 0.016, d: 0.0035, arch: 0.012, start: 0.02, end: 0.008, eyelets: 'metal' },
    sole: {
      height: [[0, 0.088], [0.6, 0.084], [1, 0.084]],
      layers: VULC(0.011),
      lines: [{ grow: 0.0118, h: 0.86, r: 0.0012 }],
    },
    stripeAnchor: [0.4, 0.11],
    materials: { base: 'canvas', toe: 'suede', mudguard: 'suede', heel: 'suede', eyestay: 'suede', collar: 'suede', mid: 'rubber', out: 'ribbed', tongue: 'canvas' },
    maps: { tag: tagMap(label(['VANS'], { bg: '#c8102e', color: '#ffffff', size: 0.42 })) },
    trims: [
      ({ backDecal }) => backDecal('otw', label(['VANS', 'OFF THE WALL'], { bg: '#c8102e', color: '#ffffff', size: 0.26 }), { y0: 0.1, y1: 0.135, half: 0.024, lift: 0.0045, w: 256, h: 128 }),
    ],
    panels: [
      toeCap((th) => 0.74 + 0.07 * abs(cos(th)), { d: 0.0028 }),
      mudguard([[0.55, 0.04], [0.7, 0.045], [0.85, 0.06], [1, 0.08]], { d: 0.0028 }),
      counter([[0, 0.27], [0.06, 0.2], [0.14, 0.13], [0.22, 0.06], [0.27, 0.005]], { d: 0.0028 }),
      // Sidestripe: a wave sweeping from the forefoot up to the heel collar
      ribbon('stripe',
        [[0.1, 0.178], [0.18, 0.15], [0.27, 0.126], [0.36, 0.12], [0.44, 0.104], [0.53, 0.08], [0.62, 0.056], [0.7, 0.04]],
        [[0.1, 0.01], [0.2, 0.034], [0.35, 0.05], [0.5, 0.044], [0.62, 0.026], [0.7, 0.006]], 0.1, 0.7, { d: 0.0024 }),
    ],
  },

  mexico: {
    width: [[0, 0.1], [0.15, 0.108], [0.4, 0.11], [0.65, 0.134], [0.8, 0.132], [0.92, 0.11], [1, 0.078]],
    height: [[0, 0.225], [0.15, 0.228], [0.3, 0.212], [0.42, 0.185], [0.55, 0.15], [0.68, 0.118], [0.8, 0.09], [0.9, 0.072], [1, 0.055]],
    round: [[0, 0.5], [0.5, 0.6], [1, 0.68]],
    heelRound: 0.07, toeRound: 0.25, heelExp: 0.3, toeExp: 1.05,
    toeSpring: 0.03, heelSpring: 0.004, arch: 0.08,
    ...opening([[0.03, 0.206], [0.12, 0.19], [0.22, 0.165], [0.3, 0.168], [0.33, 0.16]], 0.335, 0.7, 0.034),
    collarPad: 0.006, collarFront: -0.012,
    eyestay: { w: 0.03 },
    tongue: { wide: 0.024, rise: 0.05, back: 0.02, lift: 0.004, d: 0.005, rim: 0.004, tag: [0.026, 0.02] },
    laces: { rows: 7, w: 0.014, d: 0.0028, arch: 0.009, start: 0.02, end: 0.008 },
    sole: { height: [[0, 0.036], [0.6, 0.03], [1, 0.03]], toeWrap: 0.03, layers: FLAT(0.008) },
    stripeAnchor: [0.47, 0.11],
    materials: { toe: 'suede', out: 'rubber' },
    trims: [
      ({ backDecal }) => backDecal('cross', (g, w, h) => {
        g.strokeStyle = '#e9b414'; g.lineWidth = 5
        for (let y = 18; y < h; y += 30) {
          g.beginPath(); g.moveTo(w * 0.3, y - 8); g.lineTo(w * 0.7, y + 8); g.moveTo(w * 0.7, y - 8); g.lineTo(w * 0.3, y + 8); g.stroke()
        }
      }, { y0: 0.06, y1: 0.2, half: 0.016, lift: 0.0052, w: 128, h: 256 }),
    ],
    panels: [
      // Suede toe reinforcement running back along the sides
      mudguard([[0.56, 0.004], [0.64, 0.03], [0.76, 0.045], [0.88, 0.06], [0.95, 0.09], [1, 0.2]], { role: 'toe', d: 0.0026 }),
      counter([[0, 0.23], [0.05, 0.17], [0.1, 0.11], [0.15, 0.05], [0.18, 0.004]]),
      // Crossing stripes: two thick S-curves
      ribbon('stripe', [[0.24, 0.034], [0.32, 0.046], [0.4, 0.074], [0.46, 0.108], [0.51, 0.142], [0.56, 0.166]], [[0.24, 0.03], [0.4, 0.046], [0.56, 0.036]], 0.24, 0.56),
      ribbon('stripe', [[0.37, 0.166], [0.42, 0.15], [0.48, 0.118], [0.54, 0.08], [0.6, 0.05], [0.67, 0.034]], [[0.37, 0.034], [0.5, 0.046], [0.67, 0.03]], 0.37, 0.67, { lift: 0.0048 }),
      heelTab(0.018, 0.2, { taper: 0.1 }),
    ],
  },
}
