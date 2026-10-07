import { Suspense, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, Html, Loader, OrbitControls, useBounds, useGLTF } from '@react-three/drei'
import { Vector3 } from 'three'

const START = [0.6, 0.4, 1.2] // initial camera direction (3/4 front view)

function Model({ url }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} />
}

// Exposes "back to the starting angle, fitted to the model" to the DOM reset button.
function ResetHook({ resetRef }) {
  const bounds = useBounds()
  resetRef.current = () => {
    const { center, distance } = bounds.refresh().getSize()
    const position = new Vector3(...START).normalize().multiplyScalar(distance).add(center)
    bounds.to({ position, target: center })
  }
  return null
}

export default function ProductViewer({ product: p }) {
  const reset = useRef(() => {})
  const [active, setActive] = useState(null)

  return (
    <div className="viewer">
      <Canvas dpr={[1, 1.5]} camera={{ position: START, fov: 40 }}>
        <color attach="background" args={['#111111']} />
        {/* ponytail: drei 10.7.9 + React 19 drops the content of the first <Html> in a Canvas; this empty one absorbs it. Remove after a drei upgrade if labels still show. */}
        <Html />
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 2]} intensity={2.5} />
        <directionalLight position={[-2, 1, -2]} intensity={0.8} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.3}>
            <ResetHook resetRef={reset} />
            <Model url={p.model3D} />
            {p.hotspots.map((h, i) => (
              <Html key={h.label} position={h.position} center>
                <button className={`hotspot ${active === i ? 'on' : ''}`} onClick={() => setActive(active === i ? null : i)}>
                  +
                </button>
              </Html>
            ))}
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enablePan={false} />
      </Canvas>
      <Loader containerStyles={{ position: 'absolute' }} dataInterpolation={(n) => `LOADING 3D EXPERIENCE ${n.toFixed(0)}%`} />
      {active !== null && (
        <div className="hotspot-info">
          <strong>{p.hotspots[active].label.toUpperCase()}</strong>
          <p>{p.hotspots[active].description}</p>
        </div>
      )}
      <div className="viewer-controls">
        <span>Drag to rotate · Scroll / pinch to zoom</span>
        <button className="btn" onClick={() => reset.current()}>Reset</button>
      </div>
    </div>
  )
}
