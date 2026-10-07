import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

// Soft radial texture (contact shadows, light pools)
export function radialTexture(inner, outer, size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d'), h = size / 2
  const r = g.createRadialGradient(h, h, 0, h, h, h)
  r.addColorStop(0, inner)
  r.addColorStop(1, outer)
  g.fillStyle = r
  g.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const envCache = new WeakMap()

// Neutral room reflections, one PMREM per renderer
export function roomEnvironment(renderer) {
  if (!envCache.has(renderer)) {
    const pmrem = new THREE.PMREMGenerator(renderer)
    envCache.set(renderer, pmrem.fromScene(new RoomEnvironment(), 0.04).texture)
    pmrem.dispose()
  }
  return envCache.get(renderer)
}

let contactTex
export const contactShadowTexture = () => (contactTex ??= radialTexture('rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'))

// Key / fill / rim rig with a shadow-catching floor
export function createStudio({ rim = '#ffd9c7', shadows = true } = {}) {
  const group = new THREE.Group()

  const key = new THREE.DirectionalLight('#fff6ee', 2.4)
  key.position.set(1.2, 2.6, 1.4)
  if (shadows) {
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    Object.assign(key.shadow.camera, { left: -0.8, right: 0.8, top: 0.8, bottom: -0.8, near: 0.5, far: 6 })
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.002
    key.shadow.radius = 5
  }
  const fill = new THREE.DirectionalLight('#dfe8ff', 0.6)
  fill.position.set(-1.5, 0.8, 1.6)
  const back = new THREE.DirectionalLight(rim, 1.1)
  back.position.set(-1.8, 1.2, -1.8)
  group.add(key, fill, back)

  const ao = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 0.55),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false })
  )
  ao.rotation.x = -Math.PI / 2
  ao.position.y = 0.0005
  group.add(ao)

  if (shadows) {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.ShadowMaterial({ opacity: 0.35 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    group.add(floor)
  }
  return group
}
