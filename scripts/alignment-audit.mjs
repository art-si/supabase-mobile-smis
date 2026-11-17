import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { installFixtures, session } from './audit-fixtures.mjs'

const base = process.env.SMIS_AUDIT_BASE || 'http://127.0.0.1:5173/'
const output = resolve(process.env.SMIS_AUDIT_OUTPUT || 'artifacts/alignment-audit')
const cases = [
  ['home/index', [['首页上报入口', '.report-entry', '.report-entry__icon', ':scope > uni-view:nth-child(2)'], ['首页快捷入口', '.quick-card', '.quick-card__icon', ':scope > uni-text'], ['首页排班入口', '.schedule-card', ':scope > .mobile-icon', ':scope > uni-view']]],
  ['workbench/index', [['工作台服务图标', '.mobile-row', '.mobile-row__icon', '.mobile-row__body'], ['服务搜索', '.mobile-search', '.mobile-search__icon', 'input']]],
  ['messages/index', [['消息图标', '.message', '.message__icon', '.message__copy'], ['消息箭头', '.message', ':scope > .mobile-icon', '.message__copy']]],
  ['equipment/index', [['设备卡片图标', '.equipment__top', '.equipment__icon', '.equipment__copy'], ['设备卡片箭头', '.equipment__top', ':scope > .mobile-icon', '.equipment__copy'], ['设备地点', '.equipment__location', '.mobile-icon', ':scope > uni-text', 'first']]],
  ['equipment/detail?id=audit-equipment', [['设备安装位置', '.location-panel', '.info-icon', ':scope > uni-view:last-child'], ['设备责任信息', '.responsibility-item', '.info-icon', ':scope > uni-view:last-child']]],
  ['risk/index', [['巡查地点', '.card__meta', '.mobile-icon', ':scope > uni-text', 'first'], ['巡查卡片箭头', '.card__foot', '.mobile-icon', ':scope > uni-text:first-child']]],
  ['risk/detail?id=audit-task', [['巡查结果', '.result-actions .mobile-inline-pair', '.mobile-icon', ':scope > uni-text']]],
  ['inspection/index', [['排查地点', '.card__meta', '.mobile-icon', ':scope > uni-text', 'first']]],
  ['inspection/detail?id=audit-task', [['排查结果', '.result-actions .mobile-inline-pair', '.mobile-icon', ':scope > uni-text']]],
  ['hazards/index', [['隐患卡片地点', '.hazard__place', '.mobile-icon', ':scope > uni-text', 'first'], ['隐患卡片箭头', '.hazard__foot', '.mobile-icon', '.hazard__people']]],
  ['hazards/detail?id=audit-hazard', [['隐患处理标题', '.action__head', '.action__icon', ':scope > uni-view:last-child'], ['隐患详细位置', '.hazard-main__place', '.mobile-icon', ':scope > uni-text', 'first'], ['闭环时间线定位点', '.event', '.event__rail .i', '.event__copy .strong', 'first']]],
  ['schedule/index', [['排班切月按钮', '.month-action', '.mobile-icon', ':scope']]],
  ['quick-report/index', [['表单小节', '.form-section__head', '.form-section__icon', '.form-section__copy'], ['现场照片入口', '.mobile-evidence__add', '.mobile-icon', '.mobile-inline-pair__label'], ['上报说明圆点', '.submit-note', '.i', ':scope > uni-text', 'first'], ['必填场所提示', '.option-warning', '.mobile-icon', ':scope > uni-text', 'first']]],
  ['mine/index', [['账号警告', '.link-warning', '.mobile-icon', ':scope > uni-text', 'first'], ['我的账号列表', '.account-links .mobile-row', '.mobile-row__icon', '.mobile-row__body']]],
  ['settings/index', [['主题选择标题', '.theme-picker__label', '.mobile-icon', 'uni-text'], ['选中主题图标', '.theme-picker__swatch--selected', '.mobile-icon', ':scope']]],
  ['login/index', [['登录表单字段', '.login-form__field', '.mobile-icon', 'input']]]
]

