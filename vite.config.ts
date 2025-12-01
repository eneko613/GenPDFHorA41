import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANTE: Si tu repo en github es https://usuario.github.io/mi-app/
  // debes cambiar la base a '/mi-app/'
  // Si lo subes a la raíz, déjalo como './'
  base: './', 
})