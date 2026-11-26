import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const base = 'http://127.0.0.1:4173/'
const out = resolve('.impeccable/mobile')
mkdirSync(out, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

let browser
try { browser = await chromium.launch({ channel: 'chrome', headless: true }) }
catch (e) { browser = await chromium.launch({ headless: true }) }

const errors = []
const vertical = [
  { w: 320, h: 844, label: '320px' },
  { w: 360, h: 844, label: '360px' },
  { w: 390, h: 844, label: '390px' },
  { w: 430, h: 844, label: '430px' },
  { w: 640, h: 900, label: '640px' },
  { w: 768, h: 900, label: '768px' },
  { w: 900, h: 900, label: '900px' },
  { w: 1000, h: 900, label: '1000px' },
]

for (const v of vertical) {
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    reducedMotion: 'reduce',
    isMobile: v.w <= 430,
    hasTouch: true,
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForTimeout(260)

  const r = await page.evaluate(() => {
    const q = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height } }
    const taps = ['#theme-toggle', '.btn-github', '#tweaks-trigger', '.btn-download'].map((s) => q(s))
    const cta = q('[data-build="cta"]'), dl = q('.btn-download'), cap = q('.cap-strip'), footer = q('.site-footer')
    // 用实际内联元素判断遮挡；<p> 容器会占满整行，直接拿它的矩形会误报
    const tw = document.querySelector('.tweaks-trigger').getBoundingClientRect()
    const linkParts = [...document.querySelectorAll('.footer-links > *')].map((e) => e.getBoundingClientRect())
    const linksVsTweaks = linkParts.some((b) => b.right > tw.left && b.bottom > tw.top && b.left < tw.right && b.top < tw.bottom)
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      pageH: document.documentElement.scrollHeight, innerH: innerHeight,
      minTap: Math.min(...taps.map((x) => Math.min(x.w, x.h))),
      // 320px 时两个 CTA 会换行，取两者中更靠下的边界才不会漏判
      gap: cap.t - Math.max(cta.b, dl.b),
      footerOverlap: footer.t < cap.b - 1,
      linksVsTweaks,
      textOverflow: [...document.querySelectorAll('.title-line, .cap-name, .hero-lede')]
        .some((e) => e.scrollWidth > e.clientWidth + 2),
      frameMax: getComputedStyle(document.querySelector('.frame')).maxWidth,
      titleFont: parseFloat(getComputedStyle(document.querySelector('.hero-title')).fontSize),
    }
  })

  const ok = r.overflow <= 0 && r.minTap >= 44 && r.pageH <= r.innerH + 2 &&
             r.gap >= 0 && !r.footerOverlap && !r.linksVsTweaks && !r.textOverflow
  check(`${v.label}：无溢出 / 一屏 / 44px 点击区 / 无重叠`, ok,
    `溢出=${r.overflow} 页高=${r.pageH} 点击=${Math.round(r.minTap)}px CTA空隙=${Math.round(r.gap)}px ` +
    `页脚重叠=${r.footerOverlap} 链接压悬浮=${r.linksVsTweaks} 文字溢出=${r.textOverflow}`)

  // 平板段：收窄居中 + 标题放大
  if (v.w >= 641 && v.w <= 1000) {
    check(`${v.label}：平板构图收窄且标题放大`, r.frameMax === '960px' && r.titleFont > 80,
      `max-width=${r.frameMax} 标题=${Math.round(r.titleFont)}px`)
  }

  // Tweaks 面板打开后仍完整落在视口内
  await page.locator('#tweaks-trigger').click()
  const tw = await page.locator('.tweaks').boundingBox()
  check(`${v.label}：Tweaks 面板不越界`, tw.x >= 0 && tw.x + tw.width <= v.w + 1 && tw.y >= 0,
    `x=${Math.round(tw.x)} w=${Math.round(tw.width)}`)

  // 主题按钮在触摸尺寸下仍可点
  const before = await page.evaluate(() => document.documentElement.dataset.theme)
  await page.locator('#theme-toggle').click()
  const after = await page.evaluate(() => document.documentElement.dataset.theme)
  check(`${v.label}：触摸切换主题有效`, before !== after, `${before} → ${after}`)
  await page.locator('#theme-toggle').click()

  if ([320, 390, 768, 1000].includes(v.w)) {
    await page.screenshot({ path: resolve(out, `${v.label}.png`), fullPage: true })
    if (v.w === 390) {
      await page.locator('#theme-toggle').click()
      await page.waitForTimeout(350)
      await page.screenshot({ path: resolve(out, '390px-paper.png'), fullPage: true })
    }
  }
  await ctx.close()
}

