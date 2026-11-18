<script setup lang="ts">
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'
import MobileLoadingStatus from '@mobile-core/components/MobileLoadingStatus.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, onBeforeUnmount, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import SmisBottomNav from '@/components/business/SmisBottomNav.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileMetricGrid from '@mobile-core/components/MobileMetricGrid.vue'
import MobileListFooter from '@mobile-core/components/MobileListFooter.vue'
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { createLatestRequest } from '@mobile-core/latest-request'
import { mergePageRows } from '@mobile-core/list-rows'
import { useAuthStore } from '@/stores/auth'
import { listHazards, listRiskTasks } from '@/api/smis'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

const { themeName } = usePageTheme()

type MessageRow = { id: string; type: '逾期提醒' | '待验收'; title: string; body: string; time: string; url: string }

const PAGE_SIZE = 8
const auth = useAuthStore()
const loadError = ref('')
const failedMore = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const rows = ref<MessageRow[]>([])
const riskOffset = ref(0)
const hazardOffset = ref(0)
const riskTotal = ref(0)
const hazardTotal = ref(0)
const requests = createLatestRequest()
const grouped = computed(() => {
  const groups = new Map<string, MessageRow[]>()
  for (const item of rows.value) {
    const day = formatDate(item.time)
    const records = groups.get(day) || []
    records.push(item)
    groups.set(day, records)
  }
  return [...groups].map(([day, records]) => ({ day, records }))
})
const finished = computed(() => riskOffset.value >= riskTotal.value && hazardOffset.value >= hazardTotal.value)

