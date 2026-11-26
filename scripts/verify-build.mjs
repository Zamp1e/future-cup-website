import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const base = 'http://127.0.0.1:4173/'
const out = resolve('.impeccable/build')
mkdirSync(out, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

let browser
try { browser = await chromium.launch({ channel: 'chrome', headless: true }) }
catch (e) { browser = await chromium.launch({ headless: true }) }

// 记录两个按钮在建造过程中的 class 变化时间线
const installLog = () => {
  window.__buildLog = { t0: performance.now(), events: [] }
  const seen = { cta: new Set(), download: new Set() }
  const watch = () => {
    const pairs = [['[data-build="cta"]', 'cta'], ['[data-build="download"]', 'download']]
    if (pairs.some(([s]) => !document.querySelector(s))) { requestAnimationFrame(watch); return }
    for (const [sel, key] of pairs) {
      const el = document.querySelector(sel)
      new MutationObserver(() => {
        for (const cls of ['is-built', 'is-pressed']) {
          if (el.classList.contains(cls) && !seen[key].has(cls)) {
            seen[key].add(cls)
            window.__buildLog.events.push({ key, cls, t: performance.now() - window.__buildLog.t0 })
          }
        }
      }).observe(el, { attributes: true, attributeFilter: ['class'] })
    }
  }
  watch()
}

async function runBuildAudit(label, viewport, isMobile = false) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(installLog)

  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.documentElement.dataset.stage === 'building', { timeout: 12000 })
  const early = await page.evaluate(() => ({
    cta: getComputedStyle(document.querySelector('[data-build="cta"]')).visibility,
    download: getComputedStyle(document.querySelector('[data-build="download"]')).visibility,
  }))

  // 光标按下下载按钮的瞬间截图（is-pressed 存在约 500ms）
  let shot = false
  try {
    await page.waitForFunction(() => document.querySelector('[data-build="download"]').classList.contains('is-pressed'), { timeout: 15000 })
    await page.screenshot({ path: resolve(out, `${label}-drawing.png`) })
    shot = true
  } catch (e) { /* 时序错过则跳过截图，仍以事件日志为准 */ }

  await page.waitForFunction(() => document.documentElement.dataset.stage === 'live', { timeout: 25000 })
  const log = await page.evaluate(() => window.__buildLog.events)
  const ev = (key, cls) => log.find((e) => e.key === key && e.cls === cls)
  const dBuilt = ev('download', 'is-built'), dPressed = ev('download', 'is-pressed')
  const cPressed = ev('cta', 'is-pressed')

  check(`${label}：建造期间按钮先隐藏（参与编舞而非直接显示）`,
    early.cta === 'hidden' && early.download === 'hidden', `cta=${early.cta} download=${early.download}`)
  check(`${label}：下载按钮被光标画框落位（is-built）`, !!dBuilt, dBuilt ? `@${Math.round(dBuilt.t)}ms` : '未出现')
  check(`${label}：下载按钮被光标点下（is-pressed）`, !!dPressed, dPressed ? `@${Math.round(dPressed.t)}ms` : '未出现')
  check(`${label}：落位先于按下`, !!dBuilt && !!dPressed && dBuilt.t <= dPressed.t,
    dBuilt && dPressed ? `${Math.round(dBuilt.t)}ms → ${Math.round(dPressed.t)}ms` : '')
  check(`${label}：与主 CTA 同组并发绘制`, !!dPressed && !!cPressed && Math.abs(dPressed.t - cPressed.t) < 2000,
    dPressed && cPressed ? `CTA @${Math.round(cPressed.t)}ms / 下载 @${Math.round(dPressed.t)}ms` : '')
  check(`${label}：动画结束时可见且无异常`,
    (await page.locator('.btn-download').isVisible()) && errors.length === 0,
    errors.join(' | ') || '0 errors')
  if (!shot) console.log(`  （${label} 中间态截图未抓到，事件日志已证明参与编舞）`)
  await ctx.close()
}

await runBuildAudit('desktop', { width: 1440, height: 900 })
await runBuildAudit('mobile', { width: 390, height: 844 }, true)

// reduced motion：不播放编舞，但按钮必须直接完整可见
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const rp = await rm.newPage()
await rp.goto(base, { waitUntil: 'networkidle' })
await rp.waitForTimeout(300)
check('reduced motion：跳过编舞但按钮完整可见', await rp.locator('.btn-download').isVisible() &&
  (await rp.locator('.btn-download').evaluate((e) => getComputedStyle(e).visibility)) === 'visible')
await rm.close()

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
