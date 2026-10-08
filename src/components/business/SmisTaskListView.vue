<script setup lang="ts">
import SmisMetricGrid from '@/components/business/SmisMetricGrid.vue'
import SmisLoadError from '@/components/business/SmisLoadError.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import SmisTopBar from './SmisTopBar.vue'
import SmisTaskCard from './SmisTaskCard.vue'
import SmisEmpty from './SmisEmpty.vue'
import SmisSearchBar from './SmisSearchBar.vue'
import SmisStatusTabs from './SmisStatusTabs.vue'
import SmisListFooter from './SmisListFooter.vue'
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
const loading = ref(false)
const loadingMore = ref(false)
const keyword = ref('')
const status = ref<TaskStatus | ''>('')
const rows = ref<Array<RiskTask | HazardInspectionTask>>([])
const total = ref(0)
const overview = ref<TaskOverview>({ total: 0, notStarted: 0, inProgress: 0, overdue: 0, completed: 0, cancelled: 0 })
const tabs: Array<{ value: TaskStatus | ''; label: string }> = [
  { value: '', label: '全部' },
  { value: 'not_started', label: '待执行' },
  { value: 'in_progress', label: '执行中' },
  { value: 'overdue', label: '已逾期' },
  { value: 'completed', label: '已完成' }
]
const finished = computed(() => rows.value.length >= total.value)

async function load(reset = true) {
  if (loading.value || loadingMore.value || !(await auth.ensureValidSession())) return
  reset ? (loading.value = true) : (loadingMore.value = true)
  const from = reset ? 0 : rows.value.length
  loadError.value = ''
  try {
    const params = { keyword: keyword.value, status: status.value || undefined, from, to: from + PAGE_SIZE - 1 }
    const data = props.kind === 'risk'
      ? await listRiskTasks(auth.token, params)
      : await listHazardInspectionTasks(auth.token, params)
    rows.value = reset ? data.records : [...rows.value, ...data.records]
    total.value = data.total
    overview.value = data.overview
  } catch (error) {
    loadError.value = getErrorMessage(error)
  } finally {
    loading.value = false
    loadingMore.value = false
    uni.stopPullDownRefresh()
  }
}

function select(value: string) {
  status.value = value as TaskStatus | ''
  void load(true)
}

function title(item: RiskTask | HazardInspectionTask) {
  return props.kind === 'risk' ? (item as RiskTask).riskPointName : (item as HazardInspectionTask).inspectionObject
}

function place(item: RiskTask | HazardInspectionTask) {
  return props.kind === 'risk' ? `风险等级 ${(item as RiskTask).riskLevelName}` : (item as HazardInspectionTask).inspectionTypeName
}

function progress(item: RiskTask | HazardInspectionTask) {
  return props.kind === 'risk'
    ? `${(item as RiskTask).completedItemCount}/${item.itemCount} 项`
    : `${(item as HazardInspectionTask).normalCount + (item as HazardInspectionTask).abnormalCount}/${item.itemCount} 项`
}

function abnormal(item: RiskTask | HazardInspectionTask) {
  return props.kind === 'risk' ? (item as RiskTask).abnormalCount : (item as HazardInspectionTask).abnormalCount
}

function open(item: RiskTask | HazardInspectionTask) {
  uni.navigateTo({ url: `/pages/${props.kind}/detail?id=${item.id}` })
}

onShow(() => load(true))
onPullDownRefresh(() => load(true))
onReachBottom(() => { if (!finished.value) void load(false) })
</script>

<template>
<wd-config-provider :theme="themeName">
  <view class="page-shell">
    <SmisTopBar
      :title="kind === 'risk' ? '风险巡查' : '隐患排查'"
      :eyebrow="kind === 'risk' ? 'RISK CONTROL' : 'FIELD INSPECTION'"
      :subtitle="kind === 'risk' ? '分级管控，责任到人' : '逐项检查，异常转隐患'"
      show-back
    />
    <view class="page-body task-body">
      <SmisLoadError v-if="loadError" :message="loadError" @retry="load()" />
      <SmisMetricGrid :items="[{ label: '任务总数', value: overview.total }, { label: '执行中', value: overview.inProgress }, { label: '已逾期', value: overview.overdue, tone: 'danger' }]" />

      <view class="task-tools surface-card">
        <SmisSearchBar
          v-model="keyword"
          :placeholder="kind === 'risk' ? '任务编号 / 风险点' : '任务编号 / 排查对象'"
          action-label="搜索"
          embedded
          :disabled="loading"
          @search="load(true)"
        />
        <SmisStatusTabs :model-value="status" :tabs="tabs" embedded @update:model-value="select" />
      </view>

      <view v-if="loading" class="loading surface-card" aria-live="polite">
        <wd-loading color="var(--smis-primary)" /><text>正在同步任务…</text>
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
          @tap="open(item)"
        />
        <SmisListFooter :loading="loadingMore" :finished="finished" :count="rows.length" />
      </view>
      <SmisEmpty v-else-if="!loadError" title="暂无排查任务" description="任务由 Web 端计划生成，发布后会同步到这里" />
    </view>
  </view>
</wd-config-provider>
</template>

<style scoped lang="scss">
.task-body { padding-top: 28rpx; padding-bottom: 56rpx; }
.task-tools { margin-top: 20rpx; padding: 10rpx; display: flex; flex-direction: column; gap: 8rpx; overflow: hidden; }
.task-list { margin-top: 20rpx; display: flex; flex-direction: column; gap: 18rpx; }
.loading { min-height: 280rpx; margin-top: 20rpx; color: var(--smis-text-secondary); display: flex; align-items: center; justify-content: center; gap: 14rpx; font-size: clamp(13px, 20rpx, 14px); }
</style>
