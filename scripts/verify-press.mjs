import { launchBrowser } from './launch-browser.mjs'

const base = 'http://127.0.0.1:4173/'
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await launchBrowser()

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
// 平台入口是刻意的 401 站点，测试里用本地桩页代替，不发真实请求
await ctx.route(/tangruirui\.space/, (route) =>
  route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>platform stub</body></html>' }))

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

// 在页面内记录 window.open 的调用时刻与当时按钮的缩放状态，
// 避免用墙钟时间猜「动画是否播完」（headless 的 rAF 帧率远高于 60fps）
await page.addInitScript(() => {
  window.__pressLog = { open: [], samples: {} }
  const orig = window.open
  window.open = function (...args) {
    const q = (s) => { const e = document.querySelector(s); return e ? e.style.getPropertyValue('--press') : 'missing' }
    window.__pressLog.open.push({ t: performance.now(), url: String(args[0] || ''), entry: q('.btn-entry'), primary: q('[data-build="cta"]') })
    return orig.apply(this, args)
  }
})

let popupSeen = false
const popups = []
page.on('popup', (p) => { popupSeen = true; popups.push(p) })

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForFunction(() => document.documentElement.dataset.stage === 'live', { timeout: 20000 })

const press = (sel) => page.locator(sel).evaluate((e) => e.style.getPropertyValue('--press'))
const scaleOf = (sel) => page.locator(sel).evaluate((e) => getComputedStyle(e).scale)
const resetPopup = async () => {
  popupSeen = false
  for (const p of popups.splice(0)) { try { await p.close() } catch (e) { /* 已关闭 */ } }
}
const waitPopup = async (ms = 3000) => {
  for (let i = 0; i < ms / 40 && !popupSeen; i++) await page.waitForTimeout(40)
  return popupSeen
}

/* 逐帧采样：优先读 --press 内联值，落位后读 CSS 的选中 / 原位值 */
const startSampler = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  const arr = []
  window.__pressLog.samples[s] = arr
  const tick = () => {
    const raw = el.style.getPropertyValue('--press')
    arr.push({ t: performance.now(), v: raw ? parseFloat(raw) : parseFloat(getComputedStyle(el).scale) })
    if (arr.length < 240) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}, sel)

// 黄金比例圆角与内边距
const geo = await page.evaluate(() => {
  const g = (s) => {
    const c = getComputedStyle(document.querySelector(s))
    return { radius: parseFloat(c.borderTopLeftRadius), pt: parseFloat(c.paddingTop), pl: parseFloat(c.paddingLeft), scale: c.scale }
  }
  return { card: g('.build-panel'), entry: g('.btn-entry'), primary: g('[data-build="cta"]') }
})
check('按钮圆角 = 卡片圆角 / φ', Math.abs(geo.card.radius / geo.entry.radius - 1.618) < .15 &&
  Math.abs(geo.card.radius / geo.primary.radius - 1.618) < .15,
  `卡片 ${geo.card.radius}px → 按钮 ${geo.entry.radius}/${geo.primary.radius}px`)
check('按钮内边距 垂直:水平 ≈ 1:1.618',
  [geo.entry, geo.primary].every((x) => Math.abs(x.pl / x.pt - 1.618) < .12),
  `${geo.entry.pl}/${geo.entry.pt}=${(geo.entry.pl / geo.entry.pt).toFixed(2)}, ${geo.primary.pl}/${geo.primary.pt}=${(geo.primary.pl / geo.primary.pt).toFixed(2)}`)
check('按压缩放使用独立 scale 属性（不占 transform）', geo.entry.scale === '1' && geo.primary.scale === '1')

