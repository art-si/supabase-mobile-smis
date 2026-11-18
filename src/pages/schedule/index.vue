<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'
import MobileStatusTag from '@mobile-core/components/MobileStatusTag.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { activateActionKey, preventActionKey } from '@mobile-core/action-keyboard'
import { revealControl } from '@mobile-core/form-focus'
import { CALENDAR_WEEKDAYS, monthDayNumbers } from '@mobile-core/month-calendar'
import { usePageTheme } from '@/composables/usePageTheme'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { getShiftCalendar } from '@/api/smis'
import type { ShiftAssignment } from '@/api/types'
import { currentMonth, monthLabel } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

const shiftStates = {
  scheduled: { label: '已排班', marker: '排', tone: 'blue' },
  worked: { label: '已出勤', marker: '勤', tone: 'green' },
  leave: { label: '休假', marker: '休', tone: 'orange' },
  cancelled: { label: '已取消', marker: '停', tone: 'gray' }
} as const

const { themeName } = usePageTheme()
const auth = useAuthStore()
const profile = useProfileStore()
const today = ref(new Date())
const todayMonth = computed(() => currentMonth(today.value))
const month = ref(todayMonth.value)
const loadedMonth = ref('')
const rows = ref<ShiftAssignment[]>([])
const selectedDay = ref(0)
const loading = ref(true)
const loadError = ref('')
const missingEmployee = ref(false)
let loadSequence = 0

