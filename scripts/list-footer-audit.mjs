import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { installBuiltPages, installFixtures, session } from './audit-fixtures.mjs'

const base = process.env.SMIS_AUDIT_BASE || 'http://127.0.0.1:5173/'
const output = process.env.SMIS_AUDIT_LIST_OUTPUT
const baseline = process.argv.includes('--baseline')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
if (output) await mkdir(output, { recursive: true })

try {
  for (const width of [320, 393]) {
    for (const [name, endpoint, list, row, title] of [
      ['risk', 'smis_list_risk_inspection_tasks_secure', '.task-list', '.card', '无法加载更多任务'],
      ['inspection', 'smis_list_hidden_hazard_inspection_tasks_secure', '.task-list', '.card', '无法加载更多任务'],
      ['hazards', 'smis_list_hidden_hazard_governance_secure', '.hazard-list', '.hazard', '无法加载更多隐患']
    ]) {
      const state = { dense: true, denseCount: 36, overlapListPages: true, listNextPageFailure: true }
      const page = await browser.newPage({ viewport: { width, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
      page.setDefaultTimeout(8000)
      await installBuiltPages(page, base)
      await installFixtures(page, state)
      await page.addInitScript(value => localStorage.setItem('smis-mobile-session', JSON.stringify({ type: 'string', data: JSON.stringify(value) })), session)
      const offsets = []
      page.on('request', request => {
        if (request.url().includes(endpoint)) offsets.push(request.postDataJSON().p_from)
      })
      const atOffset = (response, offset, status) => response.url().includes(endpoint) && response.request().postDataJSON().p_from === offset && response.status() === status
      try {
        await page.goto(`${base}#/pages/${name}/index`)
        const cards = page.locator(`${list} ${row}`)
        await cards.nth(14).waitFor()
        const more = page.getByRole('button', { name: '加载更多', exact: true })
        const firstResponse = page.waitForResponse(response => atOffset(response, 15, 503))
        if (baseline) {
          assert.equal(await more.count(), 0)
          await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight))
        } else {
          assert.ok((await more.boundingBox()).height >= 44, 'Load more is a clear touch target')
          await more.evaluate(element => element.focus({ preventScroll: true }))
          assert.equal(await more.evaluate(element => document.activeElement === element), true)
          await page.keyboard.press('Enter')
        }
        await firstResponse
        const error = (baseline ? page.locator('.page-body > .mobile-load-error') : page.locator(list).locator('.mobile-load-error')).first()
        await error.waitFor()
        assert.equal(await cards.count(), 15, 'A page failure must preserve loaded cards')
        const retry = error.getByRole('button', { name: '重试', exact: true })
        if (!baseline) {
          await error.getByText(title, { exact: true }).waitFor()
          assert.equal(await page.locator('.page-body > .mobile-load-error').count(), 0)
          await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight))
          const box = await error.boundingBox()
          assert.ok(box.y >= 0 && box.y + box.height <= 852)
        }
        if (output) await page.screenshot({ path: resolve(output, `${width}-${name}-append-error.png`), animations: 'disabled' })
        const scrollBefore = await page.evaluate(() => window.scrollY)
        const retryOffset = baseline ? 0 : 15
        state.listNextPageFailure = false
        const secondResponse = page.waitForResponse(response => atOffset(response, retryOffset, 200))
        await retry.press('Enter')
        await secondResponse
        if (baseline) {
          await cards.nth(14).waitFor()
          assert.equal(await cards.count(), 15)
        } else {
          await cards.nth(28).waitFor()
          assert.equal(await cards.count(), 29)
          assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - scrollBefore) <= 2, 'Retry does not scroll away from existing results')
        }
        results.push({ route: name, width, baseline, pageRows: await cards.count(), offsets })
      } finally {
        await page.close()
      }
    }
  }
} finally {
  await browser.close()
  if (output) await writeFile(resolve(output, 'report.json'), JSON.stringify(results, null, 2) + '\n')
}
console.log(`${results.length} ${baseline ? 'baseline' : 'current'} list footer cases verified`)