const iconBoxes = [
  '.report-entry__icon', '.quick-card__icon', '.safe-state__icon', '.message__icon', '.equipment__icon',
  '.identity__fallback', '.info-icon', '.action__icon', '.form-section__icon', '.location-field__resolved-icon',
  '.mobile-row__icon', '.month-action', '.theme-picker__swatch--selected', '.mobile-select__close'
]

async function measureIconBoxes(page) {
  return page.evaluate(selectors => selectors.flatMap(selector => {
    const items = [...document.querySelectorAll(selector)].flatMap(container => {
      const icon = container.querySelector('.mobile-icon')
      if (!container.getClientRects().length || !icon?.getClientRects().length) return []
      const box = container.getBoundingClientRect()
      const glyph = icon.getBoundingClientRect()
      return [{
        x: Math.abs(glyph.left + glyph.width / 2 - box.left - box.width / 2),
        y: Math.abs(glyph.top + glyph.height / 2 - box.top - box.height / 2),
        target: box.width < box.height ? box.width : box.height
      }]
    })
    return items.length ? [{
      selector, count: items.length,
      x: Math.round(Math.max(...items.map(v => v.x)) * 100) / 100,
      y: Math.round(Math.max(...items.map(v => v.y)) * 100) / 100,
      ...(selector === '.month-action' ? { minTarget: Math.min(...items.map(v => v.target)) } : {})
    }] : []
  }), iconBoxes)
}