const period = computed(() => {
  const [year = today.value.getFullYear(), monthNumber = today.value.getMonth() + 1] = month.value.split('-').map(Number)
  return { year, monthNumber }
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

const calendarCells = computed(() => {
  const { year, monthNumber } = period.value
  return monthDayNumbers(year, monthNumber - 1).map(day => {
    const shifts = byDay.value.get(day) || []
    const first = shifts[0]
    return {
      day,
      isToday: month.value === todayMonth.value && day === today.value.getDate(),
      marker: shifts.length > 1 ? `${shifts.length} 班` : first ? shiftStates[first.assignmentStatus]?.marker || '·' : '',
      label: `${monthNumber}月${day}日，${shifts.length} 班，查看当日班次`
    }
  })
})
const visibleShifts = computed(() => selectedDay.value ? byDay.value.get(selectedDay.value) || [] : assignments.value)
const listTitle = computed(() => selectedDay.value ? `${period.value.monthNumber}月${selectedDay.value}日班次` : '本月班次')

function showShifts(day: number) {
  selectedDay.value = day
  void revealControl('schedule-shifts')
}

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
      selectedDay.value = 0
      return
    }
    const data = await getShiftCalendar(auth.token, employeeId, requestedMonth)
    if (sequence !== loadSequence) return
    rows.value = (data?.assignments || [])
      .filter(shift => shift.workDate?.startsWith(`${requestedMonth}-`))
      .sort((left, right) => left.workDate.localeCompare(right.workDate) || (left.startTime || '').localeCompare(right.startTime || ''))
    loadedMonth.value = requestedMonth
    if (!byDay.value.has(selectedDay.value)) selectedDay.value = 0
  } catch (error) {
    if (sequence === loadSequence) loadError.value = getErrorMessage(error)
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function changeMonth(delta: number) {
  const { year, monthNumber } = period.value
  openMonth(currentMonth(new Date(year, monthNumber - 1 + delta, 1)))
}

function openMonth(next: string) {
  if (next === month.value) return
  selectedDay.value = 0
  month.value = next
  void load()
}

function returnToCurrentMonth() {
  openMonth(todayMonth.value)
  void revealControl('schedule-month')
}

onShow(() => {
  today.value = new Date()
  return load()
})
</script>

<template>
  <wd-config-provider :theme="themeName">
    <MobileWorkspace container-class="page-shell">
      <MobileTopBar capsule="always" title="我的排班" subtitle="班次与休假安排" show-back />
      <view class="page-body schedule-body" role="main">
        <view class="calendar surface-card" :aria-busy="loading">
          <view class="calendar__head">
            <MobileAction variant="icon" class="month-action" aria-label="上个月" @click="changeMonth(-1)">
              <view class="month-action__back"><MobileIcon name="chevron" size="18px" /></view>
            </MobileAction>
            <view class="calendar__heading">
              <text id="schedule-month" role="heading" aria-level="2" aria-live="polite" tabindex="-1">{{ monthLabel(month) }}</text>
              <text v-if="profile.profile?.employeeName" class="calendar__employee">{{ profile.profile.employeeName }}</text>
            </view>
            <MobileAction variant="icon" class="month-action" aria-label="下个月" @click="changeMonth(1)"><MobileIcon name="chevron" size="18px" /></MobileAction>
          </view>
          <view v-if="month !== todayMonth" class="calendar__reset">
            <MobileAction variant="link" @click="returnToCurrentMonth">回到本月</MobileAction>
          </view>
          <view class="week" aria-hidden="true"><text v-for="day in CALENDAR_WEEKDAYS" :key="day">{{ day }}</text></view>
          <view class="days" role="group" :aria-label="`${monthLabel(month)}排班`">
            <template v-for="(cell, index) in calendarCells" :key="index">
              <button v-if="cell.marker" class="mobile-action day day--action" role="button" tabindex="0"
                :aria-label="cell.label" :aria-pressed="cell.day === selectedDay" :aria-current="cell.isToday ? 'date' : undefined"
                hover-class="mobile-action--pressed" @click="showShifts(cell.day)" @keydown="preventActionKey"
                @keyup="activateActionKey($event, () => showShifts(cell.day))"
              >
                <text class="day__number" :class="{ 'day__number--today': cell.isToday, 'day__number--selected': cell.day === selectedDay }">{{ cell.day }}</text>
                <text class="day__mark" aria-hidden="true">{{ cell.marker }}</text>
              </button>
              <view v-else class="day" :aria-hidden="!cell.day || undefined" :aria-current="cell.isToday ? 'date' : undefined">
                <text v-if="cell.day" class="day__number" :class="{ 'day__number--today': cell.isToday }">{{ cell.day }}</text>
              </view>
            </template>
          </view>
          <view class="calendar__legend">
            <text v-if="assignments.length" class="calendar__hint">点有标记的日期查看班次</text>
            <text v-for="state in shiftStates" :key="state.marker">{{ state.marker }} · {{ state.label }}</text>
          </view>
        </view>

        <view class="schedule-details">
          <view class="section-head">
            <text id="schedule-shifts" class="section-title" tabindex="-1" role="heading" aria-level="2">{{ listTitle }}</text>
            <text v-if="visibleShifts.length" class="schedule-count">{{ visibleShifts.length }} 条</text>
            <MobileAction v-if="selectedDay" variant="link" @click="showShifts(0)">查看整月</MobileAction>
          </view>
          <MobileLoadError v-if="loadError" :message="loadError" @retry="load" />
          <view v-if="loading" class="loading" role="status"><wd-loading color="var(--smis-primary)" /><text>正在读取班次…</text></view>
          <view v-if="visibleShifts.length" class="shift-list">
            <view v-for="item in visibleShifts" :key="item.id" class="shift surface-card">
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
    </MobileWorkspace>
  </wd-config-provider>
</template>

<style scoped lang="scss">
@use '@mobile-core/styles/calendar';

.page-body.schedule-body { padding-inline: var(--mobile-safe-left) var(--mobile-safe-right); }
.schedule-details { padding-inline: var(--mobile-workspace-inset); }
.calendar {
  // Keep seven targets of at least 44px while retaining the normal side inset where it fits.
  margin-inline: clamp(4px, calc((100% - 310px) / 2), var(--mobile-workspace-inset));
  padding-block: 12px;
}
.calendar__head, .calendar__legend { padding-inline: 12px; }
.calendar__head { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px; align-items: center; gap: 8px; }
.month-action.mobile-action { border-radius: 12px; background: var(--smis-surface-muted); color: var(--smis-text-strong); }
.month-action__back { display: flex; transform: rotate(180deg); }
.calendar__heading { min-width: 0; display: grid; gap: 4px; text-align: center; overflow-wrap: anywhere; font-size: max(17px, 1.05rem); font-weight: 700; }
.calendar__employee { color: var(--smis-muted); font-size: max(13px, .8125rem); font-weight: 500; }
.calendar__reset { display: flex; justify-content: center; margin-top: 4px; }
.week, .days {
  @include calendar.month-grid;
  margin-inline: clamp(0px, calc((100% - 308px) / 2), 12px);
}
.week { margin-top: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--smis-line-subtle); color: var(--smis-muted); font-size: max(13px, .8125rem); }
.days { margin-top: 4px; row-gap: 2px; }
.day {
  box-sizing: border-box;
  display: grid;
  align-content: start;
  justify-items: center;
  min-width: 0;
  min-height: 50px;
  padding: 4px 0;
  color: var(--smis-text-strong);
  font-size: max(14px, .875rem);
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
}
.day--action.mobile-action { width: 100%; border-radius: 10px; text-align: center; }
.day--action:focus-visible { outline-offset: -2px; }
.day__number {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: min(100%, max(27px, 1.65em));
  min-height: max(27px, 1.65em);
  border: 1px solid transparent;
  border-radius: 999px;
}
.day--action .day__number { color: var(--smis-primary-strong); font-weight: 700; }
.day--action:active .day__number:not(.day__number--selected),
.day--action.mobile-action--pressed .day__number:not(.day__number--selected) { background: var(--smis-primary-soft); }
.day__number--today { border-color: var(--smis-primary-strong); font-weight: 700; }
.day--action .day__number--selected { color: #fff; background: var(--smis-primary-strong); }
.day__mark {
  display: block;
  max-width: 100%;
  margin-top: 2px;
  color: var(--smis-primary-strong);
  font-size: max(12px, .75rem);
  font-weight: 650;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.calendar__legend { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--smis-line-subtle); color: var(--smis-muted); font-size: max(12px, .75rem); }
.calendar__hint { flex-basis: 100%; color: var(--smis-text-strong); font-size: max(13px, .8125rem); line-height: 1.45; }
.section-head { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin: 24px 0 12px; }
.section-head .section-title { flex: 1 1 auto; min-width: 0; font-size: max(16px, 1rem); overflow-wrap: anywhere; }
#schedule-shifts:focus-visible, #schedule-month:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--smis-primary-strong);
  outline-offset: 2px;
}
.schedule-count { color: var(--smis-muted); font-size: max(13px, .8125rem); white-space: nowrap; }
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
