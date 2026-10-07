import * as THREE from 'three'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import products from '../data/products.json'
import { createShoe } from '../three/shoe.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { N8AOPass } from 'n8ao'
import { createStudio, roomEnvironment, studioBackdrop } from '../three/studio.js'

// Dev-only: studio shots of every procedural product
const SIZE = 1200
const params = new URLSearchParams(location.search)
const VIEWS = {
  1: { position: [1.24, 0.58, 1.44], target: [0, 0.12, 0] },
  2: { position: [0, 0.26, 2.25], target: [0, 0.15, 0] },
  // Debug close-ups, rendered only when requested via ?views=
  top: { position: [0.42, 0.7, 0.62], target: [-0.02, 0.24, 0], debug: true },
  heel: { position: [-1.1, 0.5, 0.9], target: [-0.3, 0.18, 0], debug: true },
  back: { position: [-2.3, 0.3, 0], target: [0, 0.16, 0], debug: true },
  backzoom: { position: [-1.0, 0.32, 0.05], target: [-0.45, 0.24, 0], debug: true },
  above: { position: [0.001, 2.4, 0.0], target: [0, 0.15, 0], debug: true },
  front: { position: [2.3, 0.45, 0.25], target: [0, 0.14, 0], debug: true },
}

// Distinct colour per part to inspect geometry
const DEBUG = {
  base: '#e8e8e8', toe: '#7fb3ff', mudguard: '#ffb366', heel: '#8be08b', eyestay: '#ff7a7a', collar: '#c58cff',
  stripe: '#333333', tab: '#ffe066', tongue: '#66d9d9', lining: '#555555', lace: '#ff4fa3', mid: '#cccccc', out: '#999999', thread: '#222222', tag: '#ff0000',
}

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(SIZE, SIZE)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
scene.environment = roomEnvironment(renderer)
scene.environmentIntensity = 0.6
scene.background = studioBackdrop()
scene.add(createStudio())
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50)

// Ambient occlusion, then tone mapping + sRGB in the output pass
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.82
const target = new THREE.WebGLRenderTarget(SIZE, SIZE, { type: THREE.HalfFloatType, samples: 8 })
const composer = new EffectComposer(renderer, target)
const ao = new N8AOPass(scene, camera, SIZE, SIZE)
Object.assign(ao.configuration, { aoRadius: 0.08, distanceFalloff: 0.4, intensity: 3, gammaCorrection: false, halfRes: false })
ao.setQualityMode('Ultra')
composer.addPass(ao)
composer.addPass(new OutputPass())

const out = document.createElement('canvas')
out.width = out.height = SIZE
const ctx = out.getContext('2d')

function shot(view) {
  camera.position.set(...view.position)
  camera.lookAt(...view.target)
  ao.enabled = !params.has('noao')
  composer.render()
  ctx.drawImage(renderer.domElement, 0, 0)
  return out.toDataURL('image/webp', 0.88)
}

await document.fonts.load('900 104px "Archivo Variable"')
await document.fonts.load('500 20px "JetBrains Mono Variable"')
await document.fonts.load('400 24px "Inter Variable"')

const shots = {}
const grid = document.getElementById('grid')
const only = params.get('only')?.split(',')
const views = params.get('views')?.split(',')
for (const p of products.filter((x) => x.model3D && typeof x.model3D === 'object' && (!only || only.includes(x.id)))) {
  const spec = params.has('debug') ? { ...p.model3D, colors: DEBUG } : p.model3D
  const shoe = createShoe(spec, 'full')
  scene.add(shoe)
  const base = p.images[0].split('/').pop().replace(/-1\.webp$/, '')
  for (const [n, view] of Object.entries(VIEWS).filter(([n, v]) => (views ? views.includes(n) : !v.debug))) {
    const name = `${base}-${n}.webp`
    shots[name] = shot(view)
    grid.insertAdjacentHTML('beforeend', `<figure><img src="${shots[name]}" alt=""><figcaption>${name}</figcaption></figure>`)
  }
  scene.remove(shoe)
}
// Link-preview card: copy left, hero shoe right
if (!only) {
  const og = document.createElement('canvas')
  og.width = 1200
  og.height = 630
  const g = og.getContext('2d')
  const bg = g.createRadialGradient(860, 300, 0, 860, 300, 700)
  bg.addColorStop(0, '#1d1d20')
  bg.addColorStop(1, '#0a0a0a')
  g.fillStyle = bg
  g.fillRect(0, 0, 1200, 630)
  const hero = products.find((p) => p.id === 'ORI-NK-AJ1-001')
  const shoe = createShoe(hero.model3D, 'full')
  scene.add(shoe)
  camera.position.set(1.24, 0.58, 1.44)
  camera.lookAt(0, 0.12, 0)
  scene.background = null
  renderer.render(scene, camera)
  scene.background = studioBackdrop()
  scene.remove(shoe)
  g.drawImage(renderer.domElement, 0, 0, SIZE, SIZE, 575, 40, 570, 570)
  g.fillStyle = '#8a8a8a'
  g.font = '500 20px "JetBrains Mono Variable", Consolas, monospace'
  g.fillText('INTERACTIVE SNEAKER & STREETWEAR SHOWCASE', 64, 120)
  g.fillStyle = '#f5f5f5'
  g.fontStretch = 'expanded'
  g.font = '900 76px "Archivo Variable", "Arial Black", sans-serif'
  g.fillText('ORIGINALS,', 60, 236)
  g.lineWidth = 2
  g.strokeStyle = '#f5f5f5'
  g.strokeText('UP CLOSE.', 60, 316)
  g.fillStyle = '#8a8a8a'
  g.font = '400 24px "Inter Variable", system-ui, sans-serif'
  g.fontStretch = 'normal'
  g.fillText('Explore · Inspect · Verify · Buy', 64, 400)
  g.fillStyle = '#f5f5f5'
  g.font = '900 34px "Archivo Variable", "Arial Black", sans-serif'
  g.fillText('ORI', 64, 560)
  g.fillStyle = '#8a8a8a'
  g.font = '400 16px "JetBrains Mono Variable", Consolas, monospace'
  g.fillText('ACADEMIC PROTOTYPE', 150, 556)
  shots['og.webp'] = og.toDataURL('image/webp', 0.9)
  grid.insertAdjacentHTML('beforeend', `<figure style="grid-column: 1 / -1"><img src="${shots['og.webp']}" alt=""><figcaption>og.webp</figcaption></figure>`)
}

window.__shots = shots

const dl = document.getElementById('download')
dl.hidden = false
dl.onclick = () => {
  for (const [name, url] of Object.entries(shots)) Object.assign(document.createElement('a'), { href: url, download: name }).click()
}
