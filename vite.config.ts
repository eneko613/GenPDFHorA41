import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // CRÍTICO: Rutas relativas para que funcione en cualquier subdominio
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
})