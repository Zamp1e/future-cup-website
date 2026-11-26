import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const base = 'http://127.0.0.1:4173/'
const out = resolve('.impeccable/theme')
mkdirSync(out, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

let browser
try { browser = await chromium.launch({ channel: 'chrome', headless: true }) }
catch (e) { browser = await chromium.launch({ headless: true }) }

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

const attr = () => page.evaluate(() => document.documentElement.dataset.theme)
const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const aria = () => page.locator('#theme-toggle').getAttribute('aria-label')
const meta = () => page.locator('meta[name="theme-color"]').getAttribute('content')

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

check('默认墨色主题', (await attr()) === 'ink' && (await bg()) === 'rgb(14, 21, 18)', `${await attr()} / ${await bg()}`)
check('头部切换按钮可见', await page.locator('#theme-toggle').isVisible())
check('默认显示太阳图标且 aria-label 指向浅色', await page.locator('.theme-icon-sun').isVisible() && !(await page.locator('.theme-icon-moon').isVisible()) && (await aria()).includes('浅色'))

// 纯图标样式：两个辅助按钮无边框、无填充、无文字，hover 也不出现实心方块
const transparent = (v) => v === 'transparent' || v === 'rgba(0, 0, 0, 0)'
const plain = await page.evaluate(() => ['#theme-toggle', '.btn-github'].map((s) => {
  const c = getComputedStyle(document.querySelector(s))
  return { s, border: c.borderTopWidth, bg: c.backgroundColor }
}))
check('两个辅助按钮无边框无填充', plain.every((x) => x.border === '0px' && transparent(x.bg)), JSON.stringify(plain))
check('文字标签已隐藏、仅图标可见',
  !(await page.locator('.theme-label').isVisible()) && !(await page.locator('.github-label').isVisible()) &&
  await page.locator('.btn-github svg').isVisible() && await page.locator('.theme-icon-sun').isVisible())
check('纯图标按钮仍有可访问名称',
  (await aria()).length > 0 && (await page.locator('.btn-github').getAttribute('aria-label')).length > 0)
await page.locator('#theme-toggle').hover()
const hoverBg = await page.locator('#theme-toggle').evaluate((e) => getComputedStyle(e).backgroundColor)
check('hover 不出现填充方块', transparent(hoverBg), hoverBg)
await page.mouse.move(700, 600)
await page.screenshot({ path: resolve(out, 'desktop-ink.png') })

await page.locator('#theme-toggle').click()
await page.waitForTimeout(500)
check('点击后切到纸色', (await attr()) === 'paper' && (await bg()) === 'rgb(242, 239, 231)', `${await attr()} / ${await bg()}`)
check('图标/aria-label 翻转为深色', (await aria()).includes('深色') && await page.locator('.theme-icon-moon').isVisible() && !(await page.locator('.theme-icon-sun').isVisible()))
check('theme-color 同步', (await meta()) === '#f2efe7', await meta())
check('切换过渡类会自动移除', !(await page.evaluate(() => document.documentElement.classList.contains('theme-changing'))))
await page.screenshot({ path: resolve(out, 'desktop-paper.png') })

// Tweaks 面板双向同步
await page.locator('#tweaks-trigger').click()
check('Tweaks「纸」按钮同步高亮', await page.locator('.seg[data-key="theme"] button[data-value="paper"]').evaluate((b) => b.classList.contains('is-on')))
await page.locator('.seg[data-key="theme"] button[data-value="ink"]').click()
await page.waitForTimeout(150)
check('从 Tweaks 切回墨色，头部按钮同步', (await attr()) === 'ink' && (await aria()).includes('浅色'))
await page.locator('#theme-toggle').click()
check('再次由头部切到纸色', (await attr()) === 'paper')

// 持久化 + 首屏无闪烁（延迟加载 app.js，验证 head 内联脚本独立生效）
check('localStorage 已持久化', (await page.evaluate(() => JSON.parse(localStorage.getItem('fc-stage')).theme)) === 'paper')
await page.route('**/app.js', async (route) => { await new Promise((r) => setTimeout(r, 900)); await route.continue() })
await page.reload({ waitUntil: 'domcontentloaded' })
check('刷新后 app.js 尚未加载时已是纸色（无闪回）', (await bg()) === 'rgb(242, 239, 231)', await bg())
await page.unroute('**/app.js')
await page.waitForTimeout(1400)
check('脚本加载完成后主题仍为纸色', (await attr()) === 'paper')

// 键盘可达
await page.locator('#theme-toggle').focus()
await page.keyboard.press('Enter')
await page.waitForTimeout(120)
check('键盘 Enter 可切换', (await attr()) === 'ink')
await page.locator('#theme-toggle').click()
check('切回纸色准备移动端检查', (await attr()) === 'paper')

// 移动端
await page.setViewportSize({ width: 390, height: 844 })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
check('移动端切换按钮可见且保持纯图标', await page.locator('#theme-toggle').isVisible() &&
  !(await page.locator('.theme-label').isVisible()) &&
  (await page.locator('.theme-icon-sun').isVisible() || await page.locator('.theme-icon-moon').isVisible()))
check('移动端纸色无横向溢出', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await page.evaluate(() => `${document.documentElement.scrollWidth}/${window.innerWidth}`))
await page.screenshot({ path: resolve(out, 'mobile-paper.png') })
await page.locator('#theme-toggle').click()
await page.waitForTimeout(400)
check('移动端切到墨色且无横向溢出', (await attr()) === 'ink' && await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))

// 减少动效
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const rp = await rm.newPage()
rp.on('pageerror', (e) => errors.push(String(e)))
await rp.goto(base, { waitUntil: 'networkidle' })
await rp.waitForTimeout(300)
await rp.locator('#theme-toggle').click()
check('reduced motion 下切换仍生效', (await rp.evaluate(() => document.documentElement.dataset.theme)) === 'paper')

check('无运行时异常', errors.length === 0, errors.join(' | ') || '0 errors')

await rm.close()
await ctx.close()
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
