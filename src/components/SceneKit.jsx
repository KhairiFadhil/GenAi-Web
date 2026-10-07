import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { HalfFloatType, Vector3, WebGLRenderTarget } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { N8AOPass } from 'n8ao'
import { createShoe } from '../three/shoe.js'
import { createStudio, roomEnvironment, studioBackdrop } from '../three/studio.js'

// Same light, backdrop and exposure as the product photos
export function Studio({ intensity = 0.6, shadows = true, backdrop = true }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const rig = useMemo(() => createStudio({ shadows }), [shadows])
  useEffect(() => {
    scene.environment = roomEnvironment(gl)
    scene.environmentIntensity = intensity
    if (backdrop) scene.background = studioBackdrop()
    gl.toneMappingExposure = 0.82
    return () => { scene.environment = null; scene.background = null }
  }, [gl, scene, intensity, backdrop])
  return <primitive object={rig} />
}

// Ambient occlusion + tone mapping; takes over rendering for its canvas
export function StudioEffects({ quality = 'Medium' }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 }))
    const ao = new N8AOPass(scene, camera, 1, 1)
    Object.assign(ao.configuration, { aoRadius: 0.08, distanceFalloff: 0.4, intensity: 3, gammaCorrection: false })
    ao.setQualityMode(quality)
    c.addPass(ao)
    c.addPass(new OutputPass())
    return c
  }, [gl, scene, camera, quality])
  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio())
    composer.setSize(size.width, size.height)
  }, [composer, gl, size])
  useEffect(() => () => composer.dispose(), [composer])
  useFrame(() => composer.render(), 1)
  return null
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
