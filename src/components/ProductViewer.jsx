import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { BakeShadows, OrbitControls, useGLTF, useProgress } from '@react-three/drei'
import { Box3, MathUtils, Spherical, Vector3 } from 'three'
import { shoeAnchors } from '../three/shoe.js'
import { PinLayer, Pins, ProceduralShoe, Studio, StudioEffects } from './SceneKit.jsx'

const TARGET = [0, 0.13, 0]
const VIEWS = {
  '3/4': [1.46, 0.75, 1.68],
  Side: [0, 0.25, 2.35],
  Top: [0.05, 2.35, 0.02],
  Heel: [-2.1, 0.5, 0.4],
}
const MIN = 0.45, MAX = 4
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const coarse = window.matchMedia('(pointer: coarse)').matches
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

// Any GLB, scaled to the procedural shoe's footprint
function GltfModel({ url }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const s = scene.clone()
    const box = new Box3().setFromObject(s), size = box.getSize(new Vector3())
    if (size.z > size.x) s.rotation.y = Math.PI / 2
    s.scale.setScalar(1.04 / Math.max(size.x, size.z))
    box.setFromObject(s)
    const c = box.getCenter(new Vector3())
    s.position.set(-c.x, -box.min.y, -c.z)
    s.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true))
    return s
  }, [scene])
  return <primitive object={model} />
}

// Orbit controls plus spherical camera flights
function Rig({ api, autoRotate, onUserStart }) {
  const controls = useRef()
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const flight = useRef(null)

  useEffect(() => {
    const sph = (pos, target) => new Spherical().setFromVector3(new Vector3().subVectors(pos, target))
    api.current = {
      fly(position, target = TARGET) {
        const c = controls.current
        const to = new Vector3(...target)
        const from = { target: c.target.clone(), s: sph(camera.position, c.target) }
        const end = { target: to, s: sph(new Vector3(...position), to) }
        end.s.radius = MathUtils.clamp(end.s.radius, MIN, MAX)
        let dTheta = end.s.theta - from.s.theta
        dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta))
        flight.current = { from, end, dTheta, t: reducedMotion() ? 1 : 0 }
        invalidate() // demand frameloop: kick the first frame; controls' change events keep it going
      },
      zoom(f) {
        const c = controls.current
        const offset = camera.position.clone().sub(c.target).multiplyScalar(f)
        this.fly(c.target.clone().add(offset).toArray(), c.target.toArray())
      },
    }
  }, [api, camera, invalidate])

  // Auto-rotate only advances inside a frame, so keep requesting frames while it is on
  useEffect(() => { if (autoRotate) invalidate() }, [autoRotate, invalidate])

  useFrame((state, dt) => {
    if (autoRotate) state.invalidate()
    const f = flight.current, c = controls.current
    if (!f || !c) return
    f.t = Math.min(1, f.t + dt / 0.9)
    const k = ease(f.t)
    c.target.lerpVectors(f.from.target, f.end.target, k)
    const s = new Spherical(
      MathUtils.lerp(f.from.s.radius, f.end.s.radius, k),
      MathUtils.lerp(f.from.s.phi, f.end.s.phi, k),
      f.from.s.theta + f.dTheta * k
    )
    camera.position.setFromSpherical(s).add(c.target)
    c.update()
    if (f.t === 1) flight.current = null
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={TARGET}
      enableDamping
      enablePan={false}
      minDistance={MIN}
      maxDistance={MAX}
      maxPolarAngle={Math.PI * 0.53}
      autoRotate={autoRotate}
      autoRotateSpeed={0.7}
      onStart={() => { flight.current = null; onUserStart() }}
    />
  )
}

function GltfProgress() {
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <div className="viewer-loading" role="status">
      <span className="label">Loading 3D model · {progress.toFixed(0)}%</span>
      <span className="bar"><span style={{ width: `${progress}%` }} /></span>
    </div>
  )
}

