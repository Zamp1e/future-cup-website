import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const base = 'http://127.0.0.1:4173/'
const outDir = resolve('.impeccable/review')
mkdirSync(outDir, { recursive: true })

const results = []
function check(name, pass, detail = '') {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' })
const page = await context.newPage()
await page.goto(base, { waitUntil: 'networkidle' })
await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0) })
await page.waitForTimeout(600)

// Load every image before the full-page capture.
await page.evaluate(async () => {
  const step = Math.max(400, Math.floor(window.innerHeight * 0.8))
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 60))
  }
  window.scrollTo(0, 0)
})
await page.waitForFunction(() => window.scrollY === 0)
await page.waitForTimeout(500)

check(
  'desktop no horizontal overflow',
  await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  await page.evaluate(() => `${document.documentElement.scrollWidth}px / ${window.innerWidth}px`),
)

await page.screenshot({ path: resolve(outDir, 'desktop-full.png'), fullPage: true })
await page.evaluate(() => { window.scrollTo(0, 0) })
await page.waitForFunction(() => window.scrollY === 0)
await page.waitForTimeout(200)
await page.screenshot({ path: resolve(outDir, 'desktop-hero.png') })

// Stage interaction.
await page.locator('.stage-tab[data-stage="4"]').click()
await page.waitForTimeout(250)
check(
  'stage 5 shows verification failure',
  (await page.locator('#console-stage').innerText()).includes('浏览器验证') &&
    (await page.locator('[data-detail="output"]').innerText()).includes('FAIL'),
  await page.locator('#console-stage').innerText(),
)

await page.locator('.stage-tab[data-stage="6"]').click()
await page.waitForTimeout(250)
check(
  'stage 7 shows delivery',
  (await page.locator('#console-stage').innerText()).includes('交付') &&
    (await page.locator('[data-detail="output"]').innerText()).includes('可运行前端工程'),
  await page.locator('#console-stage').innerText(),
)

await page.locator('.stage-tab[data-stage="5"]').click()
await page.locator('#replay-btn').click()
await page.waitForTimeout(7200)
check(
  'replay ends on delivery',
  (await page.locator('.stage-tab[aria-selected="true"]').getAttribute('data-stage')) === '6',
  await page.locator('.stage-tab[aria-selected="true"]').getAttribute('data-stage'),
)

// Evidence tabs.
await page.locator('#tab-diff').click()
await page.waitForTimeout(150)
check(
  'evidence diff tab opens',
  (await page.locator('#panel-diff').isVisible()) &&
    (await page.locator('#preview-path').innerText()) === 'repairs/round-1.diff',
  await page.locator('#preview-path').innerText(),
)

await page.locator('#tab-hq').click()
await page.waitForTimeout(150)
check(
  'evidence HQ tab opens',
  (await page.locator('#panel-hq').isVisible()) &&
    (await page.locator('#panel-hq img').evaluate((img) => img.complete && img.naturalWidth > 0)),
  'HQ image loaded',
)

// Mobile layout and menu.
await page.setViewportSize({ width: 390, height: 844 })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
check(
  'mobile no horizontal overflow',
  await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  await page.evaluate(() => `${document.documentElement.scrollWidth}px / ${window.innerWidth}px`),
)

await page.locator('.menu-toggle').click()
await page.waitForTimeout(150)
check(
  'mobile menu opens',
  (await page.locator('#site-nav').isVisible()) &&
    (await page.locator('.menu-toggle').getAttribute('aria-expanded')) === 'true',
)
await page.locator('#site-nav a[href="#team"]').click()
await page.waitForTimeout(300)
check(
  'mobile menu closes after navigation',
  (await page.locator('.menu-toggle').getAttribute('aria-expanded')) === 'false',
)

await page.evaluate(async () => {
  document.documentElement.style.scrollBehavior = 'auto'
  const step = Math.max(400, Math.floor(window.innerHeight * 0.8))
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 50))
  }
  window.scrollTo(0, 0)
})
await page.waitForTimeout(500)
await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0) })
await page.waitForFunction(() => window.scrollY === 0)
await page.waitForTimeout(400)
await page.screenshot({ path: resolve(outDir, 'mobile-full.png'), fullPage: true })
await page.evaluate(() => { window.scrollTo(0, 0) })
await page.waitForFunction(() => window.scrollY === 0)
await page.waitForTimeout(200)
await page.screenshot({ path: resolve(outDir, 'mobile-hero.png') })

// Reduced motion: replay should jump to delivery.
const reduced = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
})
const reducedPage = await reduced.newPage()
await reducedPage.goto(base, { waitUntil: 'networkidle' })
await reducedPage.waitForTimeout(300)
await reducedPage.locator('#replay-btn').click()
await reducedPage.waitForTimeout(120)
check(
  'reduced motion jumps to final state',
  (await reducedPage.locator('.stage-tab[aria-selected="true"]').getAttribute('data-stage')) === '6',
  await reducedPage.locator('.stage-tab[aria-selected="true"]').getAttribute('data-stage'),
)

await reduced.close()
await context.close()
await browser.close()

const failures = results.filter((r) => !r.pass)
console.log(`\n${results.length - failures.length}/${results.length} checks passed`)
if (failures.length) process.exitCode = 1
