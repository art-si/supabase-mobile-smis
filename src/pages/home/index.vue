<script setup lang="ts">
import MobileAction from '@mobile-core/components/MobileAction.vue'
import { usePageTheme } from '@/composables/usePageTheme'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SmisBottomNav from '@/components/business/SmisBottomNav.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileInlineLabel from '@mobile-core/components/MobileInlineLabel.vue'
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'
import MobileLoadingStatus from '@mobile-core/components/MobileLoadingStatus.vue'
import MobileMetricGrid from '@mobile-core/components/MobileMetricGrid.vue'
import MobileSectionHeading from '@mobile-core/components/MobileSectionHeading.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import SmisStatusTag from '@/components/business/SmisStatusTag.vue'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { listEquipment, listHazardInspectionTasks, listHazards, listRiskTasks } from '@/api/smis'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

const { themeName } = usePageTheme()

const auth = useAuthStore(); const profileStore = useProfileStore()
function nav(url:string){uni.navigateTo({url})}
function openWorkbench(){uni.reLaunch({url:'/pages/workbench/index'})}
const loading = ref(false); const loaded = ref(false); const error = ref('')
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
const metrics = computed(() => [
  { label: '待处理任务', value: loaded.value ? pendingTotal.value : '—' },
  { label: '隐患闭环率', value: loaded.value ? closureRate.value : '—', unit: loaded.value ? '%' : undefined },
  { label: '设备在用', value: loaded.value ? dashboard.value.equipment.inUse : '—' }
])
const modules = computed(() => [
  { title: '风险管控', icon: 'risk', detail: loaded.value ? `${dashboard.value.risk.overdue} 项逾期` : '查看风险巡查', url: '/pages/risk/index' },
  { title: '隐患排查', icon: 'inspection', detail: loaded.value ? `${dashboard.value.inspection.inProgress} 项执行中` : '查看排查任务', url: '/pages/inspection/index' },
  { title: '隐患治理', icon: 'hazard', detail: loaded.value ? `${dashboard.value.hazard.rectifying} 项整改中` : '查看整改与验收', url: '/pages/hazards/index' },
  { title: '设备台账', icon: 'equipment', detail: loaded.value ? `${dashboard.value.equipment.dueSoon} 台临近检验` : '查看设备与检验', url: '/pages/equipment/index' },
  { title: '我的排班', icon: 'schedule', detail: '查看本月班次与跨日安排', url: '/pages/schedule/index' },
])

async function load() {
  if (loading.value || !(await auth.ensureValidSession())) return
  loading.value = true; error.value = ''
  try {
    await profileStore.load(auth.token)
    const [risk, inspection, hazard, equipment] = await Promise.all([
      listRiskTasks(auth.token, { to: 4 }), listHazardInspectionTasks(auth.token, { to: 4 }), listHazards(auth.token, { to: 4 }), listEquipment(auth.token, { to: 0 })
    ])
    dashboard.value = { risk: risk.overview, inspection: inspection.overview, hazard: hazard.overview, equipment: equipment.overview }
    loaded.value = true
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
  <MobileWorkspace container-class="page-shell page-shell--tabbed">
    <MobileTopBar capsule="always" title="安全工作台" :eyebrow="`${greeting}，${userName}`" subtitle="现场安全 · 巡查与隐患闭环" />
    <view class="page-body home-body" role="main">
      <view class="home-report mobile-group">
        <MobileSectionHeading title="现场隐患上报" description="拍照记录现场，提交后可跟进整改。" />
        <MobileAction class="smis-primary-action" @click="nav('/pages/quick-report/index')">
          <MobileInlineLabel icon="camera" label="随手拍上报" icon-size="18px" />
        </MobileAction>
      </view>

      <view class="home-section home-priority" :aria-busy="loading">
        <MobileSectionHeading title="优先处理" description="逾期任务优先，按截止时间排序" action-label="打开工作台" @action="openWorkbench" />
        <MobileLoadError v-if="error" :message="error" @retry="load" />
        <view v-if="taskRows.length" class="home-task-list mobile-group">
          <MobileAction v-for="item in taskRows" :key="`${item.type}-${item.id}`" class="mobile-row home-task" @click="openTask(item)">
            <view class="mobile-row__body">
              <view class="home-task__meta">
                <text class="mobile-row__detail home-task__reference" translate="no">{{ item.code }}</text>
                <SmisStatusTag :status="item.status" />
              </view>
              <text class="mobile-row__label">{{ item.title }}</text>
              <text class="mobile-row__detail home-task__time">{{ item.type === 'risk' ? '风险巡查' : '隐患排查' }}{{ item.end ? ` · 截止 ${formatDate(item.end, true)}` : '' }}</text>
            </view>
            <MobileIcon class="mobile-row__chevron" name="chevron" size="14px" aria-hidden="true" />
          </MobileAction>
        </view>
        <view v-else-if="!error" class="mobile-group">
          <MobileEmptyState v-if="loaded && !loading" icon="check" title="当前没有待处理任务" description="保持巡检节奏，发现异常可随手拍上报。" />
          <MobileLoadingStatus v-else class="home-loading" label="正在同步安全任务…" />
        </view>
      </view>

      <view class="home-section">
        <MobileSectionHeading title="安全概览" />
        <MobileMetricGrid :items="metrics" />
      </view>
      <view class="home-section">
        <MobileSectionHeading title="常用入口" />
        <view class="home-module-list mobile-group">
          <MobileAction v-for="item in modules" :key="item.url" class="mobile-row" @click="nav(item.url)">
            <view class="mobile-row__icon" aria-hidden="true"><MobileIcon :name="item.icon" size="18px" /></view>
            <view class="mobile-row__body">
              <text class="mobile-row__label">{{ item.title }}</text>
              <text class="mobile-row__detail">{{ item.detail }}</text>
            </view>
            <MobileIcon class="mobile-row__chevron" name="chevron" size="14px" aria-hidden="true" />
          </MobileAction>
        </view>
      </view>
    </view>
    <SmisBottomNav active="home" />
  </MobileWorkspace>
</wd-config-provider>
</template>

<style scoped lang="scss">
.home-body { display: grid; align-content: start; gap: 20px; }
.home-section { display: grid; min-width: 0; gap: 8px; }
.home-report { display: grid; gap: 12px; padding: var(--mobile-workspace-card-padding); }
.home-report .smis-primary-action { width: 100%; margin: 0; }
.home-task__meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; }
.home-task__reference { flex: 1 1 100px; min-width: 0; }
.home-task .mobile-row__label { text-wrap: pretty; }
.home-task__reference,
.home-task__time { font-variant-numeric: tabular-nums; }
.home-module-list .mobile-row__icon { color: var(--smis-text-secondary); background: var(--smis-panel); }
.home-loading { padding: 24px var(--mobile-workspace-card-padding); justify-content: center; }
</style>