export default function ProductViewer({ product: p }) {
  const procedural = typeof p.model3D === 'object'
  const pins = useMemo(() => {
    const anchors = procedural ? shoeAnchors(p.model3D) : {}
    return p.hotspots.map((h) => (h.at ? anchors[h.at] : h.position ? { position: h.position } : null) ?? null)
  }, [p, procedural])
  const pinEls = useRef([])
  const api = useRef(null)
  const [active, setActive] = useState(null)
  const [spin, setSpin] = useState(!reducedMotion())
  const [touched, setTouched] = useState(false)
  const [view, setView] = useState('3/4')

  const stop = () => { setSpin(false); setTouched(true) }
  const goView = (name) => { stop(); setView(name); setActive(null); api.current?.fly(VIEWS[name]) }
  const focus = (i) => {
    stop()
    setView(null)
    if (i === active || i === null) {
      setActive(null)
      api.current?.fly(VIEWS['3/4'])
      return
    }
    setActive(i)
    if (!pins[i]) return
    const { position, normal = [0.4, 0.6, 0.7] } = pins[i]
    // Lean toward the lateral side so every detail keeps context
    const dir = new Vector3(...normal).normalize().add(new Vector3(0, 0.35, 0.9)).normalize()
    const cam = new Vector3(...position).add(dir.multiplyScalar(1.25))
    api.current?.fly(cam.toArray(), position)
  }

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && active !== null && focus(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const hotspot = active !== null ? p.hotspots[active] : null

  return (
    <div className="viewer-wrap">
      <div className="viewer">
        <Canvas
          shadows="percentage"
          frameloop="demand"
          dpr={[1, 1.5]}
          camera={{ position: VIEWS['3/4'], fov: 30, near: 0.01, far: 50 }}
          role="img"
          aria-label={`Interactive 3D model of ${p.name}`}
        >
          <Studio />
          <Suspense fallback={null}>
            {procedural ? <ProceduralShoe spec={p.model3D} /> : <GltfModel url={p.model3D} />}
            {/* Shoe and lights never move, only the camera: draw the 2048² shadow map once */}
            <BakeShadows />
          </Suspense>
          <Rig api={api} autoRotate={spin} onUserStart={stop} />
          <PinLayer pins={pins} nodes={pinEls} />
          <StudioEffects quality={window.innerWidth < 720 ? 'Low' : 'Medium'} />
        </Canvas>

        <Pins>
          {pins.map((_, i) => (
            <button
              key={i}
              ref={(el) => (pinEls.current[i] = el)}
              className={`pin ${active === i ? 'on' : ''}`}
              onClick={() => focus(i)}
              aria-label={`Hotspot: ${p.hotspots[i].label}`}
              aria-pressed={active === i}
              tabIndex={-1}
            >
              {i + 1}
            </button>
          ))}
        </Pins>

        {!touched && <p className="viewer-hint">{coarse ? 'Drag to rotate · Pinch to zoom' : 'Drag to rotate · Scroll to zoom'}</p>}
        {!procedural && <GltfProgress />}

        {hotspot && (
          <div className="hotspot-info" role="status">
            <div className="label">Detail {active + 1}/{p.hotspots.length}</div>
            <strong>{hotspot.label}</strong>
            <p>{hotspot.description}</p>
            <div className="row">
              <button className="link" onClick={() => focus((active + 1) % pins.length)}>Next detail →</button>
              <button className="link" onClick={() => focus(null)}>Close</button>
            </div>
          </div>
        )}

        <div className="viewer-toolbar">
          <div className="seg" role="group" aria-label="Camera angle">
            {Object.keys(VIEWS).map((name) => (
              <button key={name} aria-pressed={view === name} onClick={() => goView(name)}>{name}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Viewer controls">
            <button className="zoom" onClick={() => (stop(), api.current?.zoom(0.75))} aria-label="Zoom in">+</button>
            <button className="zoom" onClick={() => (stop(), api.current?.zoom(1.33))} aria-label="Zoom out">−</button>
            <button onClick={() => setSpin((s) => !s)} aria-pressed={spin} aria-label="Auto-rotate">⟳</button>
            <button onClick={() => goView('3/4')}>Reset</button>
          </div>
        </div>
      </div>

      {p.hotspots.length > 0 && (
        <div className="inspect" role="group" aria-label="Inspect details">
          <span className="label">Inspect</span>
          {p.hotspots.map((h, i) => (
            <button key={h.label} className={`chip ${active === i ? 'on' : ''}`} aria-pressed={active === i} onClick={() => focus(i)}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span> {h.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
