import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { installFixtures, session } from './audit-fixtures.mjs'

const base = process.env.SMIS_AUDIT_BASE || 'http://127.0.0.1:5173/'
const output = resolve(process.env.SMIS_AUDIT_OUTPUT || 'artifacts/visual-audit')
const routes = ['login/index', 'home/index', 'workbench/index', 'messages/index', 'quick-report/index', 'equipment/index', 'equipment/detail', 'schedule/index', 'risk/index', 'risk/detail', 'inspection/index', 'inspection/detail', 'hazards/index', 'hazards/detail', 'mine/index', 'settings/index']
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = [], errors = []
try {
  for (const width of [320, 393, 520, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
    await context.addInitScript(value => {
      if (!location.protocol.startsWith('http')) return
      if (location.hash.includes('/pages/login/index')) localStorage.removeItem('smis-mobile-session')
      else localStorage.setItem('smis-mobile-session', JSON.stringify({ type: 'string', data: JSON.stringify(value) }))
    }, session)
    const page = await context.newPage()
    const state = { empty: false, failure: false, dense: true }
    await installFixtures(page, state)
    page.on('pageerror', error => errors.push({ width, url: page.url(), message: error.message, stack: error.stack }))
    page.on('console', async message => { if (message.type() === 'error' && !state.failure) errors.push({ width, url: page.url(), message: message.text(), details: await Promise.all(message.args().map(arg => arg.jsonValue().catch(() => null))) }) })
    page.on('console', message => { if (message.type() === 'warning' && /Invalid prop|Failed to resolve component|Extraneous non-props attributes/.test(message.text())) errors.push({ width, url: page.url(), message: message.text() }) })
    for (const route of routes) {
      await page.goto('about:blank')
      await page.goto(`${base}#/pages/${route}${route.endsWith('detail') ? '?id=audit-task' : ''}`)
      await page.waitForSelector('uni-page-body')
      await page.waitForTimeout(500)
      if (route === 'login/index') {
        await page.getByText('登录', { exact: true }).waitFor()
      } else if (!page.url().includes(`/pages/${route}`)) {
        throw new Error(`Expected ${route}, opened ${page.url()}`)
      }
      await page.evaluate(() => document.fonts.ready)
      const name = route.replace('/', '-')
      await page.screenshot({ path: resolve(output, `${width}-${name}-top.png`) })
      const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('uni-page-body *')].filter(el => { const box = el.getBoundingClientRect(); const style = getComputedStyle(el); return box.width > 0 && box.right > innerWidth + 2 && style.position !== 'absolute' && !el.closest('.wd-popup, .wd-tabs__nav-container, .uni-scroll-view') }).slice(0, 8).map(el => ({ tag: el.tagName, class: el.className })) }))
      await page.mouse.wheel(0, 2000)
      await page.waitForTimeout(100)
      await page.screenshot({ path: resolve(output, `${width}-${name}-bottom.png`) })
      results.push({ width, route, actualUrl: page.url(), layout })
      console.log(`${width} ${route}: ${layout.document}/${layout.viewport}`)
    }
    state.empty = true
    for (const route of ['risk/index', 'inspection/index', 'equipment/index', 'hazards/index', 'messages/index']) {
      await page.goto('about:blank'); await page.goto(`${base}#/pages/${route}`); await page.waitForTimeout(400)
      await page.screenshot({ path: resolve(output, `${width}-${route.replace('/', '-')}-empty.png`) })
    }
    state.empty = false
    state.failure = true
    await page.goto('about:blank')
    await page.goto(`${base}#/pages/equipment/index`)
    await page.locator('.load-error').waitFor()
    await page.screenshot({ path: resolve(output, `${width}-equipment-error.png`) })
    await context.close()
  }
} finally {
  await writeFile(resolve(output, 'audit.json'), JSON.stringify({ results, errors }, null, 2))
  await browser.close()
}
if (errors.length || results.some(result => result.layout.document > result.layout.viewport || result.layout.overflow.length)) process.exitCode = 1
