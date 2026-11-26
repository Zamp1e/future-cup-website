import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const base = 'http://127.0.0.1:4173/'
const out = resolve('.impeccable/tilt')
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

const css = (prop, sel = '#panel-tilt') =>
  page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s)).getPropertyValue(p).trim(), [sel, prop])
const inline = (prop, sel = '#panel-tilt') =>
  page.evaluate(([s, p]) => document.querySelector(s).style.getPropertyValue(p).trim(), [sel, prop])

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForFunction(() => document.documentElement.dataset.stage === 'live', { timeout: 20000 })
await page.waitForTimeout(200)

const box = await page.locator('.build-slot').boundingBox()
check('右侧卡片可见', !!box && box.width > 250, box ? `${Math.round(box.width)}×${Math.round(box.height)}` : 'null')
check('初始为回正状态', (await inline('--ry')) === '' || parseFloat(await inline('--ry')) === 0)

// 指针移到左上角：应产生 3D 倾斜 + 流光中心跟随
const px = box.x + box.width * .18
const py = box.y + box.height * .18
await page.mouse.move(px, py, { steps: 6 })
await page.waitForTimeout(520)
const rx = parseFloat(await inline('--rx'))
const ry = parseFloat(await inline('--ry'))
check('左上触摸产生双向倾斜', rx > 2 && ry < -2, `rotateX ${rx}° / rotateY ${ry}°`)
check('倾斜幅度不超过上限', Math.abs(rx) <= 11.5 && Math.abs(ry) <= 11.5)
check('流光中心跟随指针', Math.abs(parseFloat(await inline('--mx', '#build-panel')) - 18) < 6 && Math.abs(parseFloat(await inline('--my', '#build-panel')) - 18) < 6,
  `${await inline('--mx', '#build-panel')} / ${await inline('--my', '#build-panel')}`)
check('悬停时流光点亮', (await inline('--sheen', '#build-panel')) === '1')
check('悬停态抬升类已加上', await page.locator('#panel-tilt').evaluate((e) => e.classList.contains('is-hover')))
check('3D 透视已生效', (await css('perspective', '.build-slot')).includes('900px'))

await page.screenshot({
  path: resolve(out, 'tilt-hover.png'),
  clip: { x: Math.max(0, box.x - 34), y: Math.max(0, box.y - 44), width: box.width + 68, height: box.height + 88 },
})

// 右下角：倾斜方向应反过来，流光中心也跟着走
const qx = box.x + box.width * .82
const qy = box.y + box.height * .82
await page.mouse.move(qx, qy, { steps: 6 })
await page.waitForTimeout(520)
const rx2 = parseFloat(await inline('--rx'))
const ry2 = parseFloat(await inline('--ry'))
check('右下触摸倾斜方向反转', rx2 < -2 && ry2 > 2, `rotateX ${rx2}° / rotateY ${ry2}°`)

// 松手：先等弹簧完全稳定在目标角度，再单步离开
// （多步移动会沿途继续触发 track，把目标值提前拖回 0，测不到真实回弹）
await page.waitForTimeout(700)
const peak = parseFloat(await inline('--ry'))
await page.mouse.move(60, 700)
check('松手立即移除悬停态', !(await page.locator('#panel-tilt').evaluate((e) => e.classList.contains('is-hover'))))
check('松手立即关闭流光', (await inline('--sheen', '#build-panel')) === '0')

const samples = []
for (let i = 0; i < 26; i++) {
  await page.waitForTimeout(28)
  samples.push(parseFloat(await inline('--ry')) || 0)
}
const trough = Math.min(...samples)
const overshot = trough < -0.3 && trough > -peak * .5
check('回正过程带弹簧过冲（有阻力回弹）', overshot,
  `起 ${peak.toFixed(2)}° → 过冲 ${trough.toFixed(3)}°（${(Math.abs(trough) / peak * 100).toFixed(1)}%）`)
await page.waitForTimeout(700)
check('最终精确回正到 0°', Math.abs(parseFloat(await inline('--ry')) || 0) < .01 && Math.abs(parseFloat(await inline('--rx')) || 0) < .01)
check('静止后释放 will-change', !(await page.locator('#panel-tilt').evaluate((e) => e.classList.contains('is-active'))))

// 建造动画期间强制不倾斜，避免选框测量偏移
await page.mouse.move(px, py, { steps: 5 })
await page.waitForTimeout(300)
await page.evaluate(() => { document.documentElement.dataset.stage = 'building' })
await page.mouse.move(px + 4, py + 4)
await page.waitForTimeout(120)
check('建造期间自动撤销悬停态', !(await page.locator('#panel-tilt').evaluate((e) => e.classList.contains('is-hover'))))
await page.evaluate(() => { document.documentElement.dataset.stage = 'live' })
await page.mouse.move(60, 700)
await page.waitForTimeout(700)

// 触摸路径：合成 pointerType=touch 的 pointerdown / move / up
const touch = await page.evaluate(({ x, y }) => {
  const el = document.querySelector('#panel-tilt')
  const mk = (type) => new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerType: 'touch', pointerId: 7, isPrimary: true })
  el.dispatchEvent(mk('pointerenter'))
  el.dispatchEvent(mk('pointerdown'))
  el.dispatchEvent(mk('pointermove'))
  return true
}, { x: qx, y: qy })
await page.waitForTimeout(420)
check('触摸按下同样触发倾斜', touch && parseFloat(await inline('--ry')) > 2)
check('触摸按下点亮流光', (await inline('--sheen', '#build-panel')) === '1')
await page.evaluate(() => {
  document.querySelector('#panel-tilt').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 7, isPrimary: true }))
})
check('触摸抬起关闭流光', (await inline('--sheen', '#build-panel')) === '0')

// 主题联动：两个主题的流光配色不同
const inkSheen = await css('--sheen-core', ':root')
await page.locator('#theme-toggle').click()
await page.waitForTimeout(450)
const paperSheen = await css('--sheen-core', ':root')
check('浅色主题使用不同的流光配色', inkSheen !== paperSheen && paperSheen.length > 0, `${inkSheen} → ${paperSheen}`)
await page.mouse.move(px, py, { steps: 5 })
await page.waitForTimeout(400)
await page.screenshot({
  path: resolve(out, 'tilt-paper.png'),
  clip: { x: Math.max(0, box.x - 34), y: Math.max(0, box.y - 44), width: box.width + 68, height: box.height + 88 },
})

// ≤1000px 卡片隐藏，不应产生倾斜
await page.setViewportSize({ width: 900, height: 800 })
await page.waitForTimeout(300)
const hidden = await page.locator('.build-slot').evaluate((e) => getComputedStyle(e).display === 'none')
check('窄屏卡片隐藏且无残留倾斜', hidden && Math.abs(parseFloat(await inline('--ry')) || 0) < 12)

// 减少动效：完全不启用倾斜
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const rp = await rm.newPage()
rp.on('pageerror', (e) => errors.push(String(e)))
await rp.goto(base, { waitUntil: 'networkidle' })
await rp.waitForTimeout(400)
const rb = await rp.locator('.build-slot').boundingBox()
await rp.mouse.move(rb.x + rb.width * .2, rb.y + rb.height * .2, { steps: 5 })
await rp.waitForTimeout(300)
check('reduced motion 下不倾斜', !(await rp.locator('#panel-tilt').evaluate((e) => e.classList.contains('is-hover'))) &&
  !(await rp.locator('#panel-tilt').evaluate((e) => e.style.getPropertyValue('--ry'))))

check('无运行时异常', errors.length === 0, errors.join(' | ') || '0 errors')

await rm.close()
await ctx.close()
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
