import { launchBrowser } from './launch-browser.mjs'
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

const browser = await launchBrowser()

const errors = []
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const meta = () => page.locator('meta[name="theme-color"]').getAttribute('content')

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForFunction(() => document.documentElement.dataset.stage === 'live', { timeout: 20000 })
await page.waitForTimeout(400)

const tokens = await page.evaluate(() => {
  const s = getComputedStyle(document.documentElement)
  const get = (name) => s.getPropertyValue(name).trim()
  return {
    accent: get('--accent'),
    ink: get('--fg'),
    line: get('--rule'),
    font: getComputedStyle(document.body).fontFamily,
    raised: get('--shadow-raised'),
    raisedSm: get('--shadow-raised-sm'),
    raisedLg: get('--shadow-raised-lg'),
    inset: get('--shadow-inset'),
    grid: get('--grid-line'),
    colorScheme: s.colorScheme,
    hasThemeAttr: document.documentElement.hasAttribute('data-theme'),
  }
})

/* 顶层逗号切分：rgba() 内部的逗号不能被当成层分隔符 */
const splitShadows = (raw) => {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of raw) {
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/* 解析 box-shadow token：只接受 "x y blur [spread] color" 形式的层 */
const shadowLayers = (raw) =>
  splitShadows(raw).map((layer) => {
    /* 0 可以不带单位（浏览器会把 0px 序列化回 0），其余分量必带 px */
    const m = layer.match(/^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?\s+rgba?\(([^)]+)\)$/)
    if (!m) return null
    return {
      x: Number(m[1]),
      y: Number(m[2]),
      blur: Number(m[3]),
      spread: m[4] === undefined ? 0 : Number(m[4]),
      alpha: Number(m[5].split(',').pop()),
    }
  })

/* 卡片投影规则：只向下、双层、近层小而实 / 远层大而柔、模糊 > 偏移、扩散 ≤ 0、不透明度 ≤ 20% */
const cardShadowOk = [tokens.raisedSm, tokens.raised, tokens.raisedLg]
  .map(shadowLayers)
  .every((layers) => {
    if (layers.length !== 2 || layers.includes(null)) return false
    const [near, far] = layers
    return layers.every((l) => l.x === 0 && l.y > 0 && l.blur > l.y && l.spread <= 0 && l.alpha <= 0.2)
      && near.blur < far.blur && near.alpha > far.alpha
  })

check('单主题：html 不再挂 data-theme', tokens.hasThemeAttr === false)
check('浅蓝工作台底色', (await bg()) === 'rgb(247, 247, 244)', await bg())
check('color-scheme 固定为 light', tokens.colorScheme === 'light', tokens.colorScheme)
check('theme-color 同步浅蓝', (await meta()) === '#eef2f7', await meta())
check('主色 / 墨色 / 分隔线取自平台色板',
  tokens.accent === '#3b6a9c' && tokens.ink === '#1c1d1f' && tokens.line === '#e3eaf3',
  `${tokens.accent} / ${tokens.ink} / ${tokens.line}`)
check('字体栈以 Archivo 开头', tokens.font.startsWith('Archivo'), tokens.font)
check('卡片阴影：只向下 · 双层近实远柔 · 模糊大于偏移 · 扩散不撑开 · 不透明度 ≤ 20%',
  cardShadowOk && tokens.raised.includes('rgba(45, 75, 115') && tokens.inset.includes('inset'),
  `${tokens.raised} | ${tokens.inset}`)
check('背景网格使用钢蓝低透明度', tokens.grid.includes('59, 106, 156'), tokens.grid)

const header = await page.evaluate(() => {
  const actions = [...document.querySelectorAll('.header-actions > *')]
  return {
    classes: actions.map((n) => n.className.split(' ')[0]),
    visible: actions.map((n) => getComputedStyle(n).display !== 'none'),
    themeToggle: document.querySelectorAll('#theme-toggle, .theme-icon, .seg[data-key="theme"]').length,
  }
})
check('头部只保留 GitHub 与进入平台两个入口',
  header.classes.join('|') === 'btn-github|btn-entry' && header.visible.every(Boolean),
  header.classes.join(' | '))
check('明暗切换按钮与主题分段控件已移除', header.themeToggle === 0)

const tweaks = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.tweak-row > span')].map((n) => n.textContent.trim())
  return { rows, themeRow: document.querySelectorAll('.seg[data-key="theme"]').length }
})
check('Tweaks 只保留速度与光标两项',
  tweaks.rows.join('|') === '速度|光标' && tweaks.themeRow === 0,
  tweaks.rows.join(' | '))

await page.locator('#tweaks-trigger').click()
check('Tweaks 面板可打开', await page.locator('.tweaks').isVisible())
await page.screenshot({ path: resolve(out, 'tweaks-light.png') })
await page.keyboard.press('Escape')
check('Esc 关闭 Tweaks', await page.locator('.tweaks').isHidden())
await page.screenshot({ path: resolve(out, 'desktop-light.png') })
await ctx.close()

// 旧版本留下的 theme 配置不能再影响首屏
const legacy = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await legacy.addInitScript(() => {
  localStorage.setItem('fc-stage', JSON.stringify({ theme: 'ink', speed: 1.5, agents: 14 }))
})
const lp = await legacy.newPage()
lp.on('pageerror', (e) => errors.push(String(e)))
await lp.goto(base, { waitUntil: 'networkidle' })
await lp.waitForFunction(() => document.documentElement.dataset.stage === 'live', { timeout: 20000 })
const legacyState = await lp.evaluate(() => ({
  hasTheme: document.documentElement.hasAttribute('data-theme'),
  bg: getComputedStyle(document.body).backgroundColor,
  stage: document.documentElement.dataset.stage,
}))
check('旧 localStorage 主题配置被忽略且页面正常完成',
  legacyState.hasTheme === false && legacyState.bg === 'rgb(247, 247, 244)' && legacyState.stage === 'live',
  JSON.stringify(legacyState))
await legacy.close()

// 移动端：单主题结构完整、可点击区达标
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const mp = await mctx.newPage()
mp.on('pageerror', (e) => errors.push(String(e)))
await mp.goto(base, { waitUntil: 'networkidle' })
await mp.waitForFunction(() => document.documentElement.dataset.stage === 'live', { timeout: 20000 })
const mobile = await mp.evaluate(() => {
  const entry = document.querySelector('.btn-entry')
  const github = document.querySelector('.btn-github').getBoundingClientRect()
  return {
    overflow: document.documentElement.scrollWidth - innerWidth,
    entryHidden: getComputedStyle(entry).display === 'none',
    github: Math.min(github.width, github.height),
  }
})
check('移动端无横向溢出', mobile.overflow <= 0, `${mobile.overflow}px`)
check('移动端隐藏头部「进入平台」', mobile.entryHidden)
check('移动端图标按钮 ≥ 44px', mobile.github >= 44, `${Math.round(mobile.github)}px`)
await mp.screenshot({ path: resolve(out, 'mobile-light.png') })
await mctx.close()

// reduced motion：跳过编舞但内容完整
const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const rp = await rctx.newPage()
rp.on('pageerror', (e) => errors.push(String(e)))
await rp.goto(base, { waitUntil: 'networkidle' })
await rp.waitForTimeout(400)
check('reduced motion 直接呈现完整内容',
  (await rp.locator('[data-build="cta"]').isVisible()) &&
  (await rp.evaluate(() => document.documentElement.dataset.stage)) === 'live')
await rctx.close()

check('无运行时异常', errors.length === 0, errors.join(' | ') || '0 errors')

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
