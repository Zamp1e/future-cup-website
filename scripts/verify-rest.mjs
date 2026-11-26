import { launchBrowser } from './launch-browser.mjs'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const base = 'http://127.0.0.1:4173/'
const out = resolve('.impeccable/rest')
mkdirSync(out, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

// 待命栏里每个显形光标的中心点
const sample = (page) => page.evaluate(() => {
  const pen = document.getElementById('hud-stage').getBoundingClientRect()
  const list = [...document.querySelectorAll('#cursor-layer .cursor')].map((c) => {
    const b = c.querySelector('svg').getBoundingClientRect()
    return {
      op: getComputedStyle(c).opacity,
      x: b.x + b.width / 2,
      y: b.y + b.height / 2,
      side: Math.round(b.width * 10) / 10,
    }
  })
  return { pen: { x: pen.x, y: pen.y, w: pen.width, h: pen.height }, list }
})

const inside = (p, pen, slack = 12) =>
  p.x >= pen.x - slack && p.x <= pen.x + pen.w + slack &&
  p.y >= pen.y - slack && p.y <= pen.y + pen.h + slack

const browser = await launchBrowser()

// ---------- 桌面：编舞 → 谢幕 → 栏内待命 ----------
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

await page.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window)
  window.__raf = 0
  window.requestAnimationFrame = (cb) => { window.__raf++; return raf(cb) }
})

const t0 = Date.now()
await page.goto(base, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => document.getElementById('hud').classList.contains('is-live'), { timeout: 30000 })
await page.screenshot({ path: resolve(out, 'curtain.png') })
await page.waitForFunction(() => document.documentElement.dataset.stage === 'live', { timeout: 30000 })
const elapsed = Date.now() - t0

// 谢幕后的连点：按钮 scale 与哨兵 svg 缩放同步下压两次；顺带盯住按钮不透明度（曾因 build-in 重播闪白）
const trace = await page.evaluate(() => new Promise((res) => {
  const cta = document.querySelector('[data-build="cta"]')
  const svg = document.querySelector('.is-sentinel svg')
  const rows = []
  const t0 = performance.now()
  const tick = () => {
    const t = performance.now() - t0
    const cs = getComputedStyle(cta)
    rows.push({
      t,
      btn: parseFloat(cs.scale) || 1,
      op: parseFloat(cs.opacity),
      cur: svg ? parseFloat(getComputedStyle(svg).scale) || 1 : 1,
    })
    if (t < 3400) requestAnimationFrame(tick); else res(rows)
  }
  requestAnimationFrame(tick)
}))
const dips = (arr, key, thr) => arr.reduce((n, p, i) => n + (p[key] < thr && (!i || arr[i - 1][key] >= thr) ? 1 : 0), 0)
const minBtn = Math.min(...trace.map((p) => p.btn))
const minCur = Math.min(...trace.map((p) => p.cur))
const minOp = Math.min(...trace.map((p) => p.op))
check('哨兵连点两次：进入平台按钮下压两次', dips(trace, 'btn', .985) === 2, `最深 ${minBtn.toFixed(3)}`)
check('哨兵连点两次：光标与按钮同步缩放', dips(trace, 'cur', .9) === 2 && Math.abs(minCur - .78) < .03, `最深 ${minCur.toFixed(3)}`)
check('连点结束后按钮回到 100%', Math.abs(trace[trace.length - 1].btn - 1) < .002, `末帧 ${trace[trace.length - 1].btn.toFixed(3)}`)
check('连点全程按钮不闪白（build-in 不重播）', minOp > .99, `最低不透明度 ${minOp.toFixed(3)}`)

await page.waitForTimeout(300)
await page.screenshot({ path: resolve(out, 'desktop.png') })

