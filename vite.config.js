import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// three.js (~930 kB) lives in a lazy chunk loaded only by 3D views
export default defineConfig({ plugins: [react()], build: { chunkSizeWarningLimit: 1000 } })
