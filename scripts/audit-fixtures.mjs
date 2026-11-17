// Browser-only fixtures: intercepted requests never reach the production database.
import { isAbsolute, relative, resolve } from 'node:path'

export async function installBuiltPages(page, base) {
  if (!process.env.SMIS_AUDIT_BUILD) return
  const root = resolve(process.env.SMIS_AUDIT_BUILD)
  const origin = new URL(base).origin
  await page.route(url => url.origin === origin, async route => {
    const { pathname } = new URL(route.request().url())
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)))
    const path = relative(root, file)
    if (isAbsolute(path) || path.startsWith('..')) return route.fulfill({ status: 404 })
    return route.fulfill({ path: file })
  })
}

export const session = { access_token: 'audit-session', refresh_token: 'audit-refresh', expires_at: 4102444800, user: { id: 'audit-user', email: 'audit@example.com' } }
const date = '2026-10-08T09:00:00+08:00'
const longName = '二号生产车间南侧危险化学品暂存区与设备维修作业现场'
const task = { id: 'audit-task', taskNo: 'RISK-20261008-0001', riskPointName: longName, riskPointNo: 'RP-001', riskPointType: '设备', riskLevelCode: 'B', riskLevelName: '较大风险', riskLevelColor: '#ea8a14', controlLevel: '车间级', responsibleEmployeeId: 'audit-user', responsibleEmployeeName: '张安全', assigneeEmployeeId: 'audit-user', assigneeEmployeeName: '张安全', plannedStartAt: date, plannedEndAt: date, status: 'in_progress', itemCount: 2, completedItemCount: 0, abnormalCount: 0, sourcePlanNo: 'PLAN-001', sourcePlanName: '安全检查', inspectionObject: longName, inspectionTypeName: '日常检查', executorEmployeeName: '张安全' }
const taskDetail = { ...task, attachmentUrls: [], events: [], items: [{ id: 'item-1', inspectionContent: '检查设备防护罩、联锁保护与现场警示标识是否完好，确认通道无遮挡。', result: 'pending', attachmentUrls: [], sort: 1, standardName: '现场安全检查标准' }, { id: 'item-2', inspectionContent: '核查消防器材有效期和危险品隔离措施。', result: 'pending', attachmentUrls: [], sort: 2 }] }
const hazard = { id: 'audit-hazard', hazardNo: 'HZ-20261008-0001', sourceType: 'quick_report', description: `${longName}发现设备防护缺失，需要及时隔离并完善现场安全防护措施。`, location: longName, hazardLevel: 'D', status: 'rectifying', reporterEmployeeName: '张安全', reportedAt: date, imageUrls: [], rectificationDeadline: date, rectificationResponsibleEmployeeName: '李现场', rectificationImageUrls: [], acceptanceImageUrls: [], events: [] }
const equipment = { id: 'audit-equipment', equipmentCode: 'EQ-20261008-000001', equipmentName: '二号生产线全自动联锁保护压力设备', equipmentKind: 'boiler', specification: '额定压力 1.6 MPa', model: 'SMIS-2026-A', manufacturer: '安全设备制造有限公司', detailLocation: longName, useStatus: 'in_use', operationStatus: 'normal', assetStatus: 'active', importanceLevel: 'A', isMajorHazardSource: false, isSpecialEquipment: true, status: '1', attachmentCount: 0, inspectionCount: 2, nextInspectionDueDate: '2026-10-18', category: { categoryName: '压力设备' }, usingOrganization: { organizationName: '生产车间' }, responsible: { employeeName: '张安全' } }
const overview = { total: 1, notStarted: 0, inProgress: 1, overdue: 0, completed: 0, cancelled: 0 }
export async function installFixtures(page, state = { empty: false, failure: false }) {
  const executions = new Map()
  await page.route('**/audit-evidence.svg*', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#e2e8f0"/><path d="M0 330h600v70H0z" fill="#94a3b8"/><path d="M80 330V150l120 70V150l120 70V120h180v210z" fill="#64748b"/><path d="M340 170h110v100H340z" fill="#cbd5e1"/><path d="M120 270h140v20H120z" fill="#fbbf24"/></svg>' }))
  await page.route(url => ['smis-audit.invalid', 'ckbftoopuyophiebamwy.supabase.co'].includes(url.hostname) || url.origin === process.env.SMIS_AUDIT_API_ORIGIN, async route => {
    const path = new URL(route.request().url()).pathname
    if (path.includes('/storage/v1/object/public/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#94a3b8"/></svg>' })
    if (path.includes('/storage/v1/object/attachments/')) {
      if (state.uploadFailure) return route.fulfill({ status: 503, json: { message: '照片上传失败，请重试' } })
      return route.fulfill({ status: 200, json: {} })
    }
    const params = route.request().postDataJSON() || {}
    const dense = state.dense
    const pageUrl = page.url()
    const photoOrigin = /^https?:\/\//.test(pageUrl) ? pageUrl : route.request().headers().referer || route.request().url()
    const photo = new URL('/audit-evidence.svg', photoOrigin).href
    const count = state.empty ? 0 : dense ? state.denseCount || 12 : 1
    const records = (source, size = count) => {
      if (state.empty) return []
      const all = Array.from({ length: size }, (_, index) => ({ ...source, id: `${source.id}-${index}`, plannedEndAt: `2026-10-${String(8 - index % 3).padStart(2, '0')}T09:00:00+08:00`, status: params.p_status || source.status }))
      if (state.overlapListPages && params.p_from === 15) return all.slice(14, 29)
      if (state.overlapListPages && params.p_from === 30) return []
      return all.slice(params.p_from || 0, (params.p_to ?? all.length - 1) + 1)
    }
    if (state.failure && path.includes('/rpc/')) return route.fulfill({ status: 503, json: { message: '网络连接异常，请稍后重试' } })
    if (state.mutationDelay && /smis_(save|submit|rectify|accept)_/.test(path)) {
      await new Promise(resolve => setTimeout(resolve, state.mutationDelay))
    }
    if (state.rejectReport && path.includes('smis_submit_hazard_source_report')) {
      return route.fulfill({ status: 503, json: { message: '网络连接异常，请稍后重试' } })
    }
    if (state.listNextPageFailure && params.p_from === 15 && /smis_list_(risk_inspection|hidden_hazard_inspection|hidden_hazard_governance)/.test(path)) {
      return route.fulfill({ status: 503, json: { message: '网络连接异常，请稍后重试' } })
    }
    if (state.delayMessagePage && Number(params.p_from) > 0 && (path.includes('smis_list_risk_inspection') || path.includes('smis_list_hidden_hazard_governance'))) {
      await new Promise(resolve => setTimeout(resolve, 650))
    }
    if (state.delayedStatus && params.p_status === state.delayedStatus) await state.statusResponseGate
    let data = []
    if (path.includes('/auth/v1/token')) data = session
    else if (path.includes('smis_get_hazard_reporting_options_secure')) data = { profile: { employeeId: 'audit-user', employeeNo: 'EMP-2026-001', employeeName: '张安全', phone: '13800000000', organizationId: 'org-1', organizationName: '安全生产管理中心与二号生产车间', isEmployeeLinked: !state.unlinked }, organizations: [{ id: 'org-1', organizationName: '安全生产管理中心', sort: 1 }], sites: state.noSites ? [] : [{ id: 'site-1', siteName: longName, organizationId: 'org-1', sort: 1 }] }
    else if (path.includes('smis_get_employee_shift_calendar')) {
      const month = params.p_month.slice(0, 7)
      if (state.delayShiftMonth === month) await new Promise(resolve => setTimeout(resolve, 650))
      data = { assignments: state.empty ? [] : [
        { id: 'shift-1', workDate: `${month}-28`, shiftName: state.shiftByMonth ? `${month} 白班` : '生产车间白班', shiftType: '白班', startTime: '08:00:00', endTime: '17:00:00', assignmentStatus: 'scheduled', crossDay: false },
        { id: 'shift-2', workDate: `${month}-28`, shiftName: '二号车间设备联锁夜间巡检及节假日值班', shiftType: '夜班', startTime: '20:00:00', endTime: '05:00:00', assignmentStatus: 'worked', crossDay: true }
      ] }
    } else if (path.includes('smis_list_equipment')) {
      const term = params.p_keyword || ''
      if (state.delayEquipmentKeyword === term) await state.equipmentResponseGate
      if (state.equipmentPageFailure && Number(params.p_from) > 0) return route.fulfill({ status: 503, json: { message: '网络连接异常，请稍后重试' } })
      const size = state.empty ? 0 : state.equipmentCount || count
      const example = state.equipmentCount ? { ...equipment, equipmentName: term ? `设备档案：${term}` : equipment.equipmentName, model: 'SMIS2026'.repeat(9) } : equipment
      data = { records: records(example, size), total: size, overview: { total: size, inUse: size, boilerCount: 1, dueSoon: 1 } }
    }
    else if (path.includes('smis_get_equipment')) data = state.empty ? null : { ...equipment, photoUrl: dense ? photo : '', nameplateUrl: dense ? photo : '' }
    else if (path.includes('smis_list_hidden_hazard_governance')) data = { records: records(hazard), total: count, overview: { total: 1, pendingApproval: 0, rectifying: 1, pendingAcceptance: 0, completed: 0, closed: 0 } }
    else if (path.includes('smis_get_hidden_hazard_governance')) data = state.empty ? null : { ...hazard, status: state.hazardStatus || hazard.status, imageUrls: dense ? [photo] : [], events: dense ? [{ id: 'event-1', eventTitle: '现场隐患已上报并指定整改责任人', eventAt: date, eventContent: '已完成现场初步隔离，安排设备负责人处理并补充整改证据。', operatorEmployeeName: '张安全' }, { id: 'event-2', eventTitle: '隐患核准', eventAt: date, eventContent: '现场复核已完成，按计划落实整改。' }] : [] }
    else if (path.includes('smis_submit_hazard_source_report')) {
      state.hazardStatus = 'pending_approval'
      data = { id: hazard.id, hazardNo: hazard.hazardNo }
    } else if (path.includes('smis_rectify_hidden_hazard_governance')) state.hazardStatus = 'pending_acceptance'
    else if (path.includes('smis_accept_hidden_hazard_governance')) state.hazardStatus = params.p_payload.result === 'passed' ? 'completed' : 'rectifying'
    else if (path.includes('smis_save_risk_inspection_execution') || path.includes('smis_save_hidden_hazard_inspection_execution')) {
      const kind = path.includes('risk') ? 'risk' : 'inspection'
      executions.set(`${kind}:${params.p_id}`, {
        status: params.p_complete ? 'completed' : 'in_progress',
        executionSummary: params.p_execution_summary ?? params.p_payload?.execution_summary ?? '',
        items: taskDetail.items.map((item, index) => ({ ...item, ...params.p_items[index] }))
      })
    }
    else if (path.includes('smis_list_')) data = { records: records(task), total: count, overview: { ...overview, total: count, inProgress: count } }
    else if (path.includes('smis_get_')) {
      const kind = path.includes('risk') ? 'risk' : 'inspection'
      data = state.empty ? null : { ...taskDetail, status: state.taskStatus || taskDetail.status, ...executions.get(`${kind}:${params.p_id}`) }
    }
    await route.fulfill({ status: 200, json: data })
  })
}
export async function seedSession(page) {
  await page.evaluate(value => localStorage.setItem('smis-mobile-session', JSON.stringify({ type: 'string', data: JSON.stringify(value) })), session)
}
