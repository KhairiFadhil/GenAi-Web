import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { brands, catalogVersion, listed, products, rupiah } from '../store.js'
import { contactShadowTexture, radialTexture, roomEnvironment } from '../three/studio.js'
import { PinLayer, Pins, ProceduralShoe } from './SceneKit.jsx'

const CELL = { w: 2.5, h: 0.92, d: 1.3, t: 0.08 }
const FOV = 32
const NONE = { left: 0, middle: 0, right: 0, wheel: 0 }
const NO_TOUCH = { one: 0, two: 0, three: 0 }
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function layout(aspect) {
  const cols = aspect >= 2.1 ? 4 : 2
  const rows = Math.ceil(brands.length / cols)
  const pw = CELL.w + CELL.t, ph = CELL.h + CELL.t
  const cells = brands.map((brand, i) => {
    const c = i % cols, r = Math.floor(i / cols)
    const x = (c - (cols - 1) / 2) * pw, y = ((rows - 1) / 2 - r) * ph
    const list = products.filter((p) => listed(p) && p.brand === brand)
    const items = list.map((p, j) => ({
      product: p,
      cell: i,
      x: x + (list.length === 1 ? 0 : j === 0 ? -0.6 : 0.6),
      y: y - CELL.h / 2,
      turn: list.length === 1 ? -0.42 : j === 0 ? -0.5 : -0.3,
    }))
    return { brand, x, y, items }
  })
  return { cols, rows, pw, ph, width: cols * pw + CELL.t, height: rows * ph + CELL.t, cells, items: cells.flatMap((c) => c.items) }
}

const fitDistance = (w, h, aspect) => {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
  return Math.max(h / 2 / t, w / 2 / (t * aspect))
}

function Folded({ color }) {
  return [0, 1, 2].map((i) => (
    <RoundedBox key={i} args={[0.8, 0.085, 0.58]} radius={0.03} smoothness={3} position={[(i % 2) * 0.025 - 0.012, 0.045 + i * 0.088, i * 0.012]} rotation-y={(i - 1) * 0.05}>
      <meshStandardMaterial color={color} roughness={0.95} />
    </RoundedBox>
  ))
}

function Item({ item, hovered, setHover, onPick }) {
  const lift = useRef()
  const { product: p } = item
  useFrame((state, dt) => {
    const g = lift.current, k = 1 - Math.exp(-dt * 9)
    const dy = (hovered ? 0.07 : 0) - g.position.y, dr = (hovered ? 0.45 : 0) - g.rotation.y
    g.position.y += dy * k
    g.rotation.y += dr * k
    if (Math.abs(dy) + Math.abs(dr) > 1e-4) state.invalidate()
  })
  return (
    <group position={[item.x, item.y, 0.08]} rotation-y={item.turn}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.003} renderOrder={1}>
        <planeGeometry args={[1.25, 0.6]} />
        <meshBasicMaterial map={contactShadowTexture()} transparent depthWrite={false} opacity={0.85} />
      </mesh>
      <group ref={lift}>
        {p.model3D && typeof p.model3D === 'object' ? <ProceduralShoe spec={p.model3D} detail="lite" scale={0.95} /> : <Folded color={p.swatch ?? '#888'} />}
      </group>
      <mesh
        position={[0, 0.2, 0]}
        onPointerOver={(e) => (e.stopPropagation(), setHover(p.id), (document.body.style.cursor = 'pointer'))}
        onPointerOut={() => (setHover(null), (document.body.style.cursor = ''))}
        onClick={(e) => (e.stopPropagation(), onPick(item))}
      >
        <boxGeometry args={[1.05, 0.46, 0.5]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Wall({ L }) {
  const frame = useMemo(() => new THREE.MeshStandardMaterial({ color: '#171717', roughness: 0.62, metalness: 0.15 }), [])
  const back = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0f0f0f', roughness: 0.9 }), [])
  const pool = useMemo(() => radialTexture('rgba(255,240,222,0.55)', 'rgba(255,240,222,0)'), [])
  const glow = useMemo(() => radialTexture('rgba(255,244,230,0.22)', 'rgba(255,244,230,0)'), [])
  const zf = CELL.d / 2
  return (
    <group>
      <mesh position={[0, 0, -zf]} material={back}>
        <planeGeometry args={[L.width, L.height]} />
      </mesh>
      {Array.from({ length: L.rows + 1 }, (_, r) => (
        <mesh key={`h${r}`} position={[0, L.height / 2 - CELL.t / 2 - r * L.ph, 0]} material={frame}>
          <boxGeometry args={[L.width, CELL.t, CELL.d]} />
        </mesh>
      ))}
      {Array.from({ length: L.cols + 1 }, (_, c) => (
        <mesh key={`v${c}`} position={[-L.width / 2 + CELL.t / 2 + c * L.pw, 0, 0]} material={frame}>
          <boxGeometry args={[CELL.t, L.height, CELL.d]} />
        </mesh>
      ))}
      {L.cells.map((c) => (
        <group key={c.brand} position={[c.x, c.y, 0]}>
          <mesh position={[0, CELL.h / 2 - 0.012, zf - 0.07]}>
            <boxGeometry args={[CELL.w - 0.1, 0.014, 0.03]} />
            <meshBasicMaterial color="#fff4e6" toneMapped={false} />
          </mesh>
          <mesh position={[0, -CELL.h / 2 + 0.002, 0.05]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[CELL.w * 0.95, CELL.d * 0.95]} />
            <meshBasicMaterial map={pool} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh position={[0, 0.05, -zf + 0.004]}>
            <planeGeometry args={[CELL.w * 1.1, CELL.h * 1.3]} />
            <meshBasicMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Env() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    scene.environment = roomEnvironment(gl)
    scene.environmentIntensity = 0.45
    invalidate()
  }, [gl, scene, invalidate])
  return null
}

function Rig({ L, focus, controls, wall }) {
  const size = useThree((s) => s.size)
  const aspect = size.width / size.height
  const intro = useRef(true)

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const smooth = !reducedMotion()
    if (focus == null) {
      const d = fitDistance(L.width + 0.7, L.height + 0.6, aspect)
      if (intro.current && smooth) c.setLookAt(0, -0.6, d * 1.35, 0, 0, 0, false)
      c.setLookAt(0, 0, d, 0, 0, 0, smooth)
    } else {
      const cell = L.cells[focus]
      const d = fitDistance(CELL.w + 0.6, CELL.h + 0.8, aspect)
      c.setLookAt(cell.x, cell.y + 0.12, d, cell.x, cell.y - 0.06, 0, smooth)
    }
    intro.current = false
  }, [focus, L, aspect, controls])

  // Gentle parallax toward the pointer
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const el = gl.domElement
    el.addEventListener('pointermove', invalidate)
    return () => el.removeEventListener('pointermove', invalidate)
  }, [gl, invalidate])
  useFrame((state, dt) => {
    const g = wall.current
    if (!g || reducedMotion()) return
    const k = 1 - Math.exp(-dt * 3), still = focus != null ? 0.4 : 1
    const dy = state.pointer.x * 0.05 * still - g.rotation.y, dx = -state.pointer.y * 0.025 * still - g.rotation.x
    g.rotation.y += dy * k
    g.rotation.x += dx * k
    if (Math.abs(dy) + Math.abs(dx) > 1e-4) state.invalidate()
  })
  return <CameraControls ref={controls} mouseButtons={NONE} touches={NO_TOUCH} smoothTime={0.55} />
}

