import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { createShoe } from '../three/shoe.js'
import { createStudio, roomEnvironment } from '../three/studio.js'

export function Studio({ intensity = 0.7, shadows = true }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const rig = useMemo(() => createStudio({ shadows }), [shadows])
  useEffect(() => {
    scene.environment = roomEnvironment(gl)
    scene.environmentIntensity = intensity
    return () => { scene.environment = null }
  }, [gl, scene, intensity])
  return <primitive object={rig} />
}

export function ProceduralShoe({ spec, detail = 'full', ...props }) {
  const shoe = useMemo(() => createShoe(spec, detail), [spec, detail])
  return <primitive object={shoe} {...props} />
}

const v = new Vector3(), n = new Vector3(), eye = new Vector3()

// Projects 3D points onto DOM nodes each frame.
// pins: [{ position, normal?, object? }]; nodes: ref to an array of elements.
export function PinLayer({ pins, nodes }) {
  useFrame(({ camera, size }) => {
    pins.forEach((pin, i) => {
      const el = nodes.current[i]
      if (!el || !pin) return
      v.fromArray(pin.position)
      if (pin.object?.current) v.applyMatrix4(pin.object.current.matrixWorld)
      let facing = true
      if (pin.normal) {
        n.fromArray(pin.normal)
        if (pin.object?.current) n.transformDirection(pin.object.current.matrixWorld)
        facing = n.dot(eye.copy(camera.position).sub(v).normalize()) > 0.08
      }
      v.project(camera)
      const visible = facing && v.z < 1
      el.style.transform = `translate3d(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px, 0)`
      if (el.dataset.visible !== String(visible)) el.dataset.visible = visible
    })
  })
  return null
}

// Absolutely positioned layer that mirrors the canvas box
export function Pins({ children, className = '' }) {
  return <div className={`pins ${className}`}>{children}</div>
}
