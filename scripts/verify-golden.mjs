import { launchBrowser } from './launch-browser.mjs'

const base = 'http://127.0.0.1:4173/'
const PHI = 1.618
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await launchBrowser()

const widths = [1440, 1400, 1366, 1320, 1280, 1240, 1200, 1180, 1140, 1100, 1060, 1001]
const errors = []
let minGap = Infinity, minSvg = Infinity, minRatio = Infinity, maxRatio = 0

for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForTimeout(260)

  const r = await page.evaluate(() => {
    const rect = (s) => {
      const b = document.querySelector(s).getBoundingClientRect()
      return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }
    }
    const panel = rect('.build-panel'), slot = rect('.build-slot'), svg = rect('.bp-svg')
    const titleRight = Math.max(...[...document.querySelectorAll('.title-line')].map((e) => e.getBoundingClientRect().right))
    return {
      ratio: panel.w / panel.h,
      radius: getComputedStyle(document.querySelector('.build-panel')).borderTopLeftRadius,
      gap: panel.l - titleRight,
      svgH: svg.h,
      overflowY: panel.b > slot.b + 2,
      scrollW: document.documentElement.scrollWidth,
      viewBox: document.querySelector('.bp-svg').getAttribute('viewBox'),
      footVisible: rect('.bp-foot').b <= panel.b + 2,
    }
  })

  minGap = Math.min(minGap, r.gap)
  minSvg = Math.min(minSvg, r.svgH)
  minRatio = Math.min(minRatio, r.ratio)
  maxRatio = Math.max(maxRatio, r.ratio)

  const ok = Math.abs(r.ratio - PHI) < .01 && r.radius === '16px' && r.gap >= 20 &&
             r.svgH >= 75 && !r.overflowY && r.scrollW <= w + 1 && r.footVisible && r.viewBox === '0 0 520 126'
  check(`${w}px：φ / 圆角 / 间隙 / DAG / 无溢出`, ok,
    `φ=${r.ratio.toFixed(3)} 圆角=${r.radius} 间隙=${Math.round(r.gap)}px DAG=${Math.round(r.svgH)}px 底部=${r.footVisible ? '完整' : '被裁'}`)
  await ctx.close()
}

// 1000px 及以下按原设计隐藏卡片
const narrow = await browser.newContext({ viewport: { width: 1000, height: 900 }, reducedMotion: 'reduce' })
const np = await narrow.newPage()
await np.goto(base, { waitUntil: 'networkidle' })
check('≤1000px 卡片按原设计隐藏', await np.locator('.build-slot').evaluate((e) => getComputedStyle(e).display === 'none'))
await narrow.close()

check('φ 全区间稳定', minRatio >= PHI - .01 && maxRatio <= PHI + .01, `${minRatio.toFixed(3)} ~ ${maxRatio.toFixed(3)}`)
check('最小标题间隙 ≥ 20px', minGap >= 20, `${Math.round(minGap)}px`)
check('DAG 最小高度 ≥ 75px', minSvg >= 75, `${Math.round(minSvg)}px`)
check('无运行时异常', errors.length === 0, errors.join(' | ') || '0 errors')

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
