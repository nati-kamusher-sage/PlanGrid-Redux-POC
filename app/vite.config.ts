import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { dependencies: Record<string, string> }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __AG_GRID_VERSION__: JSON.stringify(pkg.dependencies['ag-grid-community']),
  },
})