const state = await page.evaluate(() => {
  const layer = document.getElementById('cursor-layer')
  const hud = document.getElementById('hud')
  const sentinel = document.querySelector('.is-sentinel')
  const cta = document.querySelector('[data-build="cta"]').getBoundingClientRect()
  const s = sentinel ? sentinel.getBoundingClientRect() : null
  const stageEl = document.getElementById('hud-stage').getBoundingClientRect()
  return {
    stage: document.documentElement.dataset.stage,
    locked: document.body.classList.contains('is-locked'),
    layerClass: layer.className,
    layerVisible: getComputedStyle(layer).visibility === 'visible' && getComputedStyle(layer).opacity === '1',
    layerZ: getComputedStyle(layer).zIndex,
    hudClass: hud.className,
    hudZ: getComputedStyle(hud).zIndex,
    barWidth: Math.round(hud.querySelector('.hud-bar').getBoundingClientRect().width),
    stageWidth: Math.round(stageEl.width),
    penAboveHud: getComputedStyle(layer).zIndex !== 'auto' && Number(getComputedStyle(layer).zIndex) > Number(getComputedStyle(hud).zIndex),
    hasSentinel: !!sentinel,
    sentinelBox: s ? { x: Math.round(s.x), y: Math.round(s.y) } : null,
    cta: { x: Math.round(cta.x), y: Math.round(cta.y), w: Math.round(cta.width), h: Math.round(cta.height) },
    tagDisplay: getComputedStyle(document.querySelector('#cursor-layer .cursor-tag')).display,
  }
})

check('谢幕后切到 live 且解锁滚动', state.stage === 'live' && !state.locked, `stage=${state.stage} 用时 ${elapsed}ms`)
check('光标层不再隐藏，改为待命态且高过 HUD', state.layerVisible && state.layerClass.includes('is-docked') && state.penAboveHud,
  `class="${state.layerClass}" z=${state.layerZ} hud z=${state.hudZ}`)
check('HUD 进度条收起、让位给待命栏', state.hudClass.includes('is-rest') && state.barWidth === 0 && state.stageWidth >= 60,
  `bar=${state.barWidth}px 栏=${state.stageWidth}px`)
check('哨兵仍停在 CTA 角上', state.hasSentinel && state.sentinelBox &&
  state.sentinelBox.x >= state.cta.x && state.sentinelBox.x <= state.cta.x + state.cta.w + 24 &&
  state.sentinelBox.y >= state.cta.y && state.sentinelBox.y <= state.cta.y + state.cta.h + 24,
  state.sentinelBox ? `sentinel=(${state.sentinelBox.x},${state.sentinelBox.y}) cta=(${state.cta.x},${state.cta.y},${state.cta.w}x${state.cta.h})` : '未找到')
check('待命时不再显示干扰标签', state.tagDisplay === 'none', `display=${state.tagDisplay}`)

const a = await sample(page)
const shown = a.list.filter((p) => p.op !== '0')
check('栏里留下待命的光标（桌面 6 个）', shown.length === 6, `${shown.length} 个 栏=${Math.round(a.pen.w)}×${Math.round(a.pen.h)}`)
check('待命光标全部待在 LIVE 栏内', shown.every((p) => inside(p, a.pen)),
  shown.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' | '))
check('待命光标缩小到栏位尺度', shown.every((p) => p.side >= 6 && p.side <= 13), `边长 ≈ ${shown.map((p) => p.side).join('/')}`)

// 慢速游动：由 CSS 动画驱动，主线程不该再逐帧跑
const raf0 = await page.evaluate(() => window.__raf)
await page.waitForTimeout(2500)
const b = await sample(page)
const raf1 = await page.evaluate(() => window.__raf)
const moved = a.list.map((p, i) => ({ p, q: b.list[i] })).filter((m) => m.p.op !== '0')
const dist = moved.map((m) => Math.hypot(m.q.x - m.p.x, m.q.y - m.p.y))
const anim = await page.evaluate(() => {
  const svg = document.querySelector('#cursor-layer .cursor.is-dock svg')
  const c = svg ? getComputedStyle(svg) : null
  return c ? { name: c.animationName, dur: c.animationDuration, iter: c.animationIterationCount } : null
})
check('待命游动是 CSS 动画（时长 ≥ 6s、无限循环）',
  !!anim && anim.name === 'dockFloat' && parseFloat(anim.dur) >= 6 && anim.iter === 'infinite',
  anim ? `${anim.name} ${anim.dur} ${anim.iter}` : '未找到动画')
check('待命不是静止贴图：栏内确有缓慢游动', Math.max(...dist) > .2, `最大位移 ${Math.max(...dist).toFixed(2)}px / 2.5s`)
check('游动幅度克制（不再晃眼）', Math.max(...dist) < 9, `最大位移 ${Math.max(...dist).toFixed(2)}px / 2.5s`)
check('游动仍被限制在栏内', moved.every((m) => inside(m.q, b.pen)), moved.map((m) => `${Math.round(m.q.x)},${Math.round(m.q.y)}`).join(' | '))
check('待命后主线程不再逐帧跑', raf1 - raf0 <= 6, `${raf1 - raf0} 次 / 2.5s`)

