import * as THREE from 'three'
import products from '../data/products.json'
import { createShoe } from '../three/shoe.js'
import { createStudio, roomEnvironment } from '../three/studio.js'

// Dev-only: studio shots of every procedural product
const SIZE = 1200
const VIEWS = {
  1: { position: [1.24, 0.58, 1.44], target: [0, 0.12, 0] },
  2: { position: [0, 0.26, 2.25], target: [0, 0.15, 0] },
}

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(SIZE, SIZE)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
scene.environment = roomEnvironment(renderer)
scene.environmentIntensity = 0.7
scene.add(createStudio())
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50)

const out = document.createElement('canvas')
out.width = out.height = SIZE
const ctx = out.getContext('2d')

function shot(view) {
  camera.position.set(...view.position)
  camera.lookAt(...view.target)
  renderer.render(scene, camera)
  const bg = ctx.createRadialGradient(SIZE / 2, SIZE * 0.42, 0, SIZE / 2, SIZE * 0.42, SIZE * 0.75)
  bg.addColorStop(0, '#1d1d20')
  bg.addColorStop(1, '#0e0e0f')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.drawImage(renderer.domElement, 0, 0)
  return out.toDataURL('image/webp', 0.88)
}

const shots = {}
const grid = document.getElementById('grid')
for (const p of products.filter((x) => x.model3D && typeof x.model3D === 'object')) {
  const shoe = createShoe(p.model3D, 'full')
  scene.add(shoe)
  const base = p.images[0].split('/').pop().replace(/-1\.webp$/, '')
  for (const [n, view] of Object.entries(VIEWS)) {
    const name = `${base}-${n}.webp`
    shots[name] = shot(view)
    grid.insertAdjacentHTML('beforeend', `<figure><img src="${shots[name]}" alt=""><figcaption>${name}</figcaption></figure>`)
  }
  scene.remove(shoe)
}
window.__shots = shots

const dl = document.getElementById('download')
dl.hidden = false
dl.onclick = () => {
  for (const [name, url] of Object.entries(shots)) Object.assign(document.createElement('a'), { href: url, download: name }).click()
}
