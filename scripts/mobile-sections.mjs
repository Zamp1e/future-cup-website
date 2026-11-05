import { chromium } from 'playwright'
import { resolve } from 'node:path'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
for (const id of ['execution','team','repair','evidence','library','boundaries','cta']) {
  await page.evaluate((id) => {
    document.documentElement.style.scrollBehavior = 'auto'
    const el = document.getElementById(id)
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70)
  }, id)
  await page.waitForTimeout(400)
  await page.screenshot({ path: resolve('.impeccable/review', `mobile-${id}.png`) })
}
const audit = await page.evaluate(() => {
  const vw = window.innerWidth
  const bad = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) {
      const style = getComputedStyle(el)
      if (style.position === 'fixed' || style.position === 'absolute') continue
      bad.push({tag: el.tagName, cls: el.className?.toString().slice(0,50), left: Math.round(r.left), right: Math.round(r.right), text: (el.textContent||'').trim().slice(0,40)})
    }
  }
  const imgs = [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src)
  return {scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, bad: bad.slice(0, 12), brokenImages: imgs}
})
console.log(JSON.stringify(audit, null, 2))
await browser.close()
