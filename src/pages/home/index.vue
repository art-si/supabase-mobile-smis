<script setup lang="ts">
import { usePageTheme } from '@/composables/usePageTheme'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SmisBottomNav from '@/components/business/SmisBottomNav.vue'
import SmisIcon from '@/components/business/SmisIcon.vue'
import SmisTaskCard from '@/components/business/SmisTaskCard.vue'
import SmisLoadError from '@/components/business/SmisLoadError.vue'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { listEquipment, listHazardInspectionTasks, listHazards, listRiskTasks } from '@/api/smis'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

const { themeName } = usePageTheme()

const auth = useAuthStore(); const profileStore = useProfileStore()
function nav(url:string){uni.navigateTo({url})}
function openWorkbench(){uni.reLaunch({url:'/pages/workbench/index'})}
const loading = ref(false); const error = ref('')
const dashboard = ref({ risk: { total: 0, notStarted: 0, inProgress: 0, overdue: 0, completed: 0 }, inspection: { total: 0, notStarted: 0, inProgress: 0, overdue: 0, completed: 0 }, hazard: { total: 0, pendingApproval: 0, rectifying: 0, pendingAcceptance: 0, completed: 0, closed: 0 }, equipment: { total: 0, inUse: 0, boilerCount: 0, dueSoon: 0 } })
const taskRows = ref<Array<{ id: string; type: 'risk'|'inspection'; title: string; code: string; status: string; end: string }>>([])
const userName = computed(() => profileStore.profile?.employeeName || String(auth.user?.user_metadata?.name || auth.user?.email || '安全员'))
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})
const pendingTotal = computed(() => dashboard.value.risk.notStarted + dashboard.value.risk.inProgress + dashboard.value.risk.overdue + dashboard.value.inspection.notStarted + dashboard.value.inspection.inProgress + dashboard.value.inspection.overdue)
const closureRate = computed(() => dashboard.value.hazard.total ? Math.round(((dashboard.value.hazard.completed + dashboard.value.hazard.closed) / dashboard.value.hazard.total) * 100) : 0)

async function load() {
  if (!(await auth.ensureValidSession())) return
  loading.value = true; error.value = ''
  try {
    await profileStore.load(auth.token)
    const [risk, inspection, hazard, equipment] = await Promise.all([
      listRiskTasks(auth.token, { to: 4 }), listHazardInspectionTasks(auth.token, { to: 4 }), listHazards(auth.token, { to: 4 }), listEquipment(auth.token, { to: 0 })
    ])
    dashboard.value = { risk: risk.overview, inspection: inspection.overview, hazard: hazard.overview, equipment: equipment.overview }
    taskRows.value = [
      ...risk.records.map(item => ({ id: item.id, type: 'risk' as const, title: item.riskPointName, code: item.taskNo, status: item.status, end: item.plannedEndAt })),
      ...inspection.records.map(item => ({ id: item.id, type: 'inspection' as const, title: item.inspectionObject, code: item.taskNo, status: item.status, end: item.plannedEndAt }))
    ].filter(item => !['completed','cancelled'].includes(item.status)).sort((a, b) => Number(b.status === 'overdue') - Number(a.status === 'overdue') || new Date(a.end).getTime() - new Date(b.end).getTime()).slice(0, 3)
  } catch (e) { error.value = getErrorMessage(e, '安全数据同步失败，请稍后重试') } finally { loading.value = false }
}
function openTask(item: typeof taskRows.value[number]) { uni.navigateTo({ url: `/pages/${item.type}/detail?id=${item.id}` }) }
onShow(load)
</script>

