<script setup lang="ts">
import SmisLoadError from '@/components/business/SmisLoadError.vue'
import { usePageTheme } from '@/composables/usePageTheme'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SmisTopBar from '@/components/business/SmisTopBar.vue'
import SmisIcon from '@/components/business/SmisIcon.vue'
import SmisEmpty from '@/components/business/SmisEmpty.vue'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { getShiftCalendar } from '@/api/smis'
import type { ShiftAssignment } from '@/api/types'
import { currentMonth, monthLabel } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

const { themeName } = usePageTheme()
const loadError = ref('')
let loadSequence = 0
const auth=useAuthStore();const profile=useProfileStore();const month=ref(currentMonth());const rows=ref<ShiftAssignment[]>([]);const loading=ref(false)
const days=computed(()=>{const parts=month.value.split('-').map(Number);const y=parts[0]||new Date().getFullYear();const m=parts[1]||1;const count=new Date(y,m,0).getDate();const first=new Date(y,m-1,1).getDay();return [...Array(first).fill(null),...Array.from({length:count},(_,i)=>i+1)]})
const rowMap=computed(()=>Object.fromEntries(rows.value.map(x=>[Number(x.workDate.slice(-2)),x])))
const upcoming=computed(()=>rows.value.filter(x=>new Date(`${x.workDate}T23:59:59`)>=new Date()).slice(0,4))
async function load() {
  if (!(await auth.ensureValidSession())) return
  const sequence = ++loadSequence
  const requestedMonth = month.value
  loading.value = true
  loadError.value = ''
  try {
    await profile.load(auth.token)
    if (!profile.profile?.employeeId) { rows.value = []; return }
    const data = await getShiftCalendar(auth.token, profile.profile.employeeId, requestedMonth)
    if (sequence === loadSequence) rows.value = data?.assignments || []
  } catch (error) {
    if (sequence === loadSequence) loadError.value = getErrorMessage(error)
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function changeMonth(delta:number){const parts=month.value.split('-').map(Number);const y=parts[0]||new Date().getFullYear();const m=parts[1]||1;const d=new Date(y,m-1+delta,1);month.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;load()}
onShow(load)
</script>
<template>
<wd-config-provider :theme="themeName"><view class="page-shell"><SmisTopBar title="我的排班" eyebrow="SHIFT CALENDAR" subtitle="班次、休假与跨日安排" show-back/><view class="page-body schedule-body"><SmisLoadError v-if="loadError" :message="loadError" @retry="load"/><view class="calendar surface-card"><view class="calendar__head"><button aria-label="上个月" @tap="changeMonth(-1)"><SmisIcon name="back" size="32rpx"/></button><view><text>{{monthLabel(month)}}</text><text class="small">{{profile.profile?.employeeName||'当前员工'}}</text></view><button aria-label="下个月" @tap="changeMonth(1)"><SmisIcon name="chevron" size="32rpx"/></button></view><view class="week"><text v-for="x in ['日','一','二','三','四','五','六']" :key="x">{{x}}</text></view><view class="days"><view v-for="(day,index) in days" :key="`${day}-${index}`" class="day" :aria-label="day ? `${day}日${rowMap[day] ? '，' + rowMap[day].shiftName : ''}` : undefined" :class="{'day--empty':!day,'day--shift':day&&rowMap[day],'day--leave':day&&rowMap[day]?.assignmentStatus==='leave','day--worked':day&&rowMap[day]?.assignmentStatus==='worked'}"><text v-if="day">{{day}}</text><text class="small" v-if="day&&rowMap[day]">{{rowMap[day].shiftName.slice(0,3)}}</text></view></view><view class="legend" aria-label="排班状态图例"><view class="legend__item"><view class="legend__dot scheduled" /><text>排班</text></view><view class="legend__item"><view class="legend__dot worked" /><text>已出勤</text></view><view class="legend__item"><view class="legend__dot leave" /><text>休假</text></view></view></view><view class="section-head"><text>近期班次</text><text class="small">时间以排班计划为准</text></view><view v-if="loading" class="loading"><wd-loading color="var(--smis-primary)"/></view><view v-else-if="upcoming.length" class="shift-list"><view v-for="item in upcoming" :key="item.id" class="shift surface-card"><view class="shift__date"><text>{{Number(item.workDate.slice(-2))}}</text><text class="small">{{Number(item.workDate.slice(5,7))}}月</text></view><view class="shift__copy"><text>{{item.shiftName}}</text><text class="small">{{item.startTime.slice(0,5)}} — {{item.endTime.slice(0,5)}}{{item.crossDay?' · 跨日':''}}</text><text class="paragraph" v-if="item.remark">{{item.remark}}</text></view><text class="shift__type">{{item.shiftType}}</text></view></view><SmisEmpty v-else-if="!loadError" title="本月暂无排班" description="排班由 Web 端统一维护，发布后会自动同步到这里"/></view></view></wd-config-provider>
</template>
<style scoped lang="scss">.schedule-body{padding-bottom:50rpx}.calendar{padding:25rpx}.calendar__head{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center}.calendar__head button{width:70rpx;height:70rpx;margin:0;padding:0;border-radius:18rpx;background:#f0f4f6;color:var(--smis-primary);display:flex;align-items:center;justify-content:center}.calendar__head>view{min-width:0;display:flex;flex-direction:column;align-items:center;text-align:center}.calendar__head text{font-size: clamp(15px, 30rpx, 17px);font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums}.calendar__head .small{margin-top:7rpx;color:var(--smis-text-muted);font-size: clamp(13px, 18rpx, 14px);font-weight:500}.week,.days{display:grid;grid-template-columns:repeat(7,1fr)}.week{margin-top:22rpx;padding-bottom:10rpx;border-bottom:1rpx solid var(--smis-line)}.week text{text-align:center;color:var(--smis-text-muted);font-size: clamp(13px, 19rpx, 14px)}.days{gap:8rpx 3rpx;margin-top:10rpx}.day{min-height:max(90rpx,54px);border-radius:15rpx;display:flex;flex-direction:column;align-items:center;justify-content:center}.day>text{font-size: clamp(13px, 23rpx, 14px)}.day .small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size: clamp(13px, 16rpx, 14px);margin-top:2rpx}.day--shift{background:var(--smis-primary-soft);color:var(--smis-primary)}.day--worked{background:#e4f2eb;color:var(--smis-success)}.day--leave{background:#fff1df;color:var(--smis-warning)}.legend{margin-top:24rpx;padding-top:24rpx;border-top:1rpx solid var(--smis-line);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12rpx}.legend__item{display:inline-flex;align-items:center;justify-content:center;gap:8px;color:var(--smis-text-secondary);font-size:12px;line-height:1.4}.legend__item text{line-height:1}.legend__dot{width:8px;height:8px;flex:none;border-radius:50%}.legend .scheduled{background:var(--smis-primary)}.legend .worked{background:var(--smis-success)}.legend .leave{background:var(--smis-warning)}.section-head{margin:30rpx 4rpx 16rpx;display:flex;align-items:flex-start;flex-direction:column;gap:8rpx}.section-head text{font-size: clamp(15px, 29rpx, 17px);font-weight:700}.section-head .small{color:var(--smis-text-muted);font-size: clamp(13px, 18rpx, 14px);font-weight:500;line-height:1.4;text-align:right}.loading{height:220rpx;display:flex;align-items:center;justify-content:center}.shift-list{display:flex;flex-direction:column;gap:14rpx}.shift{min-width:0;padding:22rpx;display:flex;align-items:center;gap:18rpx;overflow:hidden}.shift__date{width:72rpx;height:80rpx;min-width:72rpx;flex:0 0 72rpx;box-sizing:border-box;overflow:hidden;border-radius:18rpx;background:var(--smis-primary-soft);color:var(--smis-primary);display:flex;flex-direction:column;align-items:center;justify-content:center}.shift__date>text{width:100%;display:block;font-size: clamp(14px, 27rpx, 15px);font-weight:700;line-height:1;text-align:center;font-variant-numeric:tabular-nums}.shift__date>.small{margin-top:7rpx;font-size: clamp(13px, 17rpx, 14px);font-weight:600;line-height:1}.shift__copy{min-width:0;flex:1;display:flex;flex-direction:column;overflow:hidden}.shift__copy>text{font-size: clamp(14px, 25rpx, 15px);font-weight:700}.shift__copy .small{margin-top:5rpx;color:var(--smis-text-secondary);font-size: clamp(13px, 20rpx, 14px)}.shift__copy .paragraph{margin:5rpx 0 0;color:var(--smis-text-muted);font-size: clamp(13px, 18rpx, 14px)}.shift__type{flex:0 0 auto;padding:8rpx 12rpx;border-radius:999rpx;background:#f0f4f6;color:var(--smis-text-secondary);font-size: clamp(13px, 18rpx, 14px)}</style>
