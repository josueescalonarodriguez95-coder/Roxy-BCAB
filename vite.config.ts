import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Mismo target que la app de bodega: así corre también en iPads/Safari viejos.
export default defineConfig({
  build: {
    target: ['es2017', 'safari12'],
  },
  plugins: [react()],
})
