<script setup lang="ts">
import MobileMetricGrid from '@mobile-core/components/MobileMetricGrid.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'
import MobileLoadingStatus from '@mobile-core/components/MobileLoadingStatus.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, onBeforeUnmount, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import SmisStatusTag from '@/components/business/SmisStatusTag.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileSearch from '@mobile-core/components/MobileSearch.vue'
import MobileSegmented from '@mobile-core/components/MobileSegmented.vue'
import MobileListFooter from '@mobile-core/components/MobileListFooter.vue'
import { createLatestRequest } from '@mobile-core/latest-request'
import { mergePageRows } from '@mobile-core/list-rows'
import { useAuthStore } from '@/stores/auth'
import { listHazards } from '@/api/smis'
import type { HazardOverview, HazardRecord, HazardStatus } from '@/api/types'
import { formatDate, hazardLevelBadge } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

const { themeName } = usePageTheme()

const PAGE_SIZE = 15
const auth = useAuthStore()
const loadError = ref('')
const failedMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const keyword = ref('')
const searchTerm = ref('')
const status = ref<HazardStatus | ''>('')
const rows = ref<HazardRecord[]>([])
const offset = ref(0)
const total = ref(0)
const overview = ref<HazardOverview>({ total: 0, pendingApproval: 0, rectifying: 0, pendingAcceptance: 0, completed: 0, closed: 0 })
const tabs: Array<{ value: HazardStatus | ''; label: string }> = [
  { value: '', label: '全部' },
  { value: 'pending_approval', label: '待核准' },
  { value: 'rectifying', label: '整改中' },
  { value: 'pending_acceptance', label: '待验收' },
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
  const params = { keyword: searchTerm.value, status: status.value, from, to: from + PAGE_SIZE - 1 }
  loadError.value = ''
  failedMore.value = false
  try {
    if (!(await auth.ensureValidSession()) || !isCurrent()) return
    const data = await listHazards(auth.token, params)
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

function select(value: HazardStatus | '') {
  status.value = value
  void load(true)
}
function openDetail(id: string) { uni.navigateTo({ url: `/pages/hazards/detail?id=${id}` }) }
function openReport() { uni.navigateTo({ url: '/pages/quick-report/index' }) }

onShow(() => load(true))
onPullDownRefresh(() => load(true))
onReachBottom(() => { if (!loadError.value) void load(false) })
onBeforeUnmount(requests.invalidate)
</script>

<template>
<wd-config-provider :theme="themeName">
  <MobileWorkspace container-class="page-shell">
    <MobileTopBar capsule="always" title="隐患治理" eyebrow="HAZARD CLOSURE" subtitle="从上报到验收，全程可追溯" show-back />
    <view class="page-body hazard-body">
      <MobileLoadError v-if="loadError && !failedMore" :message="loadError" @retry="load()" />
      <MobileMetricGrid :items="[{ label: '全部隐患', value: overview.total }, { label: '整改中', value: overview.rectifying }, { label: '待验收', value: overview.pendingAcceptance, tone: 'warning' }]" />

      <view class="hazard-tools surface-card">
        <MobileSearch v-model="keyword" name="hazard-keyword" label="搜索隐患" placeholder="输入隐患编号" action-label="查询" compact-action @submit="search" @clear="search" />
        <MobileSegmented label="筛选隐患状态" :model-value="status" :options="tabs" @update:model-value="select" />
      </view>

      <view v-if="loading" class="loading"><MobileLoadingStatus label="正在同步隐患台账…" /></view>
      <view v-else-if="rows.length" class="hazard-list">
        <MobileAction v-for="item in rows" :key="item.id" class="hazard surface-card" @click="openDetail(item.id)">
          <view class="hazard__head mobile-card-identity">
            <view class="hazard__identity mobile-card-identity__main">
              <view class="hazard__level">{{ hazardLevelBadge(item.hazardLevel) }}</view>
              <view><text translate="no">{{ item.hazardNo }}</text><text class="small">{{ formatDate(item.reportedAt, true) }}</text></view>
            </view>
            <SmisStatusTag :status="item.status" />
          </view>
          <text class="hazard__desc line-clamp-2">{{ item.description }}</text>
          <view class="hazard__place mobile-inline-pair mobile-inline-pair--start">
            <view class="mobile-inline-pair__icon" aria-hidden="true"><MobileIcon name="location" size="1em" align-to-label /></view>
            <text class="line-clamp-2">{{ item.location }}</text>
          </view>
          <view class="hazard__foot">
            <view class="hazard__people">
              <text>上报：{{ item.reporterEmployeeName || '—' }}</text>
              <text v-if="item.rectificationResponsibleEmployeeName">整改：{{ item.rectificationResponsibleEmployeeName }}</text>
            </view>
            <MobileIcon name="chevron" size="1em" aria-hidden="true" />
          </view>
        </MobileAction>
        <MobileListFooter
          :loading="loadingMore" :finished="finished" :count="rows.length" :total="total"
          :can-load-more="!loadError && !finished" :error="failedMore ? loadError : undefined"
          error-title="无法加载更多隐患" @more="load(false)"
        />
      </view>
      <MobileEmptyState
        v-else-if="!loadError" icon="hazard" title="暂无隐患记录"
        :description="searchTerm || status ? '试试更换关键词或隐患状态' : '发现现场隐患时，可拍照记录并立即上报'"
      >
        <MobileAction v-if="!searchTerm && !status" class="smis-secondary-action" @click="openReport">随手拍上报</MobileAction>
      </MobileEmptyState>
    </view>
  </MobileWorkspace>
</wd-config-provider>
</template>

<style scoped lang="scss">
.hazard-tools { margin-top: 20rpx; padding: 10rpx; display: flex; flex-direction: column; gap: 8rpx; overflow: hidden; }
.loading { min-height: 280rpx; display: flex; align-items: center; justify-content: center; font-size: clamp(13px, 20rpx, 14px); }
.hazard-list { margin-top: 20rpx; display: flex; flex-direction: column; gap: 16rpx; }
.hazard { width: 100%; min-width: 0; margin: 0; padding: 24rpx; text-align: left; overflow: hidden; }
.hazard__identity { display: flex; align-items: center; gap: 14rpx; }
.hazard__level { width: 58rpx; height: 58rpx; flex: 0 0 58rpx; border-radius: 17rpx; color: var(--smis-warning); background: #fff1df; font-size: clamp(14px, 25rpx, 15px); font-weight: 700; display: flex; align-items: center; justify-content: center; }
.hazard__identity > view:nth-child(2) { min-width: 0; flex: 1; display: flex; flex-direction: column; overflow-wrap: anywhere; }
.hazard__identity text { font-size: max(13px, .8125rem); font-weight: 700; }
.hazard__head .small { margin-top: 4rpx; color: var(--smis-text-muted); font-size: clamp(13px, 17rpx, 14px); font-weight: 500; }
.hazard__desc { margin-top: 17rpx; font-size: clamp(14px, 26rpx, 15px); line-height: 1.5; font-weight: 700; overflow-wrap: anywhere; }
.hazard__place { margin-top: 14rpx; color: var(--smis-text-secondary); font-size: clamp(13px, 20rpx, 14px); display: flex; }
.hazard__foot { margin-top: 18rpx; padding-top: 15rpx; border-top: 1rpx solid var(--smis-line); color: var(--smis-text-muted); font-size: clamp(13px, 18rpx, 14px); display: flex; align-items: center; gap: 10rpx; }
.hazard__people { min-width: 0; flex: 1; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 8px; overflow-wrap: anywhere; }
</style>
