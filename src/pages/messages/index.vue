<script setup lang="ts">
import SmisLoadError from '@/components/business/SmisLoadError.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, ref } from 'vue'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import SmisBottomNav from '@/components/business/SmisBottomNav.vue'
import SmisTopBar from '@/components/business/SmisTopBar.vue'
import SmisIcon from '@/components/business/SmisIcon.vue'
import SmisListFooter from '@/components/business/SmisListFooter.vue'
import { useAuthStore } from '@/stores/auth'
import { listHazards, listRiskTasks } from '@/api/smis'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

const { themeName } = usePageTheme()

type MessageRow = { id: string; type: string; title: string; body: string; time: string; url: string }

const PAGE_SIZE = 8
const auth = useAuthStore()
const loadError = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const rows = ref<MessageRow[]>([])
const riskOffset = ref(0)
const hazardOffset = ref(0)
const riskTotal = ref(0)
const hazardTotal = ref(0)
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
  if (loading.value || loadingMore.value || !(await auth.ensureValidSession())) return
  reset ? (loading.value = true) : (loadingMore.value = true)
  const riskFrom = reset ? 0 : riskOffset.value
  const hazardFrom = reset ? 0 : hazardOffset.value
  loadError.value = ''
  try {
    const [risk, hazard] = await Promise.all([
      listRiskTasks(auth.token, { status: 'overdue', from: riskFrom, to: riskFrom + PAGE_SIZE - 1 }),
      listHazards(auth.token, { status: 'pending_acceptance', from: hazardFrom, to: hazardFrom + PAGE_SIZE - 1 })
    ])
    riskTotal.value = risk.total
    hazardTotal.value = hazard.total
    riskOffset.value = riskFrom + risk.records.length
    hazardOffset.value = hazardFrom + hazard.records.length
    const additions: MessageRow[] = [
      ...risk.records.map((item) => ({ id: item.id, type: '逾期提醒', title: item.riskPointName, body: `风险巡查 ${item.taskNo} 已超过计划时间`, time: item.plannedEndAt, url: `/pages/risk/detail?id=${item.id}` })),
      ...hazard.records.map((item) => ({ id: item.id, type: '待验收', title: item.description, body: `隐患 ${item.hazardNo} 已提交整改，请及时验收`, time: item.rectificationCompletedAt || item.reportedAt, url: `/pages/hazards/detail?id=${item.id}` }))
    ]
    const merged = reset ? additions : [...rows.value, ...additions]
    rows.value = [...new Map(merged.map((item) => [`${item.type}-${item.id}`, item])).values()]
      .sort((left, right) => +new Date(right.time) - +new Date(left.time))
  } catch (error) {
    loadError.value = getErrorMessage(error)
  } finally {
    loading.value = false
    loadingMore.value = false
    uni.stopPullDownRefresh()
  }
}

function open(url: string) { uni.navigateTo({ url }) }
onShow(() => load(true))
onPullDownRefresh(() => load(true))
onReachBottom(() => { if (!finished.value) void load(false) })
</script>

<template>
<wd-config-provider :theme="themeName">
  <view class="page-shell">
    <SmisTopBar title="安全消息" eyebrow="SAFETY NOTICE" subtitle="只聚焦需要你处理的变化" />
    <view class="page-body message-body">
      <SmisLoadError v-if="loadError" :message="loadError" @retry="load()" />
      <view v-if="loading" class="state"><wd-loading color="var(--smis-primary)" /><text>正在读取提醒…</text></view>
      <view v-else-if="grouped.length" class="message-list">
        <view class="notice-summary"><view><text>逾期巡查</text><text class="strong">{{ riskTotal }}</text></view><view><text>待验收隐患</text><text class="strong">{{ hazardTotal }}</text></view><text class="notice-summary__hint">点击提醒查看任务详情</text></view>
        <view v-for="group in grouped" :key="group.day" class="message-group">
          <text class="message-group__date">{{ group.day }}</text>
          <view class="message-group__rows surface-card">
            <button v-for="item in group.records" :key="`${item.type}-${item.id}`" class="message" @tap="open(item.url)">
              <view class="message__icon" :class="{ 'message__icon--acceptance': item.type === '待验收' }"><SmisIcon :name="item.type === '待验收' ? 'check' : 'notice'" size="34rpx" /></view>
              <view class="message__copy">
                <view><text>{{ item.type }}</text><text class="small">{{ formatDate(item.time, true).slice(-5) }}</text></view>
                <text class="strong line-clamp-2">{{ item.title }}</text>
                <text class="paragraph line-clamp-2">{{ item.body }}</text>
              </view>
              <SmisIcon name="chevron" size="24rpx" />
            </button>
          </view>
        </view>
        <SmisListFooter :loading="loadingMore" :finished="finished" :count="rows.length" />
      </view>
      <view v-else-if="!loadError" class="state surface-card"><view class="state__safe"><SmisIcon name="check" size="50rpx" /></view><text>没有待处理消息</text><text class="small">逾期任务和待验收隐患会出现在这里</text></view>
    </view>
    <SmisBottomNav active="messages" />
  </view>
</wd-config-provider>
</template>

<style scoped lang="scss">
.message-body { padding-top: 24rpx; }
.notice-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; margin-bottom: 28rpx; padding: 0 6rpx; }
.notice-summary > view { display: flex; align-items: baseline; gap: 16rpx; color: var(--smis-text-secondary); font-size: 13px; }
.notice-summary .strong { font-size: clamp(20px, 38rpx, 26px); font-weight: 700; color: var(--smis-text); font-variant-numeric: tabular-nums; }
.notice-summary__hint { grid-column: 1 / -1; font-size: 12px; color: var(--smis-text-secondary); }
.message-group + .message-group { margin-top: 28rpx; }
.message-group__date { display: block; margin: 0 6rpx 14rpx; font-size: 13px; font-weight: 600; color: var(--smis-text-secondary); }
.message { width: 100%; min-width: 0; margin: 0; padding: 24rpx; border: 0; border-radius: 0; background: #fff; text-align: left; display: flex; align-items: flex-start; gap: 16rpx; }
.message + .message { border-top: 1rpx solid var(--smis-line); }
.message > :last-child { align-self: center; color: var(--smis-text-muted); }
.message__icon { width: 56rpx; height: 56rpx; flex: none; border-radius: 16rpx; color: var(--smis-warning); background: #fff1df; display: flex; align-items: center; justify-content: center; }
.message__icon--acceptance { color: var(--smis-primary); background: var(--smis-primary-soft); }
.message__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 8rpx; }
.message__copy > view { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12rpx; }
.message__copy > view text { color: var(--smis-warning); font-size: 12px; font-weight: 600; }
.message__copy .small { color: var(--smis-text-secondary); font-size: 12px; font-weight: 400; }
.message__copy .strong { color: var(--smis-text); font-size: clamp(15px, 28rpx, 17px); font-weight: 600; line-height: 1.45; }
.message__copy .paragraph { color: var(--smis-text-secondary); font-size: 13px; line-height: 1.55; overflow-wrap: anywhere; }
.state { min-height: 320rpx; padding: 40rpx 28rpx; color: var(--smis-text-secondary); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; }
.state__safe { width: 80rpx; height: 80rpx; border-radius: 24rpx; color: var(--smis-success); background: #e5f3ec; display: flex; align-items: center; justify-content: center; }
.state > text { font-size: 15px; font-weight: 600; }
.state > .small { font-size: 13px; line-height: 1.6; text-align: center; font-weight: 400; }
</style>
