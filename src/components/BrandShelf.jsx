import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { CameraControls, Html } from '@react-three/drei'
import { products } from '../store.js'

const brands = [...new Set(products.map((p) => p.brand))]
const ROW = 1.3
const rowY = (i) => ((brands.length - 1) / 2 - i) * ROW
const FOV = 50

// Back the camera off until every row (height) and label-to-shelf-end (width ~9) fits the canvas.
function homeView() {
  const aspect = window.innerWidth / Math.min(window.innerHeight * 0.8, 760) // matches .shelf height
  const t = Math.tan((FOV / 2) * (Math.PI / 180))
  const z = Math.max((brands.length * ROW) / 2 / t, 9 / 2 / (t * aspect)) + 1
  return [-0.3, 0, z, -0.3, 0, 0]
}

// ponytail: every product is a shoebox for now; swap in useGLTF(p.model3D) per box once GLBs exist.
function Shoebox({ product: p, x, y, onSelect }) {
  const [hover, setHover] = useState(false)
  return (
    <mesh
      position={[x, y, 0]}
      onClick={(e) => (e.stopPropagation(), onSelect(p.id))}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true), (document.body.style.cursor = 'pointer'))}
      onPointerOut={() => (setHover(false), (document.body.style.cursor = ''))}
    >
      <boxGeometry args={[1, 0.55, 0.7]} />
      <meshStandardMaterial color={hover ? '#F5F5F5' : p.model3D ? '#c9c9c9' : '#3a3a3a'} />
      {hover && (
        <Html center position={[0, 0.5, 0]} className="shelf-tip">
          {p.name}
        </Html>
      )}
    </mesh>
  )
}

export default function BrandShelf({ onSelect }) {
  const cam = useRef()
  const [focus, setFocus] = useState(null)
  const [HOME] = useState(homeView)

  const goTo = (i) => {
    setFocus(i)
    if (i === null) cam.current.setLookAt(...HOME, true)
    else cam.current.setLookAt(0.6, rowY(i) + 0.3, 4.5, 0.6, rowY(i), 0, true)
  }

  return (
    <div className="shelf">
      <Canvas dpr={[1, 1.5]} camera={{ position: HOME.slice(0, 3), fov: FOV }}>
        <color attach="background" args={['#0A0A0A']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 6]} intensity={2} />
        {/* ponytail: drei 10.7.9 + React 19 drops the content of the first <Html> in a Canvas; this empty one absorbs it. Remove after a drei upgrade if labels still show. */}
        <Html />
        {brands.map((brand, i) => {
          const y = rowY(i)
          const items = products.filter((p) => p.brand === brand)
          return (
            <group key={brand}>
              <mesh position={[0, y - 0.31, 0]}>
                <boxGeometry args={[7, 0.06, 1]} />
                <meshStandardMaterial color="#1a1a1a" />
              </mesh>
              <Html position={[-3.5, y, 0]} center>
                <button className="shelf-label" onClick={() => goTo(focus === i ? null : i)}>{brand}</button>
              </Html>
              {items.map((p, j) => (
                <Shoebox key={p.id} product={p} x={-1.6 + j * 1.3} y={y} onSelect={onSelect} />
              ))}
            </group>
          )
        })}
        <CameraControls ref={cam} minDistance={3} maxDistance={HOME[2] + 4} />
      </Canvas>
      {focus !== null && <button className="btn shelf-back" onClick={() => goTo(null)}>← All brands</button>}
    </div>
  )
}