async function measure(page, checks) {
  return page.evaluate(rules => {
    const box = node => node.getBoundingClientRect()
    const center = node => box(node).top + box(node).height / 2
    return rules.map(([name, row, graphic, caption, anchor]) => {
      const offsets = [...document.querySelectorAll(row)].flatMap(container => {
        const icon = graphic === '#text' ? (() => {
          const node = [...container.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
          if (!node) return null
          const range = document.createRange()
          range.selectNodeContents(node)
          return range
        })() : container.querySelector(graphic)
        const text = caption === ':scope' ? container : container.querySelector(caption)
        if (!icon?.getClientRects().length || !text?.getClientRects().length) return []
        const target = anchor === 'first' ? box(text).top + parseFloat(getComputedStyle(text).lineHeight) / 2 : center(text)
        return Math.abs(center(icon) - target)
      })
      return { name, count: offsets.length, offset: offsets.length ? Math.round(Math.max(...offsets) * 100) / 100 : null }
    })
  }, checks)
}

const records = []
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const width of [320, 393, 520, 768]) {
    const page = await browser.newPage({ viewport: { width, height: 852 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
    page.setDefaultTimeout(60_000)
    const state = { dense: true, unlinked: true, noSites: true }
    await installFixtures(page, state)
    await page.addInitScript(value => {
      if (!location.protocol.startsWith('http')) return
      if (location.hash.includes('/pages/login/index')) localStorage.removeItem('smis-mobile-session')
      else localStorage.setItem('smis-mobile-session', JSON.stringify({ type: 'string', data: JSON.stringify(value) }))
    }, session)
    for (const [route, checks] of cases) {
      await page.goto('about:blank')
      await page.goto(`${base}#/pages/${route}`)
      await page.locator('uni-page-body .page-shell, uni-page-body .login-page').waitFor()
      if (checks.length) await page.locator(checks.at(-1)[1]).first().waitFor({ state: 'attached' })
      await page.evaluate(() => document.fonts.ready)
      const geometry = await measure(page, checks)
      const layout = await page.evaluate(() => {
        const center = (rect, origin, size) => rect[origin] + rect[size] / 2
        const nav = [...document.querySelectorAll('.bottom-nav__content')].filter(node => node.getClientRects().length).map(node => {
          const icon = node.querySelector('.bottom-nav__icon-box').getBoundingClientRect()
          const label = node.querySelector('.bottom-nav__label').getBoundingClientRect()
          return { offset: Math.abs(center(icon, 'left', 'width') - center(label, 'left', 'width')), top: label.top }
        })
        const tags = [...document.querySelectorAll('.status-tag')].filter(node => node.getClientRects().length).flatMap(node => {
          const item = node.querySelector('.status-tag__dot')
          if (!item) return []
          return Math.abs(center(item.getBoundingClientRect(), 'top', 'height') - center(node.getBoundingClientRect(), 'top', 'height'))
        })
        return { nav: nav.length ? { count: nav.length, horizontalOffset: Math.max(...nav.map(v => v.offset)), labelOffset: Math.max(...nav.map(v => v.top)) - Math.min(...nav.map(v => v.top)) } : null, status: { count: tags.length, offset: Math.max(0, ...tags) } }
      })
      records.push({ width, route, geometry, boxes: await measureIconBoxes(page), ...layout })
      if ([320, 393].includes(width) && /^(home|messages|equipment|quick-report|mine|hazards\/detail|schedule|inspection\/detail)/.test(route)) {
        if (geometry.length) await page.locator(checks.at(-1)[1]).first().scrollIntoViewIfNeeded()
        await page.screenshot({ path: resolve(output, `${width}-${route.split('?')[0].replaceAll('/', '-')}.png`) })
      }
      if (route === 'quick-report/index') {
        await page.getByRole('button', { name: '所属组织', exact: true }).press('Enter')
        const dialog = page.getByRole('dialog', { name: '所属组织', exact: true })
        await dialog.waitFor()
        records.push({ width, route: 'quick-report/selector', geometry: await measure(page, [['选择弹层关闭按钮', '.mobile-select__close', '.mobile-icon', ':scope']]), boxes: await measureIconBoxes(page) })
        await dialog.getByRole('button', { name: '关闭选择' }).click()
      }
      if (route === 'mine/index') {
        await page.getByRole('button', { name: '退出登录', exact: true }).click()
        const actions = page.locator('.mobile-confirm__actions')
        await actions.waitFor()
        records.push({ width, route: 'mine/logout', geometry: await measure(page, [['退出确认按钮文字', '.mobile-confirm__actions .mobile-confirm__button', '#text', ':scope']]) })
        await page.getByRole('button', { name: '取消', exact: true }).click()
      }
    }
    state.taskStatus = 'completed'
    await page.goto('about:blank')
    await page.goto(`${base}#/pages/inspection/detail?id=audit-task`)
    await page.locator('.closed-note').waitFor()
    records.push({ width, route: 'inspection/completed', geometry: await measure(page, [['已结束提示', '.closed-note', '.mobile-icon', ':scope > uni-text', 'first']]) })
    state.unlinked = false
    await page.goto('about:blank')
    await page.goto(`${base}#/pages/quick-report/index`)
    await page.locator('.reporter__verified').waitFor()
    records.push({ width, route: 'quick-report/verified', geometry: await measure(page, [
      ['实名标签', '.reporter__verified', '.mobile-icon', '.mobile-inline-pair__label, :scope > uni-text:last-child'],
      ['位置采集按钮', '.location-field__button', '.mobile-icon', '.mobile-inline-pair__label, :scope > uni-text:last-child']
    ]), boxes: await measureIconBoxes(page) })
    await page.close()
  }
} finally {
  await writeFile(resolve(output, 'alignment.json'), JSON.stringify(records, null, 2))
  await browser.close()
}

const problems = records.flatMap(({ width, route, geometry, nav, status, boxes = [] }) => [
  ...geometry.filter(v => !v.count || v.offset > 1).map(v => ({ width, route, ...v })),
  ...boxes.filter(v => v.x > 1 || v.y > 1 || v.minTarget < 44).map(v => ({ width, route, ...v })),
  ...(nav && (nav.horizontalOffset > 1 || nav.labelOffset > 1) ? [{ width, route, name: '底栏图标和标签', ...nav }] : []),
  ...(status?.offset > 1 ? [{ width, route, name: '状态点', ...status }] : [])
])
console.log(JSON.stringify(problems, null, 2))
console.log(`${records.length} page/state cases, ${records.reduce((sum, row) => sum + row.geometry.reduce((total, item) => total + item.count, 0) + (row.nav?.count || 0) + (row.status?.count || 0), 0)} measured controls and labels, ${records.reduce((sum, row) => sum + (row.boxes || []).reduce((total, item) => total + item.count, 0), 0)} measured icon containers`)
if (problems.length) process.exitCode = 1
