export const STATUS_LABEL: Record<string, string> = {
  not_started: '待执行', in_progress: '执行中', overdue: '已逾期', completed: '已完成', cancelled: '已取消',
  pending_approval: '待核准', rectifying: '整改中', pending_acceptance: '待验收', closed: '已关闭',
  normal: '正常', abnormal: '异常', pending: '待检查', in_use: '在用', stopped: '停用', scrapped: '报废',
  maintenance: '检修中', fault: '故障', idle: '闲置', active: '有效', enabled: '启用', disabled: '停用'
}

export function formatDate(value?: string | null, withTime = false) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', withTime ? {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  } : { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).replace(/\//g, '-')
}

export function currentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(value: string) {
  const [year, month] = value.split('-')
  return `${year}年${Number(month)}月`
}

export function hazardLevelBadge(value?: string | null) {
  if (!value) return '--'
  const normalized = String(value).trim()
  const level = normalized.match(/(?:^|_)([a-d])(?:_|$)/i)?.[1]
    ?? normalized.match(/^([a-d])(?:级)?$/i)?.[1]
  return level ? level.toUpperCase() : normalized.slice(0, 2)
}
