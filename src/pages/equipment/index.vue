<script setup lang="ts">
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileMetricGrid from '@mobile-core/components/MobileMetricGrid.vue'
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'
import MobileLoadingStatus from '@mobile-core/components/MobileLoadingStatus.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, onBeforeUnmount, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import SmisStatusTag from '@/components/business/SmisStatusTag.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import MobileSearch from '@mobile-core/components/MobileSearch.vue'
import MobileListFooter from '@mobile-core/components/MobileListFooter.vue'
import { createLatestRequest } from '@mobile-core/latest-request'
import { mergePageRows } from '@mobile-core/list-rows'
import { useAuthStore } from '@/stores/auth'
import { useDictionaryStore } from '@/stores/dictionary'
import { listEquipment } from '@/api/smis'
import type { Equipment, EquipmentOverview } from '@/api/types'
import { getErrorMessage } from '@/api/supabase'
import { STATUS_LABEL } from '@/utils/format'

const { themeName } = usePageTheme()

const PAGE_SIZE = 15
const auth = useAuthStore()
const dictionary = useDictionaryStore()
const keyword = ref('')
const appliedKeyword = ref('')
const rows = ref<Equipment[]>([])
const total = ref(0)
const loadError = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const overview = ref<EquipmentOverview>({ total: 0, inUse: 0, boilerCount: 0, dueSoon: 0 })
const requestKeyword = ref('')
const failedMore = ref(false)
const offset = ref(0)
const finished = computed(() => offset.value >= total.value)
const differentSearch = computed(() => requestKeyword.value !== appliedKeyword.value)
const requests = createLatestRequest()

