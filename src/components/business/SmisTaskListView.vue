<script setup lang="ts">
import MobileMetricGrid from '@mobile-core/components/MobileMetricGrid.vue'
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'
import MobileLoadingStatus from '@mobile-core/components/MobileLoadingStatus.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, onBeforeUnmount, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import SmisTaskCard from './SmisTaskCard.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileSearch from '@mobile-core/components/MobileSearch.vue'
import MobileSegmented from '@mobile-core/components/MobileSegmented.vue'
import MobileListFooter from '@mobile-core/components/MobileListFooter.vue'
import { createLatestRequest } from '@mobile-core/latest-request'
import { mergePageRows } from '@mobile-core/list-rows'
import { useAuthStore } from '@/stores/auth'
import { listHazardInspectionTasks, listRiskTasks } from '@/api/smis'
import type { HazardInspectionTask, RiskTask, TaskOverview, TaskStatus } from '@/api/types'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

const { themeName } = usePageTheme()

const PAGE_SIZE = 15
const props = defineProps<{ kind: 'risk' | 'inspection' }>()
const auth = useAuthStore()
const loadError = ref('')
const failedMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const keyword = ref('')
const searchTerm = ref('')
const status = ref<TaskStatus | ''>('')
const rows = ref<Array<RiskTask | HazardInspectionTask>>([])
const offset = ref(0)
const total = ref(0)
const overview = ref<TaskOverview>({ total: 0, notStarted: 0, inProgress: 0, overdue: 0, completed: 0, cancelled: 0 })
const tabs: Array<{ value: TaskStatus | ''; label: string }> = [
  { value: '', label: '全部' },
  { value: 'not_started', label: '待执行' },
  { value: 'in_progress', label: '执行中' },
  { value: 'overdue', label: '已逾期' },
  { value: 'completed', label: '已完成' }
]
const finished = computed(() => offset.value >= total.value)
const requests = createLatestRequest()

async function load(reset = true) {
  if (!reset && (loading.value || loadingMore.value || finished.value)) return
  const isCurrent = reset ? requests.start() : requests.snapshot()
  loading.value = reset
  loadingMore.value = !reset
  const from = reset ? 0 : offset.value
  const params = { keyword: searchTerm.value, status: status.value || undefined, from, to: from + PAGE_SIZE - 1 }
  loadError.value = ''
  failedMore.value = false
  try {
    if (!(await auth.ensureValidSession()) || !isCurrent()) return
    const data = props.kind === 'risk'
      ? await listRiskTasks(auth.token, params)
      : await listHazardInspectionTasks(auth.token, params)
    if (!isCurrent()) return
    rows.value = mergePageRows(reset ? [] : rows.value, data.records, item => item.id)
    offset.value = data.records.length ? from + data.records.length : data.total
    total.value = data.total
    overview.value = data.overview
  } catch (error) {
    if (isCurrent()) {
      loadError.value = getErrorMessage(error)
      failedMore.value = !reset
    }
  } finally {
    if (isCurrent()) {
      loading.value = false
      loadingMore.value = false
      uni.stopPullDownRefresh()
    }
  }
}

function search() {
  searchTerm.value = keyword.value.trim()
  void load(true)
}

function select(value: TaskStatus | '') {
  status.value = value
  void load(true)
}

function title(item: RiskTask | HazardInspectionTask) {
  return props.kind === 'risk' ? (item as RiskTask).riskPointName : (item as HazardInspectionTask).inspectionObject
}

function place(item: RiskTask | HazardInspectionTask) {
  if (props.kind === 'inspection') return (item as HazardInspectionTask).inspectionTypeName
  const level = (item as RiskTask).riskLevelName
  return level ? `风险等级 ${level}` : ''
}

function progress(item: RiskTask | HazardInspectionTask) {
  if (!Number.isFinite(item.itemCount)) return ''
  const checked = props.kind === 'risk'
    ? (item as RiskTask).completedItemCount
    : (item as HazardInspectionTask).normalCount + item.abnormalCount
  return `${Number.isFinite(checked) ? checked : '—'}/${item.itemCount} 项`
}

function abnormal(item: RiskTask | HazardInspectionTask) {
  return item.abnormalCount
}

function open(item: RiskTask | HazardInspectionTask) {
  uni.navigateTo({ url: `/pages/${props.kind}/detail?id=${item.id}` })
}

onShow(() => load(true))
onPullDownRefresh(() => load(true))
onReachBottom(() => { if (!loadError.value) void load(false) })
onBeforeUnmount(requests.invalidate)
</script>

<template>
<wd-config-provider :theme="themeName">
  <MobileWorkspace container-class="page-shell">
    <MobileTopBar capsule="always"
      :title="kind === 'risk' ? '风险巡查' : '隐患排查'"
      :eyebrow="kind === 'risk' ? 'RISK CONTROL' : 'FIELD INSPECTION'"
      :subtitle="kind === 'risk' ? '分级管控，责任到人' : '逐项检查，异常转隐患'"
      show-back
    />
    <view class="page-body task-body">
      <MobileLoadError v-if="loadError && !failedMore" :message="loadError" @retry="load()" />
      <MobileMetricGrid :items="[{ label: '任务总数', value: overview.total }, { label: '执行中', value: overview.inProgress }, { label: '已逾期', value: overview.overdue, tone: 'danger' }]" />

      <view class="task-tools surface-card">
        <MobileSearch
          v-model="keyword"
          name="task-keyword"
          label="搜索任务"
          :placeholder="kind === 'risk' ? '任务编号或风险点' : '输入任务编号'"
          compact-action
          @submit="search"
          @clear="search"
        />
        <MobileSegmented label="筛选任务状态" :model-value="status" :options="tabs" @update:model-value="select" />
      </view>

      <view v-if="loading" class="loading surface-card">
        <MobileLoadingStatus label="正在同步任务…" />
      </view>
      <view v-else-if="rows.length" class="task-list">
        <SmisTaskCard
          v-for="item in rows"
          :key="item.id"
          :title="title(item)"
          :code="item.taskNo"
          :status="item.status"
          :place="place(item)"
          :start="formatDate(item.plannedStartAt)"
          :end="formatDate(item.plannedEndAt)"
          :progress="progress(item)"
          :danger-count="abnormal(item)"
          @click="open(item)"
        />
        <MobileListFooter
          :loading="loadingMore" :finished="finished" :count="rows.length" :total="total"
          :can-load-more="!loadError && !finished" :error="failedMore ? loadError : undefined"
          error-title="无法加载更多任务" @more="load(false)"
        />
      </view>
      <MobileEmptyState
        v-else-if="!loadError"
        icon="shield"
        :title="kind === 'risk' ? '暂无巡查任务' : '暂无排查任务'"
        :description="searchTerm || status ? '试试更换关键词或任务状态' : '任务发布后会同步到这里'"
      />
    </view>
  </MobileWorkspace>
</wd-config-provider>
</template>

<style scoped lang="scss">
.task-body { padding-top: 28rpx; }
.task-tools { margin-top: 20rpx; padding: 10rpx; display: flex; flex-direction: column; gap: 8rpx; overflow: hidden; }
.task-list { margin-top: 20rpx; display: flex; flex-direction: column; gap: 18rpx; }
.loading { min-height: 280rpx; margin-top: 20rpx; display: flex; align-items: center; justify-content: center; font-size: clamp(13px, 20rpx, 14px); }
</style>
