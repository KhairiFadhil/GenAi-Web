import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Serves /api/* locally the way Vercel Functions do
function apiRoutes() {
  const handle = (load) => async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost')
    if (!url.pathname.startsWith('/api/')) return next()
    const name = url.pathname.slice(5).replace(/\/$/, '')
    const file = path.join(process.cwd(), 'api', `${name}.js`)
    if (!/^[a-z-]+$/.test(name) || !fs.existsSync(file)) return (res.statusCode = 404), res.end()
    const handler = (await load(file))[req.method]
    if (!handler) return (res.statusCode = 405), res.end()
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const response = await handler(new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
    }))
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(Buffer.from(await response.arrayBuffer()))
  }
  return {
    name: 'ori-api',
    configureServer(server) {
      server.middlewares.use(handle((file) => server.ssrLoadModule(file)))
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle((file) => import(pathToFileURL(file).href)))
    },
  }
}

// Same security headers as production
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
const headers = Object.fromEntries(vercel.headers.find((h) => h.source === '/(.*)').headers.map((h) => [h.key, h.value]))

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), '')) // server-only vars for /api
  return {
    plugins: [react(), apiRoutes()],
    preview: { headers },
    // three.js + AO (~1.1 MB) is a lazy chunk
    build: { chunkSizeWarningLimit: 1200 },
  }
})
