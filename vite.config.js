import { defineConfig } from 'vite'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'copy-evidence-originals',
      generateBundle() {
        const source = resolve(root, 'assets/evidence')
        for (const file of readdirSync(source)) {
          if (!/\.(png|jpe?g|svg|md)$/i.test(file)) continue
          this.emitFile({
            type: 'asset',
            fileName: `assets/evidence/${file}`,
            source: readFileSync(resolve(source, file)),
          })
        }
      },
    },
  ],
})
