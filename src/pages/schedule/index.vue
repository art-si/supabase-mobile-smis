<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'
import MobileStatusTag from '@mobile-core/components/MobileStatusTag.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import { usePageTheme } from '@/composables/usePageTheme'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { getShiftCalendar } from '@/api/smis'
import type { ShiftAssignment } from '@/api/types'
import { currentMonth, monthLabel } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const shiftStates = {
  scheduled: { label: '已排班', marker: '排', tone: 'blue' },
  worked: { label: '已出勤', marker: '勤', tone: 'green' },
  leave: { label: '休假', marker: '休', tone: 'orange' },
  cancelled: { label: '已取消', marker: '停', tone: 'gray' }
} as const

const { themeName } = usePageTheme()
const auth = useAuthStore()
const profile = useProfileStore()
const month = ref(currentMonth())
const loadedMonth = ref('')
const rows = ref<ShiftAssignment[]>([])
const loading = ref(true)
const loadError = ref('')
const missingEmployee = ref(false)
let loadSequence = 0

const days = computed(() => {
  const [year = new Date().getFullYear(), monthNumber = 1] = month.value.split('-').map(Number)
  const firstWeekday = new Date(year, monthNumber - 1, 1).getDay()
  const length = new Date(year, monthNumber, 0).getDate()
  return [
    ...Array.from({ length: firstWeekday }, () => 0),
    ...Array.from({ length }, (_, index) => index + 1)
  ]
})
const assignments = computed(() => loadedMonth.value === month.value ? rows.value : [])
const byDay = computed(() => {
  const grouped = new Map<number, ShiftAssignment[]>()
  for (const shift of assignments.value) {
    const day = Number(shift.workDate.slice(-2))
    const shifts = grouped.get(day) || []
    shifts.push(shift)
    grouped.set(day, shifts)
  }
  return grouped
})

const calendarCells = computed(() => days.value.map(day => {
  const shifts = byDay.value.get(day) || []
  const first = shifts[0]
  return {
    day,
    marker: shifts.length > 1 ? `${shifts.length} 班` : first ? shiftStates[first.assignmentStatus]?.marker || '·' : '',
    label: `${day}日${shifts.map(shift => `，${shift.shiftName || '班次'}（${shiftStates[shift.assignmentStatus]?.label || '状态未知'}）`).join('')}`
  }
}))

function shortTime(value?: string) { return value?.slice(0, 5) || '未录入' }