export default function BrandShelf({ onSelect }) {
  const box = useRef()
  const controls = useRef()
  const wall = useRef()
  const pinEls = useRef([])
  const [aspect, setAspect] = useState(1.2)
  const [focus, setFocus] = useState(null)
  const [hover, setHover] = useState(null)
  const [visible, setVisible] = useState(true)
  const L = useMemo(() => layout(aspect), [aspect, catalogVersion])

  useEffect(() => {
    const el = box.current
    const ro = new ResizeObserver(([e]) => setAspect(e.contentRect.width / Math.max(1, e.contentRect.height)))
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting))
    ro.observe(el)
    io.observe(el)
    return () => (ro.disconnect(), io.disconnect())
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setFocus(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => () => { document.body.style.cursor = '' }, [])

  const pick = (item) => (focus === item.cell ? onSelect(item.product.id) : setFocus(item.cell))
  const zf = CELL.d / 2
  const pins = useMemo(() => [
    ...L.cells.map((c) => ({ position: [c.x - CELL.w / 2 + 0.06, c.y - CELL.h / 2 - CELL.t / 2, zf + 0.01], object: wall })),
    ...L.items.map((it) => ({ position: [it.x, it.y + 0.5, 0.1], object: wall })),
  ], [L, zf])
  const active = focus != null ? L.cells[focus] : null

  return (
    <div className={`shelf ${focus != null ? 'focused' : ''}`} ref={box}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={visible ? 'demand' : 'never'}
        camera={{ fov: FOV, position: [0, 0, 12], near: 0.1, far: 60 }}
        onPointerMissed={() => focus != null && setFocus(null)}
      >
        <color attach="background" args={['#0a0a0a']} />
        <Env />
        <ambientLight intensity={0.35} />
        <directionalLight position={[2, 4, 8]} intensity={1.6} />
        <directionalLight position={[-4, 2, 3]} intensity={0.5} color="#dfe8ff" />
        <group ref={wall}>
          <Wall L={L} />
          {L.items.map((it) => (
            <Item key={it.product.id} item={it} hovered={hover === it.product.id} setHover={setHover} onPick={pick} />
          ))}
        </group>
        <Rig L={L} focus={focus} controls={controls} wall={wall} />
        <PinLayer pins={pins} nodes={pinEls} />
      </Canvas>

      <Pins>
        {L.cells.map((c, i) => (
          <button
            key={c.brand}
            ref={(el) => (pinEls.current[i] = el)}
            className={`shelf-label ${focus === i ? 'on' : ''}`}
            onClick={() => setFocus(focus === i ? null : i)}
            aria-pressed={focus === i}
            aria-label={`${c.brand}, ${c.items.length} ${c.items.length === 1 ? 'product' : 'products'}`}
          >
            {c.brand} <span className="mono">{String(c.items.length).padStart(2, '0')}</span>
          </button>
        ))}
        {L.items.map((it, j) => {
          const p = it.product, shown = hover === p.id || focus === it.cell
          return (
            <Link
              key={p.id}
              ref={(el) => (pinEls.current[L.cells.length + j] = el)}
              to={`/product/${p.id}`}
              className={`shelf-tag ${shown ? 'show' : ''} ${focus === it.cell ? 'focus' : ''}`}
              tabIndex={focus === it.cell ? 0 : -1}
              aria-hidden={focus !== it.cell}
            >
              <strong>{p.name}</strong>
              <span>{rupiah(p.price)}{p.stock === 0 ? ' · Sold out' : ''}</span>
            </Link>
          )
        })}
      </Pins>

      {active ? (
        <div className="shelf-bar">
          <button className="btn" onClick={() => setFocus(null)}>← All brands</button>
          <span className="label">{active.brand} · {active.items.length} {active.items.length === 1 ? 'product' : 'products'}</span>
          <Link className="link" to={`/collection?brand=${encodeURIComponent(active.brand)}`}>View in collection</Link>
        </div>
      ) : (
        <p className="shelf-hint label">Select a brand to step closer</p>
      )}
    </div>
  )
}
