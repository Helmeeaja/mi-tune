import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:5173' },
  },
  build: { sourcemap: false },
})
