import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { installBuiltPages, installFixtures, session } from './audit-fixtures.mjs'

const base = process.env.SMIS_AUDIT_BASE || 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []

async function audit(name, state, run) {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  page.setDefaultTimeout(7000)
  await installBuiltPages(page, base)
  await installFixtures(page, state)
  await page.addInitScript(value => {
    localStorage.setItem('smis-mobile-session', JSON.stringify({ type: 'string', data: JSON.stringify(value) }))
  }, session)
  try {
    await run(page)
    results.push({ name, passed: true })
  } catch (error) {
    results.push({ name, passed: false, error: error.message })
  } finally {
    await page.close()
  }
}

function nextPaint(page) {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function scrollToBottom(page) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await nextPaint(page)
  await page.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight))
}

try {
  const equipment = { equipmentCount: 1 }
  await audit('Equipment keeps submitted search when pulling to refresh', equipment, async page => {
    await page.goto(`${base}#/pages/equipment/index`)
    await page.locator('.equipment').waitFor()
    const keyword = page.getByRole('searchbox', { name: '搜索设备' })
    const searchRequests = []
    page.on('request', request => {
      if (request.url().includes('smis_list_equipment')) searchRequests.push(request.postDataJSON()?.p_keyword)
    })
    equipment.delayEquipmentKeyword = '新型号'
    let release
    equipment.equipmentResponseGate = new Promise(resolve => { release = resolve })
    const pending = page.waitForRequest(request => request.url().includes('smis_list_equipment') && request.postDataJSON()?.p_keyword === '新型号')
    try {
      await keyword.fill('新型号')
      await page.getByRole('button', { name: '查询', exact: true }).click()
      await pending
      await keyword.blur()
      const cdp = await page.context().newCDPSession(page)
      const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: y ? [{ x: 195, y }] : [] })
      await touch('touchStart', 180)
      for (const y of [220, 280, 370, 500]) await touch('touchMove', y)
      await touch('touchEnd')
      await page.locator('.uni-page-refresh--refreshing, .uni-page-refresh--restoring').first().waitFor({ state: 'attached' })
      await nextPaint(page)
      assert.deepEqual(searchRequests, ['新型号'])
    } finally {
      release()
    }
    await page.getByText('“新型号”的查询结果', { exact: true }).waitFor()
  })

  for (const [route, rpc, card] of [
    ['risk', 'smis_list_risk_inspection', '.task-list .card'],
    ['inspection', 'smis_list_hidden_hazard_inspection', '.task-list .card'],
    ['hazards', 'smis_list_hidden_hazard_governance', '.hazard-list .hazard']
  ]) {
    await audit(`${route} consumes overlapping pages once and stops on empty`, { dense: true, denseCount: 36, overlapListPages: true }, async page => {
      await page.goto(`${base}#/pages/${route}/index`)
      await page.locator(card).nth(14).waitFor()
      const requestedPage = index => page.waitForResponse(response => response.url().includes(rpc) && response.request().postDataJSON()?.p_from === index)
      const overlap = requestedPage(15)
      await scrollToBottom(page)
      await overlap
      await page.locator(card).nth(28).waitFor()
      await nextPaint(page)
      assert.equal(await page.locator(card).count(), 29)
      // Uni H5 suppresses reach-bottom events for 350 ms after a page load starts.
      await page.waitForTimeout(360)
      const exhausted = requestedPage(30)
      await scrollToBottom(page)
      await exhausted
      await page.getByText('已加载 29 条', { exact: true }).waitFor()
    })
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify(results, null, 2))
if (results.some(result => !result.passed)) process.exitCode = 1