async function load() {
  const sequence = ++loadSequence
  const requestedMonth = month.value
  loading.value = true
  loadError.value = ''
  missingEmployee.value = false
  try {
    if (!(await auth.ensureValidSession()) || sequence !== loadSequence) return
    await profile.load(auth.token)
    if (sequence !== loadSequence) return
    const employeeId = profile.profile?.employeeId
    if (!employeeId) {
      missingEmployee.value = true
      rows.value = []
      loadedMonth.value = requestedMonth
      return
    }
    const data = await getShiftCalendar(auth.token, employeeId, requestedMonth)
    if (sequence !== loadSequence) return
    rows.value = (data?.assignments || [])
      .filter(shift => shift.workDate?.startsWith(`${requestedMonth}-`))
      .sort((left, right) => left.workDate.localeCompare(right.workDate) || (left.startTime || '').localeCompare(right.startTime || ''))
    loadedMonth.value = requestedMonth
  } catch (error) {
    if (sequence === loadSequence) loadError.value = getErrorMessage(error)
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function changeMonth(delta: number) {
  const [year = new Date().getFullYear(), monthNumber = 1] = month.value.split('-').map(Number)
  const date = new Date(year, monthNumber - 1 + delta, 1)
  month.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  void load()
}

onShow(load)
</script>

<template>
  <wd-config-provider :theme="themeName">
    <view class="page-shell">
      <MobileTopBar capsule="always" title="我的排班" subtitle="班次与休假安排" show-back />
      <view class="page-body schedule-body" role="main">
        <view class="calendar surface-card" :aria-busy="loading">
          <view class="calendar__head">
            <MobileAction variant="icon" class="month-action" aria-label="上个月" @click="changeMonth(-1)"><MobileIcon name="back" size="18px" /></MobileAction>
            <view class="calendar__heading">
              <text role="heading" aria-level="2" aria-live="polite">{{ monthLabel(month) }}</text>
              <text v-if="profile.profile?.employeeName" class="calendar__employee">{{ profile.profile.employeeName }}</text>
            </view>
            <MobileAction variant="icon" class="month-action" aria-label="下个月" @click="changeMonth(1)"><MobileIcon name="arrow-right" size="18px" /></MobileAction>
          </view>
          <view class="week" aria-hidden="true"><text v-for="day in WEEKDAYS" :key="day">{{ day }}</text></view>
          <view class="days" role="group" :aria-label="`${monthLabel(month)}排班`">
            <view v-for="(cell, index) in calendarCells" :key="index" class="day" :aria-hidden="!cell.day || undefined">
              <template v-if="cell.day">
                <text :aria-label="cell.label">{{ cell.day }}</text>
                <text v-if="cell.marker" class="day__mark" aria-hidden="true">{{ cell.marker }}</text>
              </template>
            </view>
          </view>
          <view class="calendar__legend">
            <text v-for="state in shiftStates" :key="state.marker">{{ state.marker }} · {{ state.label }}</text>
          </view>
        </view>

        <view class="section-head">
          <text class="section-title" role="heading" aria-level="2">本月班次</text>
          <text v-if="assignments.length" class="schedule-count">{{ assignments.length }} 条</text>
        </view>
        <MobileLoadError v-if="loadError" :message="loadError" @retry="load" />
        <view v-if="loading" class="loading" role="status"><wd-loading color="var(--smis-primary)" /><text>正在读取班次…</text></view>
        <view v-if="assignments.length" class="shift-list">
          <view v-for="item in assignments" :key="item.id" class="shift surface-card">
            <view class="shift__date" :aria-label="`${Number(item.workDate.slice(5, 7))}月${Number(item.workDate.slice(-2))}日`">
              <text>{{ Number(item.workDate.slice(-2)) }}</text>
              <text>{{ Number(item.workDate.slice(5, 7)) }}月</text>
            </view>
            <view class="shift__copy">
              <view class="shift__heading">
                <text class="shift__name">{{ item.shiftName || '未命名班次' }}</text>
                <MobileStatusTag :label="shiftStates[item.assignmentStatus]?.label || '状态未知'" :tone="shiftStates[item.assignmentStatus]?.tone || 'gray'" hide-dot />
              </view>
              <text v-if="item.assignmentStatus !== 'leave'" class="shift__detail">{{ shortTime(item.startTime) }}–{{ shortTime(item.endTime) }}{{ item.crossDay ? ' · 次日结束' : '' }}</text>
              <text v-if="item.remark" class="shift__detail">{{ item.remark }}</text>
            </view>
          </view>
        </view>
        <MobileEmptyState v-else-if="!loading && !loadError" icon="schedule"
          :title="missingEmployee ? '暂时无法查看排班' : '所选月份暂无排班'"
          :description="missingEmployee ? '请联系管理员关联员工档案' : '排班发布后会同步到这里，也可以切换月份查询'" />
      </view>
    </view>
  </wd-config-provider>
</template>

<style scoped lang="scss">
.schedule-body { padding-bottom: calc(24px + var(--mobile-safe-bottom)); }
.calendar { padding: clamp(12px, 4vw, 20px); }
.calendar__head { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: center; gap: 8px; }
.month-action.mobile-action { border-radius: 12px; background: var(--smis-surface-muted); color: var(--smis-text-strong); }
.calendar__heading { min-width: 0; display: grid; gap: 4px; text-align: center; overflow-wrap: anywhere; font-size: max(17px, 1.05rem); font-weight: 700; }
.calendar__employee { color: var(--smis-muted); font-size: max(13px, .8125rem); font-weight: 500; }
.week, .days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; text-align: center; }
.week { margin-top: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--smis-line-subtle); color: var(--smis-muted); font-size: max(13px, .8125rem); }
.days { margin-top: 4px; }
.day { min-width: 0; min-height: 42px; padding: 6px 0 4px; display: grid; align-content: start; justify-items: center; color: var(--smis-text-strong); font-size: max(14px, .875rem); line-height: 1.25; font-variant-numeric: tabular-nums; }
.day__mark { display: block; margin-top: 2px; color: var(--smis-primary-strong); font-size: max(12px, .75rem); font-weight: 650; line-height: 1.25; }
.calendar__legend { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--smis-line-subtle); color: var(--smis-muted); font-size: max(12px, .75rem); }
.section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin: 24px 0 12px; }
.schedule-count { color: var(--smis-muted); font-size: max(13px, .8125rem); }
.loading { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 58px; color: var(--smis-muted); font-size: max(14px, .875rem); }
.shift-list { display: grid; gap: 10px; }
.shift { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 12px; padding: 12px; }
.shift__date { display: grid; place-content: center; align-self: start; gap: 2px; min-height: 48px; border-radius: 12px; text-align: center; color: var(--smis-text-strong); background: var(--smis-surface-muted); font-size: max(16px, 1rem); font-weight: 700; font-variant-numeric: tabular-nums; }
.shift__date text + text { font-size: max(12px, .75rem); color: var(--smis-muted); font-weight: 550; }
.shift__copy { min-width: 0; display: grid; gap: 4px; overflow-wrap: anywhere; }
.shift__heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
.shift__name { font-size: max(15px, .9375rem); color: var(--smis-text-strong); font-weight: 700; }
.shift__detail { font-size: max(13px, .8125rem); color: var(--smis-muted); line-height: 1.5; }
</style>
