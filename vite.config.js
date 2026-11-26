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
        // 舞台脚本以普通 defer 引入（保证 file:// 也能运行），Vite 不会自动处理，手动复制进产物
        this.emitFile({
          type: 'asset',
          fileName: 'app.js',
          source: readFileSync(resolve(root, 'app.js')),
        })
        // OG / Twitter 的 content="assets/og.png" 写在 meta 里，Vite 不处理该属性，
        // 不手动复制会让线上分享预览图 404
        this.emitFile({
          type: 'asset',
          fileName: 'assets/og.png',
          source: readFileSync(resolve(root, 'assets/og.png')),
        })
      },
    },
  ],
})
