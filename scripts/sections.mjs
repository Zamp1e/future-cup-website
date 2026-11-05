import { chromium } from 'playwright'
import { resolve } from 'node:path'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
for (const id of ['execution','team','repair','evidence','library','boundaries','cta']) {
  const el = page.locator(`#${id}`)
  await page.evaluate((id) => { document.documentElement.style.scrollBehavior='auto'; const n=document.getElementById(id); window.scrollTo(0, n.getBoundingClientRect().top + window.scrollY - 80) }, id)
  await page.waitForTimeout(300)
  await el.screenshot({ path: resolve('.impeccable/review', `${id}.png`) })
  console.log(id, await el.evaluate(n => `${n.offsetWidth}x${n.offsetHeight}`))
}
await browser.close()