async function load(reset = true, query = reset ? requestKeyword.value : appliedKeyword.value) {
  const term = query.trim()
  if (reset ? (loading.value && requestKeyword.value === term) : (loading.value || loadingMore.value || finished.value)) return
  const isCurrent = reset ? requests.start() : requests.snapshot()
  loading.value = reset
  loadingMore.value = !reset
  requestKeyword.value = term
  const from = reset ? 0 : offset.value
  loadError.value = ''
  try {
    if (!(await auth.ensureValidSession()) || !isCurrent()) return
    const data = await listEquipment(auth.token, { keyword: term, from, to: from + PAGE_SIZE - 1 })
    if (!isCurrent()) return
    rows.value = mergePageRows(reset ? [] : rows.value, data.records, item => item.id)
    offset.value = data.records.length ? from + data.records.length : data.total
    appliedKeyword.value = term
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

function label(value: string, typeCodes: string[]) {
  const text = dictionary.labelAny(typeCodes, value, value)
  return text === value ? STATUS_LABEL[value] || value : text
}
function openDetail(id: string) { uni.navigateTo({ url: `/pages/equipment/detail?id=${id}` }) }
function search() { return load(true, keyword.value) }

onShow(() => load(true))
onLoad(() => dictionary.load(auth.token))
onPullDownRefresh(() => load(true))
onReachBottom(() => { if (!loadError.value) void load(false) })
onBeforeUnmount(requests.invalidate)
</script>

<template>
<wd-config-provider :theme="themeName">
  <view class="page-shell">
    <MobileTopBar capsule="always" title="设备台账" subtitle="状态、位置与检验周期" show-back />
    <view class="page-body ledger-body" role="main">
      <MobileSearch v-model="keyword" class="ledger-search" name="equipment-keyword" label="搜索设备" placeholder="设备编号、名称或型号…" action-label="查询" compact-action @submit="search" @clear="search" />
      <MobileLoadError v-if="loadError && !failedMore" :message="loadError" @retry="load(true, requestKeyword)" />
      <MobileLoadingStatus v-if="loading" block :label="differentSearch ? '正在查询设备…' : '正在读取设备档案…'" />

      <MobileMetricGrid v-if="!differentSearch && (!loading || rows.length)" class="ledger-summary" :items="[
        { label: appliedKeyword ? '匹配设备' : '设备总数', value: appliedKeyword ? total : overview.total },
        { label: '在用', value: overview.inUse },
        { label: '临近检验', value: overview.dueSoon, tone: 'warning' }
      ]" />

      <view v-if="rows.length && !differentSearch" class="equipment-list">
        <view class="equipment-list__items" :aria-busy="loading || loadingMore || undefined">
          <text v-if="appliedKeyword" class="equipment-result" role="status">“{{ appliedKeyword }}”的查询结果</text>
          <MobileAction v-for="item in rows" :key="item.id" class="equipment surface-card" @click="openDetail(item.id)">
            <view class="equipment__top">
              <view class="equipment__icon mobile-icon-box"><MobileIcon name="equipment" size="40rpx" /></view>
              <view class="equipment__copy"><text class="line-clamp-2">{{ item.equipmentName || '未命名设备' }}</text><text class="small">{{ item.equipmentCode || '编号未录入' }}</text></view>
              <MobileIcon name="chevron" size="16px" color="var(--smis-muted)" />
            </view>
            <view class="equipment__spec"><text>{{ item.category?.categoryName || label(item.equipmentKind, ['smisEquipmentKind']) }}</text><view class="i" /><text>{{ item.model || item.specification || '型号未录入' }}</text></view>
            <view class="equipment__location mobile-inline-pair mobile-inline-pair--start">
              <view class="mobile-inline-pair__icon" aria-hidden="true"><MobileIcon name="location" size="1em" align-to-label /></view>
              <text class="line-clamp-2">{{ item.location?.locationName || item.detailLocation || '位置未录入' }}</text>
            </view>
            <view class="equipment__foot"><SmisStatusTag :status="item.operationStatus" /><text>{{ label(item.useStatus, ['smisEquipmentUseStatus']) }}</text><text v-if="item.isSpecialEquipment" class="special">特种设备</text></view>
          </MobileAction>
        </view>
        <MobileListFooter
          :loading="loadingMore" :finished="finished" :count="rows.length" :can-load-more="!loading && !finished"
          :error="failedMore ? loadError : undefined" error-title="无法加载更多设备" @more="load(false)"
        />
      </view>
      <MobileEmptyState icon="equipment" v-else-if="!loading && !loadError" :title="appliedKeyword ? '没有匹配的设备' : '暂无设备档案'" :description="appliedKeyword ? '试试更短的设备编号、名称或型号' : '在 Web 端登记设备后，这里会同步显示'" />
    </view>
  </view>
</wd-config-provider>
</template>

<style scoped lang="scss">
.ledger-body { padding-bottom: calc(24px + var(--mobile-safe-bottom)); }
.ledger-search { margin-bottom: 12px; }
.ledger-summary { --mobile-metric-decoration: none; --mobile-metric-background: var(--smis-surface); }
.equipment-list { margin-top: 20rpx; }
.equipment-list,
.equipment-list__items { display: flex; flex-direction: column; gap: 16rpx; }
.equipment-result { color: var(--smis-muted); font-size: max(13px, .8125rem); overflow-wrap: anywhere; }
.equipment.mobile-action { width: 100%; min-width: 0; margin: 0; padding: 12px; text-align: start; }
.equipment__top { display: flex; align-items: center; gap: 16rpx; }
.equipment__icon { width: 36px; height: 36px; border-radius: 10px; color: var(--smis-primary); background: var(--smis-primary-soft); }
.equipment__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.equipment__copy text { font-size: max(15px, .9375rem); font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.equipment__copy .small { margin-top: 4px; color: var(--smis-muted); font-size: max(13px, .8125rem); font-weight: 500; font-variant-numeric: tabular-nums; }
.equipment__spec { margin: 18rpx 0 0; color: var(--smis-muted); display: flex; flex-wrap: wrap; align-items: center; gap: 12rpx; font-size: max(13px, .8125rem); overflow-wrap: anywhere; }
.equipment__spec text, .equipment__location text { min-width: 0; overflow-wrap: anywhere; }
.equipment__spec .i { width: 1rpx; height: 22rpx; background: var(--smis-line); }
.equipment__location { margin-top: 18rpx; padding: 14rpx 16rpx; border-radius: 14rpx; color: var(--smis-text-secondary); background: var(--smis-control-bg); display: flex; font-size: clamp(13px, 20rpx, 14px); }
.equipment__foot { margin-top: 18rpx; padding-top: 16rpx; border-top: 1px solid var(--smis-line-subtle); color: var(--smis-muted); display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: max(13px, .8125rem); overflow-wrap: anywhere; }
.special { padding: 4px 8px; border-radius: 999rpx; color: var(--smis-text-strong); background: var(--smis-orange-soft); font-weight: 650; }
</style>
