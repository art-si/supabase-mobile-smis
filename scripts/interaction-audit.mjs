import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { installBuiltPages, installFixtures, seedSession, session } from './audit-fixtures.mjs'
const base = process.env.SMIS_AUDIT_BASE || 'http://127.0.0.1:5173/'
const flowOutput = process.env.SMIS_AUDIT_FLOW_OUTPUT
if (flowOutput) await mkdir(flowOutput, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const photoPng = { name: 'audit.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aA0cAAAAASUVORK5CYII=', 'base64') }
async function choosePhoto(page) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '拍照上传' }).click()
  await (await chooser).setFiles(photoPng)
}
async function capture(page, name) {
  if (flowOutput) await page.screenshot({ path: resolve(flowOutput, `${name}.png`) })
}
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } })
  const state = { empty: false, failure: false }
  await installBuiltPages(page, base)
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
  await page.getByRole('button', { name: '海洋蓝' }).click()
  await page.getByRole('button', { name: '海洋蓝', pressed: true }).waitFor()
  await page.reload()
  await page.getByRole('button', { name: '海洋蓝', pressed: true }).waitFor()
  await page.goto(`${base}#/pages/quick-report/index`)
  const siteTrigger = page.getByRole('button', { name: '场所区域', exact: true })
  await siteTrigger.press('Enter')
  const siteOptions = page.getByRole('dialog', { name: '场所区域' })
  await siteOptions.waitFor()
  await page.waitForFunction(() => {
    const panel = document.querySelector('[role="dialog"][aria-label="场所区域"]')?.getBoundingClientRect()
    return panel?.height > 64 && panel.bottom <= innerHeight + 1
  })
  await capture(page, 'report-site-select')
  await siteOptions.getByRole('button', { name: '二号生产车间南侧危险化学品暂存区与设备维修作业现场', exact: true }).click()
  await siteTrigger.getByText('二号生产车间南侧危险化学品暂存区与设备维修作业现场', { exact: true }).waitFor()
  await siteOptions.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.activeElement?.id === 'report-siteId')
  await page.locator('.report-submit').click()
  await page.getByRole('alert').getByText('请填写或采集具体位置', { exact: true }).waitFor()
  assert.equal(await page.locator('.location-field__input input').evaluate(input => document.activeElement === input), true)
  await capture(page, 'report-inline-errors')
  state.uploadFailure = true
  await choosePhoto(page)
  const retryPhoto = page.getByRole('button', { name: '重新上传第 1 张现场照片' })
  await retryPhoto.waitFor()
  state.uploadFailure = false
  await retryPhoto.click()
  const removePhoto = page.getByRole('button', { name: '删除第 1 张现场照片' })
  await retryPhoto.waitFor({ state: 'hidden' })
  await removePhoto.click()
  await removePhoto.waitFor({ state: 'hidden' })
  await page.locator('.location-field__input input').fill('二号车间东侧设备点位')
  const clearLocation = page.getByRole('button', { name: '清除位置', exact: true })
  await clearLocation.waitFor()
  const locationActions = await page.locator('.location-field__actions').evaluate(actions => {
    const center = node => {
      const rect = node.getBoundingClientRect()
      return rect.y + rect.height / 2
    }
    const label = actions.querySelector('.location-field__button .mobile-inline-pair__label')
    const textCenter = element => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return center(range)
    }
    return {
      icon: center(actions.querySelector('.location-field__button .mobile-icon')),
      label: center(label),
      capture: textCenter(label),
      clear: textCenter(actions.querySelector('.location-field__clear'))
    }
  })
  assert.ok(Math.abs(locationActions.icon - locationActions.label) <= 1 && Math.abs(locationActions.capture - locationActions.clear) <= 1,
    'Location icon and action labels stay vertically centered')
  await clearLocation.click()
  const location = page.getByRole('textbox', { name: '具体位置' })
  await page.waitForFunction(() => {
    const input = document.getElementById('report-location-input')
    return input?.value === '' && document.activeElement === input
  })
  await location.fill('二号车间东侧设备点位')
  await page.getByRole('button', { name: '隐患等级', exact: true }).click()
  await page.getByRole('dialog', { name: '隐患等级' }).getByRole('button', { name: 'D级 · 一般隐患' }).click()
  const description = page.getByRole('textbox', { name: '隐患描述' })
  await page.locator('.report-submit').click()
  await page.getByRole('alert').getByText('请描述现场隐患', { exact: true }).waitFor()
  assert.equal(await description.evaluate(input => document.activeElement === input), true)
  assert.equal(await description.getAttribute('aria-describedby'), 'report-description-hint report-description-error')
  await capture(page, 'report-description-error')
  const reportText = '设备防护罩松动，需隔离检查。'
  await description.fill(reportText)
  await page.getByText(`${reportText.length}/500`, { exact: true }).waitFor()
  assert.equal(await description.getAttribute('aria-invalid'), null)
  await page.locator('.report-submit').click()
  await page.getByText('请至少上传 1 张现场照片', { exact: true }).waitFor()
  await choosePhoto(page)
  await removePhoto.waitFor()
  state.rejectReport = true
  await page.locator('.report-submit').click()
  const reportError = page.locator('.report-action-dock').getByRole('alert')
  await reportError.waitFor()
  const reportErrorBox = await reportError.boundingBox()
  const reportSubmitBox = await page.locator('.report-submit').boundingBox()
  assert.ok(reportErrorBox.y + reportErrorBox.height <= reportSubmitBox.y, 'Submit failure stays above the report action')
  await capture(page, 'report-dock-error')
  assert.equal(await page.locator('textarea').first().inputValue(), '设备防护罩松动，需隔离检查。')
  await removePhoto.waitFor()
  state.rejectReport = false
  await page.locator('.report-submit').click()
  await page.getByText('上报成功', { exact: true }).waitFor()
  assert.equal(await page.locator('#report-receipt-reference').innerText(), '隐患编号 HZ-20261008-0001')
  await capture(page, 'report-receipt')
  await page.getByText('查看隐患', { exact: true }).last().click()
  await page.waitForURL(/#\/pages\/hazards\/detail\?id=audit-hazard/)
  await page.goto(`${base}#/pages/risk/detail?id=audit-task`)
  const riskResult = page.getByRole('group', { name: '第 1 项检查结果' })
  await riskResult.getByRole('button', { name: '异常', exact: true }).click()
  await riskResult.getByRole('button', { name: '异常', exact: true, pressed: true }).waitFor()
  const remark = page.locator('.check-item__remark textarea')
  await remark.waitFor()
  await page.getByText('完成并提交', { exact: true }).click()
  await page.getByText('请补充异常情况与位置', { exact: true }).waitFor()
  assert.equal(await remark.evaluate(input => document.activeElement === input), true)
  await capture(page, 'inspection-inline-errors')
  const actionBox = await page.locator('.result-button').first().boundingBox()
  assert.ok(actionBox.height >= 44, 'Inspection actions must be at least 44px tall')
  state.failure = true
  await page.getByRole('button', { name: '保存进度', exact: true }).click()
  const saveError = page.locator('.task-dock').getByRole('alert')
  await saveError.waitFor()
  const taskErrorBox = await saveError.boundingBox()
  const taskActionBox = await page.locator('.task-dock .mobile-dock__actions').boundingBox()
  assert.ok(taskErrorBox.y + taskErrorBox.height <= taskActionBox.y, 'Save failure stays above the inspection actions')
  await capture(page, 'inspection-dock-error')
  state.failure = false
  state.mutationDelay = 600
  const saveRisk = page.waitForRequest(request => request.url().includes('smis_save_risk_inspection_execution'))
  await page.getByText('保存进度', { exact: true }).click()
  assert.equal((await saveRisk).postDataJSON().p_complete, false)
  await page.getByText('正在保存…', { exact: true }).waitFor()
  assert.equal(await remark.isDisabled(), true)
  await page.getByText('进度已保存', { exact: true }).waitFor()
  state.mutationDelay = 0
  await page.goto(`${base}#/pages/inspection/detail?id=audit-task`)
  await page.locator('.result-button').nth(0).click()
  await page.locator('.result-button').nth(2).click()
  const submitInspection = page.waitForRequest(request => request.url().includes('smis_save_hidden_hazard_inspection_execution'))
  await page.getByText('完成并提交', { exact: true }).click()
  assert.equal((await submitInspection).postDataJSON().p_complete, true)
  await page.locator('.closed-note').waitFor()
  for (const width of [320, 393, 520]) {
    await page.setViewportSize({ width, height: 852 })
    await page.goto(`${base}#/pages/risk/index`)
    await page.locator('.task-list').waitFor()
    const alignment = await page.evaluate(() => {
      const search = document.querySelector('.mobile-search').getBoundingClientRect()
      const button = document.querySelector('.mobile-search__submit').getBoundingClientRect()
      const surface = document.querySelector('.mobile-search__action-label').getBoundingClientRect()
      const meta = document.querySelector('.card__meta')
      const icon = meta.querySelector('.mobile-icon').getBoundingClientRect()
      const text = meta.querySelector('.line-clamp-2')
      const firstLineCenter = text.getBoundingClientRect().top + parseFloat(getComputedStyle(text).lineHeight) / 2
      return { buttonHeight: button.height, surfaceHeight: surface.height, searchCenter: Math.abs(surface.y + surface.height / 2 - search.y - search.height / 2), metaCenter: Math.abs(icon.y + icon.height / 2 - firstLineCenter) }
    })
    assert.ok(alignment.buttonHeight >= 44, 'Small search buttons retain a 44px touch target')
    assert.ok(alignment.surfaceHeight <= 33, 'The search button surface must remain compact')
    assert.ok(alignment.searchCenter <= 1, 'Search button must be vertically centered')
    assert.ok(alignment.metaCenter <= 1, 'Task metadata icon must align with the first line of text')
  }
  await page.setViewportSize({ width: 320, height: 852 })
  for (const { route, groupName, list, rpc, delayedStatus, first, last } of [
    { route: 'risk', groupName: '筛选任务状态', list: '.task-list', rpc: 'smis_list_risk_inspection', delayedStatus: 'overdue', first: '已逾期', last: '执行中' },
    { route: 'inspection', groupName: '筛选任务状态', list: '.task-list', rpc: 'smis_list_hidden_hazard_inspection', delayedStatus: 'not_started', first: '待执行', last: '执行中' },
    { route: 'hazards', groupName: '筛选隐患状态', list: '.hazard-list', rpc: 'smis_list_hidden_hazard_governance', delayedStatus: 'pending_acceptance', first: '待验收', last: '整改中' }
  ]) {
    await page.goto(`${base}#/pages/${route}/index`)
    const results = page.locator(list)
    await results.waitFor()
    const statusGroup = page.getByRole('group', { name: groupName })
    const options = await statusGroup.getByRole('button').evaluateAll(nodes => nodes.map(node => {
      const { x, y, width, height } = node.getBoundingClientRect()
      return { x, y, width, height }
    }))
    assert.equal(options.length, 5)
    assert.ok(options.every(option => option.width >= 44 && option.height >= 44 && option.y === options[0].y), `${route} uses five aligned touch targets at 320px`)
    let releaseStatus
    state.delayedStatus = delayedStatus
    state.statusResponseGate = new Promise(resolve => { releaseStatus = resolve })
    const isDelayedStatus = request => request.url().includes(rpc) && request.postDataJSON().p_status === delayedStatus
    const delayedRequest = page.waitForRequest(isDelayedStatus)
    const delayedResponse = page.waitForResponse(response => isDelayedStatus(response.request()))
    await statusGroup.getByRole('button', { name: first, exact: true }).click()
    await delayedRequest
    const latest = statusGroup.getByRole('button', { name: last, exact: true })
    await latest.press('Enter')
    await results.getByText(last, { exact: true }).waitFor()
    assert.equal(await latest.getAttribute('aria-pressed'), 'true')
    releaseStatus()
    await delayedResponse
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.equal(await results.getByText(first, { exact: true }).count(), 0, `${route} ignores the stale status response`)
    state.delayedStatus = undefined
    await capture(page, `${route}-status-selection-320`)
  }
  await page.setViewportSize({ width: 393, height: 852 })
  state.failure = true
  await page.goto(`${base}#/pages/equipment/index`)
  await page.locator('.mobile-load-error').waitFor()
  state.failure = false
  await page.locator('.mobile-load-error__retry').click()
  await page.locator('.equipment-list').waitFor()
  await page.locator('.mobile-load-error').waitFor({ state: 'hidden' })
  state.equipmentCount = 18
  state.delayEquipmentKeyword = '旧型号'
  let releaseOldEquipment
  state.equipmentResponseGate = new Promise(resolve => { releaseOldEquipment = resolve })
  const searchEquipment = page.getByRole('searchbox', { name: '搜索设备' })
  const submitEquipment = page.getByRole('button', { name: '查询', exact: true })
  const isEquipmentQuery = (request, keyword) => request.url().includes('smis_list_equipment') && request.postDataJSON().p_keyword === keyword
  const oldEquipmentRequest = page.waitForRequest(request => isEquipmentQuery(request, '旧型号'))
  await searchEquipment.fill('旧型号')
  await submitEquipment.click()
  await oldEquipmentRequest
  try {
    await page.getByText('正在查询设备…', { exact: true }).waitFor()
    await searchEquipment.fill('新型号')
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await Promise.all([page.waitForRequest(request => isEquipmentQuery(request, '新型号')), submitEquipment.click()])
    await page.getByText('“新型号”的查询结果', { exact: true }).waitFor()
  } finally {
    const oldEquipment = page.waitForResponse(response => isEquipmentQuery(response.request(), '旧型号'))
    releaseOldEquipment()
    await oldEquipment
  }
  assert.equal(await page.locator('.equipment-result').innerText(), '“新型号”的查询结果')
  await capture(page, 'equipment-query-results')
  await searchEquipment.fill('尚未提交的型号')
  await page.getByRole('button', { name: '加载更多', exact: true }).waitFor()
  state.equipmentPageFailure = true
  const equipmentPage = page.waitForRequest(request => request.url().includes('smis_list_equipment') && request.postDataJSON().p_from === 15)
  await page.getByRole('button', { name: '加载更多', exact: true }).click()
  assert.equal((await equipmentPage).postDataJSON().p_keyword, '新型号')
  await page.getByText('无法加载更多设备', { exact: true }).waitFor()
  assert.equal(await page.locator('.equipment-list .equipment').count(), 15)
  state.equipmentPageFailure = false
  await page.locator('.mobile-load-error__retry').click()
  await page.locator('.equipment-list .equipment').nth(17).waitFor()
  state.equipmentCount = 0
  await page.goto(`${base}#/pages/home/index`)
  await page.locator('[aria-label="工作台"]').click()
  await page.waitForURL(/#\/pages\/workbench\/index/)
  await page.getByRole('searchbox', { name: '搜索应用' }).fill('不存在的应用')
  await page.getByText('未找到相关应用', { exact: true }).waitFor()
  await page.getByRole('button', { name: '清除搜索' }).click()
  await page.getByRole('button', { name: /风险巡查/ }).waitFor()
  await page.getByRole('searchbox', { name: '搜索应用' }).fill('Web 作业')
  await page.getByText('特殊作业', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: /特殊作业/ }).count(), 0)
  await page.getByRole('button', { name: '清除搜索' }).click()
  await capture(page, 'workbench-native-groups')
  await page.getByRole('button', { name: /设备台账/ }).click()
  await page.waitForURL(/#\/pages\/equipment\/index/)
  await page.locator('.equipment-list .equipment').first().click()
  await page.waitForURL(/#\/pages\/equipment\/detail/)
  state.shiftByMonth = true
  await page.goto(`${base}#/pages/schedule/index`)
  const monthLabel = page.locator('.calendar__head').getByText(/^\d{4}年\d{1,2}月$/)
  const originalMonth = await monthLabel.innerText()
  const [year, month] = originalMonth.match(/\d+/g).map(Number)
  const next = new Date(year, month, 1)
  state.delayShiftMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  await page.locator('.shift').nth(1).waitFor()
  const nextMonthResponse = page.waitForResponse(response => response.url().includes('smis_get_employee_shift_calendar') && response.request().postDataJSON().p_month.startsWith(state.delayShiftMonth))
  await page.getByRole('button', { name: '下个月' }).click()
  assert.notEqual(await monthLabel.innerText(), originalMonth)
  assert.equal(await page.locator('.day__mark').count(), 0, 'Do not show previous shifts in a different month')
  await page.getByRole('button', { name: '上个月' }).click()
  await nextMonthResponse
  assert.equal(await monthLabel.innerText(), originalMonth)
  await page.getByText(`${year}-${String(month).padStart(2, '0')} 白班`, { exact: true }).waitFor()
  await page.getByText('2 班', { exact: true }).waitFor()
  await page.getByRole('button', { name: '上个月' }).click()
  await page.locator('.shift').nth(1).waitFor()
  await page.getByText('20:00–05:00 · 次日结束', { exact: true }).waitFor()
  await capture(page, 'schedule-historical-shifts')
  state.dense = true
  state.delayMessagePage = true
  await page.goto(`${base}#/pages/messages/index`)
  await page.locator('.message').nth(15).waitFor()
  await page.getByRole('button', { name: '加载更多', exact: true }).waitFor()
  const messagePage = page.waitForResponse(response => response.url().includes('smis_list_risk_inspection') && response.request().postDataJSON().p_from === 8)
  await page.getByRole('button', { name: '加载更多', exact: true }).click()
  await page.getByText('正在加载更多…', { exact: true }).waitFor()
  state.dense = false
  await page.getByRole('button', { name: '刷新消息' }).click()
  await page.getByText('已加载全部 2 条', { exact: true }).waitFor()
  await messagePage
  await page.getByText('已加载全部 2 条', { exact: true }).waitFor()
  assert.equal(await page.locator('.message').count(), 2, 'A stale next page must not append to a refreshed message feed')
  await capture(page, 'messages-refreshed')
  await page.locator('.message').first().click()
  await page.waitForURL(/#\/pages\/(risk|hazards)\/detail/)
  state.hazardStatus = 'rectifying'
  await page.goto(`${base}#/pages/hazards/detail?id=audit-hazard`)
  await page.getByText('提交整改，等待验收', { exact: true }).click()
  await page.getByText('请填写处理说明', { exact: true }).waitFor()
  await capture(page, 'hazard-inline-errors')
  await page.locator('.action__textarea textarea').fill('重新安装护罩并完成复核。')
  await choosePhoto(page)
  await page.locator('.evidence-upload__quota').filter({ hasText: /^1 \/ 6$/ }).waitFor()
  await page.getByText('提交整改，等待验收', { exact: true }).click()
  await page.getByText('退回整改', { exact: true }).waitFor()
  await page.locator('.action__textarea textarea').fill('还有一处螺丝未紧固。')
  await choosePhoto(page)
  await page.locator('.evidence-upload__quota').filter({ hasText: /^1 \/ 6$/ }).waitFor()
  state.mutationDelay = 600
  await page.getByText('退回整改', { exact: true }).click()
  await page.getByText('正在退回…', { exact: true }).waitFor()
  assert.equal(await page.locator('.action__textarea textarea').isDisabled(), true)
  assert.ok(await page.getByText('验收通过', { exact: true }).isVisible())
  await page.getByText('提交整改，等待验收', { exact: true }).waitFor()
  await page.getByText('已退回整改', { exact: true }).waitFor()
  await capture(page, 'hazard-return-receipt')
  state.mutationDelay = 0
  state.hazardStatus = 'pending_acceptance'
  await page.reload()
  await page.locator('.action__textarea textarea').fill('已确认护罩紧固、联锁恢复。')
  await choosePhoto(page)
  await page.locator('.evidence-upload__quota').filter({ hasText: /^1 \/ 6$/ }).waitFor()
  await page.getByText('验收通过', { exact: true }).click()
  await page.getByText('验收通过', { exact: true }).waitFor({ state: 'hidden' })
  assert.equal(state.hazardStatus, 'completed')
  // The local H5 server can use any nonempty VITE_AMAP_KEY; this context intercepts every map script request.
  const mapContext = await browser.newContext({ viewport: { width: 393, height: 852 }, permissions: ['geolocation'], geolocation: { longitude: 114.196188, latitude: 30.509834 } })
  const mapPage = await mapContext.newPage()
  await installBuiltPages(mapPage, base)
  await installFixtures(mapPage)
  await mapPage.addInitScript(value => {
    localStorage.setItem('smis-mobile-session', JSON.stringify({ type: 'string', data: JSON.stringify(value) }))
  }, session)
  let mapUnavailable = true
  await mapPage.route('https://webapi.amap.com/maps**', route => mapUnavailable ? route.abort() : route.fulfill({ contentType: 'application/javascript', body: `window.AMap = { Geocoder: class { getAddress(position, callback) { callback('complete', { regeocode: { formattedAddress: '武汉市现场定位测试点' } }) } }, Marker: class {}, Map: class { constructor(id) { this.element = document.getElementById(id); this.element.dataset.mapReady = 'true' } add() {} on(event, callback) { if (event === 'complete') setTimeout(callback, 20) } off() {} destroy() { delete this.element.dataset.mapReady } } }` }))
  await mapPage.goto(`${base}#/pages/quick-report/index`)
  await mapPage.evaluate(() => {
    const actual = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation)
    let attempt = 0
    navigator.geolocation.getCurrentPosition = (success, fail, options) => {
      if (++attempt === 1) fail({ code: 1 })
      else actual(success, fail, options)
    }
  })
  await mapPage.locator('.location-field__button').click()
  const locationFeedback = mapPage.locator('.mobile-location-feedback')
  await locationFeedback.getByText(/定位权限未开启.*手动填写具体位置/).waitFor()
  assert.equal(await locationFeedback.getByRole('button', { name: '打开定位设置' }).count(), 0, 'H5 must explain browser settings without a WeChat-only control')
  assert.equal(await mapPage.locator('.location-field__map-shell').count(), 0)
  await capture(mapPage, '393-location-denied')
  await mapPage.locator('.location-field__button').click()
  await locationFeedback.waitFor({ state: 'hidden' })
  await mapPage.getByText('重新加载地图', { exact: true }).waitFor()
  assert.match(await mapPage.locator('.location-field__coordinates').innerText(), /114\./, 'Map failure must preserve captured coordinates')
  mapUnavailable = false
  await mapPage.getByText('重新加载地图', { exact: true }).click()
  await mapPage.locator('[data-map-ready="true"]').waitFor().catch(error => {
    throw new Error('Map fixture not reached. Start local H5 with VITE_AMAP_KEY=smis-browser-fixture.', { cause: error })
  })
  await mapPage.locator('.location-field__map-state').waitFor({ state: 'hidden' })
  const capturedLocation = mapPage.locator('.location-field__input input')
  assert.match(await capturedLocation.inputValue(), /114\./)
  await mapPage.getByRole('button', { name: '清除位置', exact: true }).click()
  await mapPage.locator('.location-field__map-shell').waitFor({ state: 'hidden' })
  await mapPage.waitForFunction(() => document.querySelector('.location-field__input input')?.value === '')
  await mapContext.close()
  const manualPage = await browser.newPage({ viewport: { width: 320, height: 730 }, isMobile: true, hasTouch: true })
  await installBuiltPages(manualPage, base)
  await installFixtures(manualPage)
  let reverseGeocoded
  const geocodeSettled = new Promise(resolve => { reverseGeocoded = resolve })
  await manualPage.exposeFunction('markAuditReverseGeocoded', () => reverseGeocoded())
  await manualPage.route('https://webapi.amap.com/maps**', route => route.fulfill({ contentType: 'application/javascript', body: `window.AMap = { Geocoder: class { getAddress(position, callback) { callback('complete', { regeocode: { formattedAddress: '晚到的定位结果' } }); requestAnimationFrame(() => window.markAuditReverseGeocoded()) } } }` }))
  await manualPage.addInitScript(value => {
    localStorage.setItem('smis-mobile-session', JSON.stringify({ type: 'string', data: JSON.stringify(value) }))
    navigator.geolocation.getCurrentPosition = success => {
      window.completeLocationCapture = () => success({ coords: { longitude: 114.19, latitude: 30.5, accuracy: 18 } })
    }
  }, session)
  await manualPage.goto(`${base}#/pages/quick-report/index`)
  await manualPage.locator('.location-field__button').tap()
  await manualPage.getByText('定位中…', { exact: true }).waitFor()
  const manualLocation = manualPage.locator('.location-field__input input')
  await manualLocation.fill('手工填写：设备区北侧')
  await manualPage.evaluate(() => window.completeLocationCapture())
  await Promise.race([geocodeSettled, manualPage.waitForTimeout(5000).then(() => { throw new Error('Delayed location fixture did not settle') })])
  await manualPage.getByText('采集位置', { exact: true }).waitFor()
  assert.equal(await manualLocation.inputValue(), '手工填写：设备区北侧', 'A late location result must not overwrite manual entry')
  assert.equal(await manualPage.locator('.location-field__map-shell').count(), 0)
  await capture(manualPage, '320-location-manual-while-pending')
  await manualPage.close()
  await page.goto(`${base}#/pages/mine/index`)
  const logout = page.getByRole('button', { name: '退出登录', exact: true })
  let logoutRequests = 0
  let releaseLogout
  const pendingLogout = new Promise(resolve => { releaseLogout = resolve })
  await page.route('**/auth/v1/logout', async route => {
    logoutRequests += 1
    await pendingLogout
    await route.fulfill({ status: 200, json: {} })
  })
  await logout.focus()
  await logout.press('Enter')
  const confirm = page.getByRole('alertdialog', { name: '退出登录' })
  const cancelLogout = confirm.getByRole('button', { name: '取消' })
  await cancelLogout.waitFor()
  await page.waitForFunction(() => document.activeElement?.classList.contains('mobile-confirm__cancel'))
  await cancelLogout.click()
  await confirm.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === '退出登录')
  assert.match(page.url(), /#\/pages\/mine\/index/)
  assert.equal(logoutRequests, 0, 'Cancel must not request logout')
  await logout.click()
  try {
    await confirm.getByRole('button', { name: '退出登录', exact: true }).click()
    const pendingButton = confirm.getByRole('button', { name: '正在退出…', exact: true })
    await pendingButton.waitFor()
    assert.equal(await confirm.getAttribute('aria-busy'), 'true')
    assert.equal(await pendingButton.isDisabled(), true)
    assert.equal(await cancelLogout.isDisabled(), true)
    await page.keyboard.press('Escape')
    assert.equal(await confirm.isVisible(), true)
    await capture(page, 'logout-pending')
  } finally {
    releaseLogout()
  }
  await page.waitForURL(/#\/(?:pages\/login\/index)?$/)
  await page.getByText('登录', { exact: true }).waitFor()
  assert.equal(logoutRequests, 1, 'Confirm must request logout only once')
  assert.equal(await page.evaluate(() => localStorage.getItem('smis-mobile-session')), null)
  assert.equal(await page.evaluate(() => localStorage.getItem('smis-mobile-session')), null)
  console.log('PASS: login/logout, theme, selector keyboard/focus, required fields and character counts, location clear, photo upload failure/retry/remove, quick report, risk progress, inspection completion, status filter races, hazard rectification and acceptance/return, failure/retry, workbench search/navigation, equipment details, schedule, messages, map retry, touch targets and alignment')
} finally { await browser.close() }
