import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/personal_website/',
  build: {
    outDir: 'dist',
  },
})