// 改窗口：哨兵与待命位都要跟着重新落位
await page.setViewportSize({ width: 1280, height: 860 })
await page.waitForTimeout(1100)
const after = await page.evaluate(() => {
  const pen = document.getElementById('hud-stage').getBoundingClientRect()
  const list = [...document.querySelectorAll('#cursor-layer .cursor')].map((c) => {
    const r = c.querySelector('svg').getBoundingClientRect()
    return { op: getComputedStyle(c).opacity, x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  return { pen: { x: pen.x, y: pen.y, w: pen.width, h: pen.height }, list, sentinel: document.querySelectorAll('.is-sentinel').length }
})
const afterShown = after.list.filter((p) => p.op !== '0')
check('改窗口后哨兵仍只有一个且待在栏内', after.sentinel === 1 && afterShown.every((p) => inside(p, after.pen)),
  `${after.sentinel} 个 · ${afterShown.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' | ')}`)

// 重播：R
await page.keyboard.press('r')
await page.waitForFunction(() => document.documentElement.dataset.stage === 'building', { timeout: 5000 })
const replayed = await page.evaluate(() => ({
  stage: document.documentElement.dataset.stage,
  layer: document.getElementById('cursor-layer').className,
  hidden: [...document.querySelectorAll('#cursor-layer .cursor')].filter((c) => getComputedStyle(c).opacity === '0').length,
  sentinel: document.querySelectorAll('.is-sentinel').length,
  hud: document.getElementById('hud').className,
}))
check('按 R 重播：出栏、哨兵清掉、全部光标恢复',
  replayed.stage === 'building' && !replayed.layer.includes('is-docked') &&
  replayed.hidden === 0 && replayed.sentinel === 0 && !replayed.hud.includes('is-rest'),
  JSON.stringify(replayed))

await page.waitForFunction(() => document.documentElement.dataset.stage === 'live', { timeout: 30000 })
await page.waitForTimeout(1200)
const again = await page.evaluate(() => ({
  docked: document.getElementById('cursor-layer').classList.contains('is-docked'),
  hud: document.getElementById('hud').className,
  sentinel: document.querySelectorAll('.is-sentinel').length,
}))
check('重播后仍能正常谢幕回栏', again.docked && again.hud.includes('is-rest') && again.sentinel === 1, JSON.stringify(again))
check('桌面端无运行时异常', errors.length === 0, errors.join(' | ') || '0 errors')
await ctx.close()

// ---------- 减少动效：不播待命 ----------
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const rp = await rm.newPage()
const rmErr = []
rp.on('pageerror', (e) => rmErr.push(String(e)))
await rp.goto(base, { waitUntil: 'networkidle' })
await rp.waitForTimeout(500)
const rmState = await rp.evaluate(() => ({
  stage: document.documentElement.dataset.stage,
  layerDisplay: getComputedStyle(document.getElementById('cursor-layer')).display,
  ctaVisible: getComputedStyle(document.querySelector('[data-build="cta"]')).visibility,
}))
check('减少动效：整层不显示、页面完整', rmState.stage === 'live' && rmState.layerDisplay === 'none' &&
  rmState.ctaVisible === 'visible' && !rmErr.length, JSON.stringify(rmState))
await rm.close()

// ---------- 移动端 ----------
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const mp = await mctx.newPage()
const mErr = []
mp.on('pageerror', (e) => mErr.push(String(e)))
await mp.goto(base, { waitUntil: 'domcontentloaded' })
await mp.waitForFunction(() => document.documentElement.dataset.stage === 'live', { timeout: 30000 })
await mp.waitForTimeout(1200)
const m = await sample(mp)
const mShown = m.list.filter((p) => p.op !== '0')
const mState = await mp.evaluate(() => ({
  docked: document.getElementById('cursor-layer').classList.contains('is-docked'),
  sentinel: document.querySelectorAll('.is-sentinel').length,
  overflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
}))
check('移动端：栏里留 3 个待命且不越界', mState.docked && mShown.length === 3 &&
  mShown.every((p) => inside(p, m.pen)) && mState.sentinel === 1 && mState.overflow && !mErr.length,
  `${mShown.length} 个 · 溢出=${!mState.overflow} · 栏=${Math.round(m.pen.w)}×${Math.round(m.pen.h)}`)
await mp.screenshot({ path: resolve(out, 'mobile.png') })
await mctx.close()

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