<template>
<wd-config-provider :theme="themeName">
  <view class="page-shell">
    <view class="hero">
      <view class="hero__top"><view><text class="hero__eyebrow">现场安全工作台</text><text class="hero__hello">{{ greeting }}，{{ userName }}</text><text class="hero__sub">今天也要把风险挡在作业之前</text></view><view class="hero__badge"><SmisIcon name="shield" size="42rpx" /></view></view>
      <view class="hero__summary"><view><text>待处理任务</text><text class="strong">{{ loading ? '—' : pendingTotal }}</text></view><view class="hero__divider" /><view><text>隐患闭环率</text><text class="strong">{{ loading ? '—' : closureRate }}<text class="small">%</text></text></view><view class="hero__divider" /><view><text>设备在用</text><text class="strong">{{ loading ? '—' : dashboard.equipment.inUse }}</text></view></view>

    </view>
    <view class="page-body home-body">
      <SmisLoadError v-if="error" :message="error" @retry="load" />
      <button class="report-entry" @tap="nav('/pages/quick-report/index')"><view class="report-entry__icon"><SmisIcon name="camera" size="44rpx" /></view><view><text>发现隐患，立即上报</text><text class="small">记录现场 · 上传照片 · 跟进整改</text></view><SmisIcon name="chevron" size="30rpx" /></button>
      <view class="quick-grid">
        <button class="quick-card" @tap="nav('/pages/risk/index')"><view class="quick-card__icon quick-card__icon--blue"><SmisIcon name="risk" size="42rpx" /></view><text>风险管控</text><text class="small">{{ dashboard.risk.overdue }} 项逾期</text></button>
        <button class="quick-card" @tap="nav('/pages/inspection/index')"><view class="quick-card__icon quick-card__icon--yellow"><SmisIcon name="inspection" size="42rpx" /></view><text>隐患排查</text><text class="small">{{ dashboard.inspection.inProgress }} 项执行中</text></button>
        <button class="quick-card" @tap="nav('/pages/hazards/index')"><view class="quick-card__icon quick-card__icon--orange"><SmisIcon name="hazard" size="42rpx" /></view><text>隐患治理</text><text class="small">{{ dashboard.hazard.rectifying }} 项整改中</text></button>
        <button class="quick-card" @tap="nav('/pages/equipment/index')"><view class="quick-card__icon quick-card__icon--green"><SmisIcon name="equipment" size="42rpx" /></view><text>设备台账</text><text class="small">{{ dashboard.equipment.dueSoon }} 台临检</text></button>
      </view>
      <view class="section-head"><view><text class="section-title">优先处理</text><text class="section-subtitle">按逾期与截止时间排序</text></view><button @tap="openWorkbench">查看全部</button></view>
      <view v-if="loading" class="loading-card surface-card"><wd-loading color="var(--smis-primary)" /> <text>正在同步安全任务…</text></view>
      <view v-else-if="taskRows.length" class="task-list">
        <SmisTaskCard v-for="item in taskRows" :key="`${item.type}-${item.id}`" :title="item.title" :code="`${item.type === 'risk' ? '风险巡查' : '隐患排查'} · ${item.code}`" :status="item.status" :end="formatDate(item.end, true)" @tap="openTask(item)" />
      </view>
      <view v-else-if="!error" class="safe-state surface-card"><view><SmisIcon name="check" size="48rpx" /></view><text>当前没有待处理任务</text><text class="small">保持巡检节奏，异常及时随手拍</text></view>
      <button class="schedule-card" @tap="nav('/pages/schedule/index')"><view><text>我的排班</text><text class="small">查看本月班次与跨日安排</text></view><SmisIcon name="schedule" size="44rpx"/><SmisIcon name="chevron" size="30rpx"/></button>
    </view>
    <SmisBottomNav active="home" />
  </view>
</wd-config-provider>
</template>