// 横屏低高度：允许自然滚动，但不能横向溢出或元素重叠
const land = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce', hasTouch: true })
const lp = await land.newPage()
lp.on('pageerror', (e) => errors.push(String(e)))
await lp.goto(base, { waitUntil: 'networkidle' })
await lp.waitForTimeout(260)
const l = await lp.evaluate(() => {
  const q = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { t: b.top, b: b.bottom } }
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    pageH: document.documentElement.scrollHeight,
    ctaToCap: q('.cap-strip').t - Math.max(q('[data-build="cta"]').b, q('.btn-download').b),
    capToFooter: q('.site-footer').t - q('.cap-strip').b,
  }
})
check('844×390 横屏：可纵向滚动且无横向溢出 / 无重叠',
  l.overflow <= 0 && l.pageH > 390 && l.ctaToCap >= 0 && l.capToFooter >= 0,
  `页高=${l.pageH} CTA→能力条=${Math.round(l.ctaToCap)}px`)
await lp.screenshot({ path: resolve(out, '844x390-landscape.png'), fullPage: true })
await land.close()

// 触摸按压：96% → 弹簧过冲 → 播完才跳转（正常动效，非 reduced）
const touchCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await touchCtx.route(/tangruirui\.space/, (route) =>
  route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>stub</body></html>' }))
const tp = await touchCtx.newPage()
tp.on('pageerror', (e) => errors.push(String(e)))
await tp.addInitScript(() => {
  window.__mLog = { open: [], samples: [], sampling: false }
  const orig = window.open
  window.open = function (...a) {
    const e = document.querySelector('[data-build="cta"]')
    window.__mLog.open.push({ t: performance.now(), press: e ? e.style.getPropertyValue('--press') : 'missing' })
    return orig.apply(this, a)
  }
  // 采样必须在 tap 前才启动：headless 帧率很高，页面加载阶段就会把固定帧数跑完
  window.__startPressSampler = () => {
    window.__mLog.samples = []
    window.__mLog.sampling = true
    const tick = () => {
      const e = document.querySelector('[data-build="cta"]')
      if (e) window.__mLog.samples.push({ t: performance.now(), v: parseFloat(e.style.getPropertyValue('--press')) || 1 })
      if (window.__mLog.sampling && window.__mLog.samples.length < 600) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
})
let popupSeen = false
tp.on('popup', () => { popupSeen = true })
await tp.goto(base, { waitUntil: 'networkidle' })
await tp.waitForFunction(() => document.documentElement.dataset.stage === 'live', { timeout: 20000 })
const box = await tp.locator('[data-build="cta"]').boundingBox()
await tp.evaluate(() => window.__startPressSampler())
await tp.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
await tp.waitForFunction(() => !document.querySelector('[data-build="cta"]').style.getPropertyValue('--press'), { timeout: 4000 })
const log = await tp.evaluate(() => { window.__mLog.sampling = false; return window.__mLog })
const peak = log.samples.reduce((a, b) => (b.v > a.v ? b : a), { t: 0, v: 1 })
check('触摸 tap：按下 96% 且回弹过冲', log.samples.some((s) => Math.abs(s.v - .96) < .001) && peak.v > 1.02,
  `峰值 ${peak.v.toFixed(4)}`)
check('触摸 tap：动画播完才跳转', log.open.length === 1 && log.open[0].press === '' && log.open[0].t > peak.t,
  `峰值 @${peak.t.toFixed(0)}ms → open @${log.open.length ? log.open[0].t.toFixed(0) : '无'}ms`)
for (let i = 0; i < 40 && !popupSeen; i++) await tp.waitForTimeout(50)
check('触摸 tap：成功打开新标签', popupSeen)
await touchCtx.close()

check('无运行时异常', errors.length === 0, errors.join(' | ') || '0 errors')

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
