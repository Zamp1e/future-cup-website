import { defineConfig } from 'vite'
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'copy-evidence-originals',
      closeBundle() {
        const source = resolve(root, 'assets/evidence')
        const target = resolve(root, 'dist/assets/evidence')
        mkdirSync(target, { recursive: true })
        cpSync(source, target, { recursive: true })
      },
    },
  ],
})