<style scoped lang="scss">
.hero { padding: calc(32rpx + env(safe-area-inset-top)) 28rpx 30rpx; color: #fff; background: var(--smis-hero-gradient); }
.hero__top { display: flex; align-items: center; gap: 20rpx; }
.hero__top > view:first-child { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 10rpx; }
.hero__eyebrow { font-size: 13px; color: rgba(255,255,255,.82); }
.hero__hello { font-size: clamp(21px, 38rpx, 23px); font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.hero__sub { font-size: 13px; color: rgba(255,255,255,.85); }
.hero__badge { width: 76rpx; height: 76rpx; flex: none; border: 1rpx solid rgba(255,255,255,.2); border-radius: 24rpx; display: flex; align-items: center; justify-content: center; color: #fcd34d; }
.hero__summary { margin-top: 24rpx; padding-top: 20rpx; border-top: 1rpx solid rgba(255,255,255,.18); display: grid; grid-template-columns: 1fr 1rpx 1fr 1rpx 1fr; gap: 12rpx; }
.hero__summary > view:not(.hero__divider) { display: flex; flex-direction: column; gap: 12rpx; }
.hero__summary text { font-size: 13px; color: rgba(255,255,255,.85); }
.hero__summary .strong { color: #fff; font-size: clamp(24px, 40rpx, 26px); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.hero__summary .small { margin-left: 4rpx; font-size: 13px; }
.hero__divider { background: rgba(255,255,255,.18); }
.home-body { padding-top: 24rpx; }
.report-entry { width: 100%; margin: 0 0 24rpx; padding: 24rpx; display: flex; align-items: center; gap: 18rpx; text-align: left; border-radius: 24rpx; background: var(--smis-primary-soft); color: var(--smis-primary); border: 1rpx solid rgba(var(--smis-primary-rgb),.15); }
.report-entry__icon { width: 72rpx; height: 72rpx; flex: none; border-radius: 20rpx; background: #fff; display: flex; align-items: center; justify-content: center; }
.report-entry > view:nth-child(2) { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.report-entry text { font-size: clamp(15px, 28rpx, 17px); font-weight: 700; }
.report-entry .small { font-size: 13px; line-height: 1.5; font-weight: 400; color: var(--smis-text-secondary); }
.quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18rpx; }
.quick-card { min-width: 0; margin: 0; padding: 22rpx; border: 1rpx solid var(--smis-line); border-radius: 24rpx; background: #fff; text-align: left; display: grid; grid-template-columns: 56rpx minmax(0, 1fr); align-items: center; gap: 16rpx 12rpx; }
.quick-card__icon { width: 56rpx; height: 56rpx; margin-bottom: 0; border-radius: 18rpx; display: flex; align-items: center; justify-content: center; }
.quick-card__icon--blue { background: var(--smis-primary-soft); color: var(--smis-primary); }
.quick-card__icon--yellow { background: #fff4d8; color: #9a6712; }
.quick-card__icon--orange { background: #fcece0; color: var(--smis-warning); }
.quick-card__icon--green { background: #e4f3ec; color: var(--smis-success); }
.quick-card > text { font-size: clamp(15px, 28rpx, 17px); font-weight: 700; color: var(--smis-text); }
.quick-card > .small { grid-column: 1 / -1; margin-top: 0; color: var(--smis-text-secondary); font-size: 13px; font-weight: 400; }
.section-head { margin: 28rpx 0 16rpx; display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.section-head > view { min-width: 0; display: flex; flex-direction: column; }
.section-head button { flex: none; min-height: 44px; margin: 0; padding: 0 8rpx; border: 0; background: transparent; color: var(--smis-primary); font-size: 13px; }
.task-list { display: flex; flex-direction: column; gap: 18rpx; }
.loading-card { padding: 50rpx 20rpx; display: flex; align-items: center; justify-content: center; gap: 16rpx; color: var(--smis-text-secondary); font-size: 14px; }
.safe-state { padding: 40rpx 20rpx; display: flex; flex-direction: column; align-items: center; gap: 14rpx; text-align: center; }
.safe-state > view { color: var(--smis-success); }
.safe-state > text { font-size: 15px; font-weight: 600; }
.safe-state .small { font-size: 13px; color: var(--smis-text-secondary); font-weight: 400; }
.schedule-card { width: 100%; margin: 24rpx 0 0; padding: 26rpx; border: 1rpx solid var(--smis-line); border-radius: 24rpx; background: #fff; color: var(--smis-primary); text-align: left; display: flex; align-items: center; gap: 20rpx; }
.schedule-card > view:first-child { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.schedule-card text { font-size: clamp(15px, 28rpx, 17px); font-weight: 700; color: var(--smis-text); }
.schedule-card .small { font-size: 13px; font-weight: 400; color: var(--smis-text-secondary); }
</style>
