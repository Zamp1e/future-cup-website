import { chromium } from 'playwright'

const base = 'http://127.0.0.1:4173/'
const INSTALLER = 'https://github.com/tangrui13131/ruiruiai/releases/download/v1.4.5/FutureCup-Setup-x64.exe'
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

let browser
try { browser = await chromium.launch({ channel: 'chrome', headless: true }) }
catch (e) { browser = await chromium.launch({ headless: true }) }

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
// 不真连 GitHub：用带 Content-Disposition 的桩响应触发下载
await ctx.route(/FutureCup-Setup-x64\.exe/, (route) => route.fulfill({
  status: 200,
  contentType: 'application/octet-stream',
  headers: { 'Content-Disposition': 'attachment; filename="FutureCup-Setup-x64.exe"' },
  body: Buffer.from('MZfake-exe-for-test'),
}))

const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
let downloadSeen = false, downloadUrl = ''
page.on('download', (d) => { downloadSeen = true; downloadUrl = d.url() })

await page.addInitScript(() => {
  window.__dlLog = { clicks: [], samples: [], sampling: false }
  const orig = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download')) {
      const e = document.querySelector('.btn-download')
      window.__dlLog.clicks.push({
        t: performance.now(),
        press: e ? e.style.getPropertyValue('--press') : 'missing',
        href: this.href,
        filename: this.getAttribute('download'),
      })
    }
    return orig.apply(this, arguments)
  }
  // 与 verify-press 同理：采样必须在点击前才启动，headless 帧率很高
  window.__startDlSampler = () => {
    window.__dlLog.samples = []
    window.__dlLog.sampling = true
    const tick = () => {
      const e = document.querySelector('.btn-download')
      if (e) window.__dlLog.samples.push({ t: performance.now(), v: parseFloat(e.style.getPropertyValue('--press')) || 1 })
      if (window.__dlLog.sampling && window.__dlLog.samples.length < 600) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
})

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForFunction(() => document.documentElement.dataset.stage === 'live', { timeout: 20000 })
await page.mouse.move(700, 700)  // 移开鼠标，避免 hover 样式干扰 UI 对比

const dl = page.locator('.btn-download')
const pressDl = () => dl.evaluate((e) => e.style.getPropertyValue('--press'))
const scaleDl = () => dl.evaluate((e) => getComputedStyle(e).scale)
const reset = async () => {
  await page.evaluate(() => { window.__dlLog.clicks.length = 0 })
  downloadSeen = false; downloadUrl = ''
}
const waitDownload = async (ms = 3000) => {
  for (let i = 0; i < ms / 40 && !downloadSeen; i++) await page.waitForTimeout(40)
  return downloadSeen
}

// 1. UI 与主 CTA 逐项一致
const ui = await page.evaluate(() => {
  const cta = document.querySelector('[data-build="cta"]')
  const d = document.querySelector('.btn-download')
  const keys = ['borderTopLeftRadius', 'paddingTop', 'paddingLeft', 'fontSize', 'fontWeight',
    'backgroundColor', 'color', 'scale', 'transition', 'gap', 'letterSpacing', 'borderRadius']
  const diff = []
  for (const k of keys) {
    const a = getComputedStyle(cta)[k], b = getComputedStyle(d)[k]
    if (a !== b) diff.push(`${k}: ${a} ≠ ${b}`)
  }
  return { diff, sameClass: d.classList.contains('btn-primary'), href: d.href, visible: getComputedStyle(d).visibility }
})
check('下载按钮复用 btn-primary 且入场后可见', ui.sameClass && ui.visible === 'visible')
check('UI 逐项与主 CTA 一致', ui.diff.length === 0, ui.diff.length ? ui.diff.join(' | ') : '12 项样式全同')
check('下载链接正确', ui.href === INSTALLER, ui.href)

// 2. 按压 → 弹簧 → 播完才下载
await reset()
const box = await dl.boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
const down = parseFloat(await pressDl())
check('按下缩到 96%', Math.abs(down - .96) < .001 && (await scaleDl()).startsWith('0.96'), `--press=${down}`)
await page.evaluate(() => window.__startDlSampler())
await page.mouse.up()
await page.waitForFunction(() => !document.querySelector('.btn-download').style.getPropertyValue('--press'), { timeout: 4000 })
const log = await page.evaluate(() => { window.__dlLog.sampling = false; return window.__dlLog })
const peak = log.samples.reduce((a, b) => (b.v > a.v ? b : a), { t: 0, v: 1 })
check('松手弹簧放大略超 100%', peak.v > 1.02 && peak.v < 1.10, `峰值 ${peak.v.toFixed(4)}`)
check('下载发生在回弹峰值之后', log.clicks.length === 1 && log.clicks[0].t > peak.t,
  `峰值 @${peak.t.toFixed(0)}ms → 触发 @${log.clicks.length ? log.clicks[0].t.toFixed(0) : '无'}ms`)
check('下载时动画已播完（缩放已清除）', log.clicks.length === 1 && log.clicks[0].press === '',
  log.clicks.length ? `press=[${log.clicks[0].press}]` : '未触发')
check('触发的是下载而非新标签跳转', log.clicks.length === 1 &&
  log.clicks[0].filename === 'FutureCup-Setup-x64.exe' && log.clicks[0].href === INSTALLER)
check('最终精确回到 100%', (await scaleDl()) === '1' && !(await pressDl()))
check('浏览器产生下载事件', await waitDownload(), downloadUrl)
await reset()

// 3. 键盘 Enter
await dl.focus()
await page.keyboard.press('Enter')
await page.waitForFunction(() => !document.querySelector('.btn-download').style.getPropertyValue('--press'), { timeout: 4000 })
const keyLog = await page.evaluate(() => window.__dlLog.clicks)
check('键盘 Enter：播完动画后下载', keyLog.length === 1 && keyLog[0].press === '' && (await waitDownload()))
await reset()

// 4. 按住拖出：回弹但不下载
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(120, 700, { steps: 6 })
await page.mouse.up()
await page.waitForTimeout(650)
check('按住拖出：回弹且不下载',
  !(await pressDl()) && (await scaleDl()) === '1' &&
  (await page.evaluate(() => window.__dlLog.clicks.length)) === 0 && !downloadSeen)

// 5. reduced motion：直接下载，无缩放
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true })
await rm.route(/FutureCup-Setup-x64\.exe/, (route) => route.fulfill({
  status: 200, contentType: 'application/octet-stream',
  headers: { 'Content-Disposition': 'attachment; filename="FutureCup-Setup-x64.exe"' },
  body: Buffer.from('MZfake-exe-for-test'),
}))
const rp = await rm.newPage()
rp.on('pageerror', (e) => errors.push(String(e)))
let rmDownload = false
rp.on('download', () => { rmDownload = true })
await rp.goto(base, { waitUntil: 'networkidle' })
await rp.waitForTimeout(300)
await rp.locator('.btn-download').click()
for (let i = 0; i < 40 && !rmDownload; i++) await rp.waitForTimeout(50)
check('reduced motion：无缩放、立即下载', rmDownload &&
  !(await rp.locator('.btn-download').evaluate((e) => e.style.getPropertyValue('--press'))))

check('无运行时异常', errors.length === 0, errors.join(' | ') || '0 errors')

await rm.close()
await ctx.close()
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
