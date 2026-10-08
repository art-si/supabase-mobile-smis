// Browser-only fixtures: intercepted requests never reach the production database.
export const session = { access_token: 'audit-session', refresh_token: 'audit-refresh', expires_at: 4102444800, user: { id: 'audit-user', email: 'audit@example.com' } }
const date = '2026-10-08T09:00:00+08:00'
const longName = '二号生产车间南侧危险化学品暂存区与设备维修作业现场'
const task = { id: 'audit-task', taskNo: 'RISK-20261008-0001', riskPointName: longName, riskPointNo: 'RP-001', riskPointType: '设备', riskLevelCode: 'B', riskLevelName: '较大风险', riskLevelColor: '#ea8a14', controlLevel: '车间级', responsibleEmployeeId: 'audit-user', responsibleEmployeeName: '张安全', assigneeEmployeeId: 'audit-user', assigneeEmployeeName: '张安全', plannedStartAt: date, plannedEndAt: date, status: 'in_progress', itemCount: 2, completedItemCount: 0, abnormalCount: 0, sourcePlanNo: 'PLAN-001', sourcePlanName: '安全检查', inspectionObject: longName, inspectionTypeName: '日常检查', executorEmployeeName: '张安全' }
const taskDetail = { ...task, attachmentUrls: [], events: [], items: [{ id: 'item-1', inspectionContent: '检查设备防护罩、联锁保护与现场警示标识是否完好，确认通道无遮挡。', result: 'pending', attachmentUrls: [], sort: 1, standardName: '现场安全检查标准' }, { id: 'item-2', inspectionContent: '核查消防器材有效期和危险品隔离措施。', result: 'pending', attachmentUrls: [], sort: 2 }] }
const hazard = { id: 'audit-hazard', hazardNo: 'HZ-20261008-0001', sourceType: 'quick_report', description: `${longName}发现设备防护缺失，需要及时隔离并完善现场安全防护措施。`, location: longName, hazardLevel: 'D', status: 'rectifying', reporterEmployeeName: '张安全', reportedAt: date, imageUrls: [], rectificationDeadline: date, rectificationResponsibleEmployeeName: '李现场', rectificationImageUrls: [], acceptanceImageUrls: [], events: [] }
const equipment = { id: 'audit-equipment', equipmentCode: 'EQ-20261008-000001', equipmentName: '二号生产线全自动联锁保护压力设备', equipmentKind: 'boiler', specification: '额定压力 1.6 MPa', model: 'SMIS-2026-A', manufacturer: '安全设备制造有限公司', detailLocation: longName, useStatus: 'in_use', operationStatus: 'normal', assetStatus: 'active', importanceLevel: 'A', isMajorHazardSource: false, isSpecialEquipment: true, status: '1', attachmentCount: 0, inspectionCount: 2, nextInspectionDueDate: '2026-10-18', category: { categoryName: '压力设备' }, usingOrganization: { organizationName: '生产车间' }, responsible: { employeeName: '张安全' } }
const overview = { total: 1, notStarted: 0, inProgress: 1, overdue: 0, completed: 0, cancelled: 0 }
export async function installFixtures(page, state = { empty: false, failure: false }) {
  await page.route('**/audit-evidence.svg*', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#e2e8f0"/><path d="M0 330h600v70H0z" fill="#94a3b8"/><path d="M80 330V150l120 70V150l120 70V120h180v210z" fill="#64748b"/><path d="M340 170h110v100H340z" fill="#cbd5e1"/><path d="M120 270h140v20H120z" fill="#fbbf24"/></svg>' }))
  await page.route('https://ckbftoopuyophiebamwy.supabase.co/**', async route => {
    const path = new URL(route.request().url()).pathname
    const params = route.request().postDataJSON() || {}
    const dense = state.dense
    const photo = 'http://127.0.0.1:5173/audit-evidence.svg'
    const records = (source) => {
      if (state.empty) return []
      const all = Array.from({ length: dense ? 12 : 1 }, (_, index) => ({ ...source, id: `${source.id}-${index}`, plannedEndAt: `2026-10-${String(8 - index % 3).padStart(2, '0')}T09:00:00+08:00`, status: params.p_status || source.status }))
      return all.slice(params.p_from || 0, (params.p_to ?? all.length - 1) + 1)
    }
    const count = state.empty ? 0 : dense ? 12 : 1
    if (state.failure && path.includes('/rpc/')) return route.fulfill({ status: 503, json: { message: '网络连接异常，请稍后重试' } })
    let data = []
    if (path.includes('/auth/v1/token')) data = session
    else if (path.includes('smis_get_hazard_reporting_options_secure')) data = { profile: { employeeId: 'audit-user', employeeNo: 'EMP-2026-001', employeeName: '张安全', phone: '13800000000', organizationId: 'org-1', organizationName: '安全生产管理中心与二号生产车间', isEmployeeLinked: true }, organizations: [{ id: 'org-1', organizationName: '安全生产管理中心', sort: 1 }], sites: [{ id: 'site-1', siteName: longName, organizationId: 'org-1', sort: 1 }] }
    else if (path.includes('smis_get_employee_shift_calendar')) data = { assignments: state.empty ? [] : [{ id: 'shift-1', workDate: '2026-10-28', shiftName: '生产车间白班', shiftType: '白班', startTime: '08:00:00', endTime: '17:00:00', assignmentStatus: 'scheduled', crossDay: false }] }
    else if (path.includes('smis_list_equipment')) data = { records: records(equipment), total: count, overview: { total: 1, inUse: 1, boilerCount: 1, dueSoon: 1 } }
    else if (path.includes('smis_get_equipment')) data = state.empty ? null : { ...equipment, photoUrl: dense ? photo : '', nameplateUrl: dense ? photo : '' }
    else if (path.includes('smis_list_hidden_hazard_governance')) data = { records: records(hazard), total: count, overview: { total: 1, pendingApproval: 0, rectifying: 1, pendingAcceptance: 0, completed: 0, closed: 0 } }
    else if (path.includes('smis_get_hidden_hazard_governance')) data = state.empty ? null : { ...hazard, imageUrls: dense ? [photo] : [], events: dense ? [{ id: 'event-1', eventTitle: '现场隐患已上报并指定整改责任人', eventAt: date, eventContent: '已完成现场初步隔离，安排设备负责人处理并补充整改证据。', operatorEmployeeName: '张安全' }, { id: 'event-2', eventTitle: '隐患核准', eventAt: date, eventContent: '现场复核已完成，按计划落实整改。' }] : [] }
    else if (path.includes('smis_list_')) data = { records: records(task), total: count, overview: { ...overview, total: count, inProgress: count } }
    else if (path.includes('smis_get_')) data = state.empty ? null : taskDetail
    await route.fulfill({ status: 200, json: data })
  })
}
export async function seedSession(page) {
  await page.evaluate(value => localStorage.setItem('smis-mobile-session', JSON.stringify({ type: 'string', data: JSON.stringify(value) })), session)
}
