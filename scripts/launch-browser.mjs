// 统一浏览器入口：本机可能只装了 Edge；Playwright 自带 Chromium 也可能未下载。
// 顺序：Edge → Chrome → Playwright 自带 Chromium。
import { chromium } from 'playwright'

export async function launchBrowser() {
  let lastError
  for (const options of [{ channel: 'msedge' }, { channel: 'chrome' }, {}]) {
    try { return await chromium.launch({ ...options, headless: true }) }
    catch (error) { lastError = error }
  }
  throw lastError
}