async function load(reset = true) {
  if (loading.value || (!reset && (loadingMore.value || finished.value))) return
  const isCurrent = reset ? requests.start() : requests.snapshot()
  loading.value = reset
  loadingMore.value = !reset
  const riskFrom = reset ? 0 : riskOffset.value
  const hazardFrom = reset ? 0 : hazardOffset.value
  loadError.value = ''
  try {
    if (!(await auth.ensureValidSession()) || !isCurrent()) return
    const [risk, hazard] = await Promise.all([
      reset || riskFrom < riskTotal.value
        ? listRiskTasks(auth.token, { status: 'overdue', from: riskFrom, to: riskFrom + PAGE_SIZE - 1 }) : null,
      reset || hazardFrom < hazardTotal.value
        ? listHazards(auth.token, { status: 'pending_acceptance', from: hazardFrom, to: hazardFrom + PAGE_SIZE - 1 }) : null
    ])
    if (!isCurrent()) return
    if (risk) {
      riskTotal.value = risk.total
      riskOffset.value = risk.records.length ? riskFrom + risk.records.length : risk.total
    }
    if (hazard) {
      hazardTotal.value = hazard.total
      hazardOffset.value = hazard.records.length ? hazardFrom + hazard.records.length : hazard.total
    }
    const additions: MessageRow[] = [
      ...(risk?.records ?? []).map<MessageRow>((item) => ({ id: item.id, type: '逾期提醒', title: item.riskPointName, body: `风险巡查 ${item.taskNo} 已超过计划时间`, time: item.plannedEndAt, url: `/pages/risk/detail?id=${item.id}` })),
      ...(hazard?.records ?? []).map<MessageRow>((item) => ({ id: item.id, type: '待验收', title: item.description, body: `隐患 ${item.hazardNo} 已提交整改，请及时验收`, time: item.rectificationCompletedAt || item.reportedAt, url: `/pages/hazards/detail?id=${item.id}` }))
    ]
    rows.value = mergePageRows(reset ? [] : rows.value, additions, item => `${item.type}-${item.id}`)
      .sort((left, right) => +new Date(right.time) - +new Date(left.time))
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

function open(url: string) { uni.navigateTo({ url }) }
onShow(() => load(true))
onPullDownRefresh(() => load(true))
onReachBottom(() => { if (!loadError.value) void load(false) })
onBeforeUnmount(requests.invalidate)
</script>

<template>
<wd-config-provider :theme="themeName">
  <MobileWorkspace container-class="page-shell page-shell--tabbed">
    <MobileTopBar capsule="always" title="安全消息" subtitle="需要跟进的巡查与验收" />
    <view class="page-body message-body" role="main">
      <MobileLoadError v-if="loadError && !failedMore" :message="loadError" @retry="load()" />
      <MobileLoadingStatus v-if="loading" block :label="rows.length ? '正在更新消息…' : '正在读取提醒…'" />
      <view v-if="grouped.length" class="message-list">
        <MobileMetricGrid class="notice-summary" :items="[
          { label: '逾期巡查', value: riskTotal, tone: 'danger' },
          { label: '待验收隐患', value: hazardTotal }
        ]" />
        <view class="message-toolbar">
          <text class="section-title" role="heading" aria-level="2">待跟进提醒</text>
          <MobileAction variant="link" aria-label="刷新消息" :disabled="loading" @click="load()">刷新</MobileAction>
        </view>
        <view :aria-busy="loading || loadingMore || undefined">
          <view v-for="group in grouped" :key="group.day" class="message-group">
            <text class="message-group__date" role="heading" aria-level="2">{{ group.day }}</text>
            <view class="message-group__rows surface-card">
              <MobileAction v-for="item in group.records" :key="`${item.type}-${item.id}`" class="message" @click="open(item.url)">
                <view class="message__icon mobile-icon-box" :class="{ 'message__icon--acceptance': item.type === '待验收' }"><MobileIcon :name="item.type === '待验收' ? 'check' : 'notice'" size="34rpx" /></view>
                <view class="message__copy">
                  <view class="message__meta"><text class="message__type" :class="{ 'message__type--acceptance': item.type === '待验收' }">{{ item.type }}</text><text class="small">{{ formatDate(item.time, true).slice(-5) }}</text></view>
                  <text class="strong line-clamp-2">{{ item.title }}</text>
                  <text class="paragraph line-clamp-2">{{ item.body }}</text>
                </view>
                <MobileIcon name="chevron" size="24rpx" color="var(--smis-text-muted)" />
              </MobileAction>
            </view>
          </view>
        </view>
        <MobileListFooter
          :loading="loadingMore" :finished="finished" :count="rows.length" :total="riskTotal + hazardTotal"
          :can-load-more="!loadError && !loading && !finished"
          :error="failedMore ? loadError : undefined" error-title="无法加载更多消息" @more="load(false)"
        />
      </view>
      <MobileEmptyState v-else-if="!loading && !loadError" icon="check" title="没有待处理消息" description="逾期任务和待验收隐患会出现在这里" class="surface-card" />
    </view>
    <SmisBottomNav active="messages" />
  </MobileWorkspace>
</wd-config-provider>
</template>

<style scoped lang="scss">
.message-body { padding-top: 24rpx; }
.notice-summary { margin-bottom: 16px; --mobile-metric-decoration: none; --mobile-metric-background: var(--smis-surface); }
.message-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; }
.message-group + .message-group { margin-top: 28rpx; }
.message-group__date { display: block; margin: 0 4px 8px; font-size: max(14px, .875rem); font-weight: 650; color: var(--smis-muted); }
.message.mobile-action { width: 100%; min-width: 0; margin: 0; padding: 24rpx; border: 0; border-radius: 0; background: var(--smis-surface); text-align: start; display: flex; align-items: center; gap: 16rpx; }
.message.mobile-action:focus-visible { outline-offset: -3px; }
.message + .message { border-top: 1rpx solid var(--smis-line); }
.message__icon { width: 32px; height: 32px; border-radius: 10px; color: var(--smis-red-strong); background: var(--smis-red-soft); }
.message__icon--acceptance { color: var(--smis-primary); background: var(--smis-primary-soft); }
.message__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.message__meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 8px; }
.message__type { color: var(--smis-red-strong); font-size: max(13px, .8125rem); font-weight: 650; }
.message__type--acceptance { color: var(--smis-primary-strong); }
.message__copy .small { color: var(--smis-muted); font-size: max(13px, .8125rem); font-variant-numeric: tabular-nums; }
.message__copy .strong { color: var(--smis-text-strong); font-size: max(15px, .9375rem); font-weight: 650; line-height: 1.45; overflow-wrap: anywhere; }
.message__copy .paragraph { color: var(--smis-muted); font-size: max(13px, .8125rem); line-height: 1.55; overflow-wrap: anywhere; }
</style>