async function testPress(sel, label) {
  await resetPopup()
  await page.evaluate(() => { window.__pressLog.open.length = 0 })

  const box = await page.locator(sel).boundingBox()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2

  // 1. 选中：移入后弹簧放大到 102%
  await page.mouse.move(cx, cy)
  await page.waitForFunction((s) => {
    const el = document.querySelector(s)
    return !el.style.getPropertyValue('--press') && getComputedStyle(el).scale === '1.02'
  }, sel, { timeout: 2500 })
  check(`${label}：选中态弹簧放大到 102%`, (await scaleOf(sel)) === '1.02', `scale=${await scaleOf(sel)}`)

  // 2. 按下：弹簧压到 96%，整个过程只降不弹
  await startSampler(sel)
  await page.mouse.down()
  await page.waitForFunction((s) => {
    const v = parseFloat(document.querySelector(s).style.getPropertyValue('--press'))
    return Number.isFinite(v) && Math.abs(v - .96) < .0006
  }, sel, { timeout: 2500 })
  const downValues = await page.evaluate((s) => window.__pressLog.samples[s].map((p) => p.v), sel)
  const monotoneDown = downValues.length > 4 && downValues.every((v, i) => i === 0 || v <= downValues[i - 1] + .0012)
  check(`${label}：按下弹簧压到 96%（无回弹）`, monotoneDown && (await scaleOf(sel)).startsWith('0.96'),
    `--press=${await press(sel)} ${downValues.length} 帧单调=${monotoneDown}`)

  // 3. 松开：手动速度回弹一次，临界阻尼不产生第二次峰
  await startSampler(sel)
  await page.mouse.up()
  await page.waitForFunction((s) => !document.querySelector(s).style.getPropertyValue('--press'), sel, { timeout: 4000 })
  const samples = await page.evaluate((s) => window.__pressLog.samples[s], sel)
  const peak = samples.reduce((a, b) => (b.v > a.v ? b : a), { t: 0, v: 0 })
  const after = samples.slice(samples.indexOf(peak) + 1)
  const noSecondPeak = after.length > 4 && after.every((p, i) => i === 0 || p.v <= after[i - 1].v + .0008)
  check(`${label}：松手回弹越过选中态`, peak.v > 1.025 && peak.v < 1.08,
    `峰值 ${peak.v.toFixed(4)}（+${((peak.v - 1) * 100).toFixed(1)}%）`)
  check(`${label}：临界阻尼 ζ=1，峰值后无二次振荡`, noSecondPeak, `峰值后 ${after.length} 帧单调回落`)

  // 4. 回弹落回选中态；移开指针回到原位
  const settledScale = await scaleOf(sel)
  check(`${label}：回弹落回选中态 102%`,
    Math.abs(parseFloat(settledScale) - 1.02) < .0005 && !(await press(sel)), `scale=${settledScale}`)
  await page.mouse.move(20, 20)
  await page.waitForFunction((s) => getComputedStyle(document.querySelector(s)).scale === '1', sel, { timeout: 2500 })
  check(`${label}：移开指针回到 100%`, (await scaleOf(sel)) === '1')

  // 5. 跳转时序：回弹峰值之后、缩放已清除
  const log = await page.evaluate(() => window.__pressLog.open)
  check(`${label}：跳转发生在回弹峰值之后`, log.length === 1 && log[0].t > peak.t,
    `峰值 @${peak.t.toFixed(0)}ms → open @${log.length ? log[0].t.toFixed(0) : '无'}ms`)
  check(`${label}：跳转时动画已播完（缩放已清除）`,
    log.length === 1 && log[0].entry === '' && log[0].primary === '' && log[0].url.includes('tangruirui.space'),
    log.length ? `press=[${log[0].entry}|${log[0].primary}] url=${log[0].url}` : '未触发 open')

  const got = await waitPopup()
  check(`${label}：新标签成功打开`, got)
  await resetPopup()
}

await testPress('.btn-entry', '头部「进入平台」')
await testPress('[data-build="cta"]', '首屏「在线体验」')

// 键盘 Enter：同样播完弹簧再跳转
await resetPopup()
await page.locator('[data-build="cta"]').evaluate((e) => e.blur())
await page.evaluate(() => { window.__pressLog.open.length = 0 })
await page.locator('[data-build="cta"]').focus()
await page.keyboard.press('Enter')
await page.waitForFunction(() => !document.querySelector('[data-build="cta"]').style.getPropertyValue('--press'), { timeout: 4000 })
const keyLog = await page.evaluate(() => window.__pressLog.open)
check('键盘 Enter：播完弹簧后跳转', keyLog.length === 1 && keyLog[0].primary === '' && (await waitPopup()),
  keyLog.length ? `open @${keyLog[0].t.toFixed(0)}ms` : '未触发 open')
await resetPopup()

// 按住拖出后松开：回弹但不跳转
await page.locator('[data-build="cta"]').evaluate((e) => e.blur())
await resetPopup()
await page.evaluate(() => { window.__pressLog.open.length = 0 })
const box = await page.locator('[data-build="cta"]').boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(120, 700, { steps: 6 })
await page.mouse.up()
await page.waitForTimeout(900)
check('按住拖出：回弹到 100% 且不跳转',
  !(await press('[data-build="cta"]')) && (await scaleOf('[data-build="cta"]')) === '1' &&
  (await page.evaluate(() => window.__pressLog.open.length)) === 0)
await resetPopup()

// reduced motion：直接跳转，不播放缩放
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
await rm.route(/tangruirui\.space/, (route) =>
  route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>stub</body></html>' }))
const rp = await rm.newPage()
rp.on('pageerror', (e) => errors.push(String(e)))
let rmPopup = false
rp.on('popup', () => { rmPopup = true })
await rp.goto(base, { waitUntil: 'networkidle' })
await rp.waitForTimeout(300)
await rp.locator('[data-build="cta"]').click()
await rp.waitForTimeout(250)
check('reduced motion：无缩放、立即跳转', rmPopup &&
  !(await rp.locator('[data-build="cta"]').evaluate((e) => e.style.getPropertyValue('--press'))))

check('无运行时异常', errors.length === 0, errors.join(' | ') || '0 errors')

await rm.close()
await ctx.close()
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
