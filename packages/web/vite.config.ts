import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const cliPkg = JSON.parse(readFileSync(resolve(__dirname, '../cli/package.json'), 'utf-8')) as { version: string }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(cliPkg.version),
  },
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3200',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
