import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { installFixtures, seedSession, session } from './audit-fixtures.mjs'
const base = process.env.SMIS_AUDIT_BASE || 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
  const state = { empty: false, failure: false }
  await installFixtures(page, state)
  await page.goto(`${base}#/pages/login/index`)
  await page.getByText('登录', { exact: true }).click()
  await page.getByText('请输入手机号或邮箱', { exact: true }).waitFor()
  const loginRequests = []
  page.on('request', request => { if (/functions\/v1\/check_user_status|auth\/v1\/token/.test(request.url())) loginRequests.push(request.url()) })
  await page.locator('input').nth(0).fill('audit@example.com')
  await page.locator('input').nth(1).fill('audit-password')
  await page.getByText('登录', { exact: true }).click()
  await page.waitForURL(/#\/pages\/home\/index/)
  assert.ok(loginRequests.some(url => url.includes('check_user_status')), 'Login must send the account status request')
  assert.ok(loginRequests.some(url => url.includes('grant_type=password')), 'Login must send the password token request')
  await seedSession(page)
  await page.goto(`${base}#/pages/settings/index`)
  await page.locator('.theme-option.smis-theme-ocean').click()
  assert.equal(await page.locator('.theme-option--active').innerText().then(text => text.includes('海洋蓝')), true)
  await page.reload()
  await page.locator('.theme-option--active').waitFor()
  assert.match(await page.locator('.theme-option--active').innerText(), /海洋蓝/)
  await page.goto(`${base}#/pages/quick-report/index`)
  await page.locator('.smis-select-field').nth(1).click()
  await page.locator('.wd-popup' ).waitFor({ state: 'visible' })
  await page.locator('.wd-picker__action--confirm').click()
  await page.locator('.smis-select-field').nth(1).getByText('二号生产车间南侧危险化学品暂存区与设备维修作业现场', { exact: true }).waitFor()
  await page.locator('.report-submit').click()
  await page.getByText('请填写或采集具体位置', { exact: true }).waitFor()
  await page.goto(`${base}#/pages/risk/detail?id=audit-task`)
  await page.locator('.result-button').nth(1).click()
  await page.locator('.result-button.is-abnormal').waitFor()
  await page.locator('.check-item__remark textarea').waitFor()
  const actionBox = await page.locator('.result-button').first().boundingBox()
  assert.ok(actionBox.height >= 44, 'Inspection actions must be at least 44px tall')
  for (const width of [320, 393, 520]) {
    await page.setViewportSize({ width, height: 852 })
    await page.goto(`${base}#/pages/risk/index`)
    await page.locator('.task-list').waitFor()
    const alignment = await page.evaluate(() => {
      const search = document.querySelector('.smis-search').getBoundingClientRect()
      const button = document.querySelector('.smis-search__action').getBoundingClientRect()
      const surface = document.querySelector('.smis-search__action .wd-button__content').getBoundingClientRect()
      const meta = document.querySelector('.card__meta')
      const icon = meta.querySelector('.smis-icon').getBoundingClientRect()
      const text = meta.querySelector('.line-clamp-2').getBoundingClientRect()
      return { buttonHeight: button.height, surfaceHeight: surface.height, searchCenter: Math.abs(surface.y + surface.height / 2 - search.y - search.height / 2), metaCenter: Math.abs(icon.y + icon.height / 2 - text.y - text.height / 2) }
    })
    assert.ok(alignment.buttonHeight >= 44, 'Small search buttons retain a 44px touch target')
    assert.ok(alignment.surfaceHeight <= 33, 'The search button surface must be the Wot small size')
    assert.ok(alignment.searchCenter <= 1, 'Search button must be vertically centered')
    assert.ok(alignment.metaCenter <= 1, 'Task metadata icon must be vertically centered')
  }
  state.failure = true
  await page.goto(`${base}#/pages/equipment/index`)
  await page.locator('.load-error').waitFor()
  state.failure = false
  await page.locator('.load-error__retry').click()
  await page.locator('.equipment-list').waitFor()
  await page.locator('.load-error').waitFor({ state: 'hidden' })
  await page.goto(`${base}#/pages/home/index`)
  await page.locator('[aria-label="工作台"]').click()
  await page.waitForURL(/#\/pages\/workbench\/index/)
  await page.locator('.smis-search input').fill('不存在的应用')
  await page.getByText('未找到相关应用', { exact: true }).waitFor()
  const mapContext = await browser.newContext({ viewport: { width: 393, height: 852 }, permissions: ['geolocation'], geolocation: { longitude: 114.196188, latitude: 30.509834 } })
  const mapPage = await mapContext.newPage()
  await installFixtures(mapPage)
  await mapPage.addInitScript(value => {
    localStorage.setItem('smis-mobile-session', JSON.stringify({ type: 'string', data: JSON.stringify(value) }))
  }, session)
  let mapUnavailable = true
  await mapPage.route('https://webapi.amap.com/maps**', route => mapUnavailable ? route.abort() : route.fulfill({ contentType: 'application/javascript', body: `window.AMap = { Geocoder: class { getAddress(position, callback) { callback('complete', { regeocode: { formattedAddress: '武汉市现场定位测试点' } }) } }, Marker: class {}, Map: class { constructor(id) { this.element = document.getElementById(id); this.element.dataset.mapReady = 'true' } add() {} on(event, callback) { if (event === 'complete') setTimeout(callback, 20) } off() {} destroy() { delete this.element.dataset.mapReady } } }` }))
  await mapPage.goto(`${base}#/pages/quick-report/index`)
  await mapPage.locator('.location-field__button').click()
  await mapPage.getByText('重新加载地图', { exact: true }).waitFor()
  assert.match(await mapPage.locator('.location-field__coordinates').innerText(), /114\./, 'Map failure must preserve captured coordinates')
  mapUnavailable = false
  await mapPage.getByText('重新加载地图', { exact: true }).click()
  await mapPage.locator('[data-map-ready="true"]').waitFor()
  await mapPage.locator('.location-field__map-state').waitFor({ state: 'hidden' })
  await mapContext.close()
  console.log('PASS: login validation, theme persistence, picker selection, required report fields, inspection actions, failure/retry, navigation, map failure/retry with retained coordinates, small search buttons and icon/text alignment')
} finally { await browser.close() }
