<script setup lang="ts">
import SmisMetricGrid from '@/components/business/SmisMetricGrid.vue'
import SmisLoadError from '@/components/business/SmisLoadError.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import SmisTopBar from '@/components/business/SmisTopBar.vue'
import SmisIcon from '@/components/business/SmisIcon.vue'
import SmisStatusTag from '@/components/business/SmisStatusTag.vue'
import SmisEmpty from '@/components/business/SmisEmpty.vue'
import SmisSearchBar from '@/components/business/SmisSearchBar.vue'
import SmisListFooter from '@/components/business/SmisListFooter.vue'
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
const rows = ref<Equipment[]>([])
const total = ref(0)
const loadError = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const overview = ref<EquipmentOverview>({ total: 0, inUse: 0, boilerCount: 0, dueSoon: 0 })
const finished = computed(() => rows.value.length >= total.value)

async function load(reset = true) {
  if (loading.value || loadingMore.value || !(await auth.ensureValidSession())) return
  reset ? (loading.value = true) : (loadingMore.value = true)
  const from = reset ? 0 : rows.value.length
  loadError.value = ''
  try {
    const data = await listEquipment(auth.token, { keyword: keyword.value, from, to: from + PAGE_SIZE - 1 })
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

function label(value: string, typeCodes: string[]) {
  const text = dictionary.labelAny(typeCodes, value, value)
  return text === value ? STATUS_LABEL[value] || value : text
}
function openDetail(id: string) { uni.navigateTo({ url: `/pages/equipment/detail?id=${id}` }) }

onShow(() => load(true))
onLoad(() => dictionary.load(auth.token))
onPullDownRefresh(() => load(true))
onReachBottom(() => { if (!finished.value) void load(false) })
</script>

<template>
<wd-config-provider :theme="themeName">
  <view class="page-shell">
    <SmisTopBar title="设备台账" eyebrow="EQUIPMENT LEDGER" subtitle="状态、位置与检验周期" show-back />
    <view class="page-body ledger-body">
      <SmisLoadError v-if="loadError" :message="loadError" @retry="load()" />
      <SmisMetricGrid :items="[{ label: '设备总数', value: overview.total }, { label: '在用', value: overview.inUse }, { label: '临近检验', value: overview.dueSoon, tone: 'warning' }]" />

      <SmisSearchBar v-model="keyword" class="ledger-search" placeholder="设备编号 / 名称 / 型号" action-label="查询" :disabled="loading" @search="load(true)" />

      <view v-if="loading" class="loading"><wd-loading color="var(--smis-primary)" /><text>正在读取设备档案…</text></view>
      <view v-else-if="rows.length" class="equipment-list">
        <button v-for="item in rows" :key="item.id" class="equipment surface-card" @tap="openDetail(item.id)">
          <view class="equipment__top">
            <view class="equipment__icon"><SmisIcon name="equipment" size="40rpx" /></view>
            <view class="equipment__copy"><text class="line-clamp-2">{{ item.equipmentName }}</text><text class="small">{{ item.equipmentCode }}</text></view>
          </view>
          <view class="equipment__spec"><text>{{ item.category?.categoryName || label(item.equipmentKind, ['smisEquipmentKind']) }}</text><view class="i" /><text>{{ item.model || item.specification || '型号未录入' }}</text></view>
          <view class="equipment__location"><SmisIcon name="location" size="28rpx" /><text class="line-clamp-2">{{ item.location?.locationName || item.detailLocation || '位置未录入' }}</text></view>
          <view class="equipment__foot"><SmisStatusTag :status="item.operationStatus" /><text>{{ label(item.useStatus, ['smisEquipmentUseStatus']) }}</text><text v-if="item.isSpecialEquipment" class="special">特种设备</text><SmisIcon name="chevron" size="28rpx" /></view>
        </button>
        <SmisListFooter :loading="loadingMore" :finished="finished" :count="rows.length" />
      </view>
      <SmisEmpty v-else-if="!loadError" title="未找到设备" description="请调整关键词或在 Web 端维护设备档案" />
    </view>
  </view>
</wd-config-provider>
</template>

<style scoped lang="scss">
.ledger-body { padding-bottom: 50rpx; }
.ledger-search { margin-top: 20rpx; }
.loading { height: 320rpx; color: var(--smis-text-secondary); display: flex; align-items: center; justify-content: center; gap: 14rpx; font-size: clamp(13px, 20rpx, 14px); }
.equipment-list { margin-top: 20rpx; display: flex; flex-direction: column; gap: 16rpx; }
.equipment { width: 100%; min-width: 0; margin: 0; padding: 24rpx; text-align: left; overflow: hidden; }
.equipment__top { display: flex; align-items: flex-start; gap: 16rpx; }
.equipment__icon { width: 64rpx; height: 64rpx; flex: 0 0 64rpx; border-radius: 19rpx; color: var(--smis-primary); background: var(--smis-primary-soft); display: flex; align-items: center; justify-content: center; }
.equipment__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.equipment__copy text { font-size: clamp(14px, 26rpx, 15px); font-weight: 700; line-height: 1.4; }
.equipment__copy .small { margin-top: 4rpx; color: var(--smis-text-muted); font-size: clamp(13px, 18rpx, 14px); font-weight: 500; }
.equipment__spec { margin: 18rpx 0 0; color: var(--smis-text-secondary); display: flex; flex-wrap: wrap; align-items: center; gap: 12rpx; font-size: clamp(13px, 20rpx, 14px); }
.equipment__spec .i { width: 1rpx; height: 22rpx; background: var(--smis-line); }
.equipment__location { margin-top: 18rpx; padding: 14rpx 16rpx; border-radius: 14rpx; color: var(--smis-text-secondary); background: var(--smis-control-bg); display: flex; align-items: center; gap: 9rpx; font-size: clamp(13px, 20rpx, 14px); }
.equipment__foot { margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid var(--smis-line); color: var(--smis-text-muted); display: flex; flex-wrap: wrap; align-items: center; gap: 10rpx; font-size: clamp(13px, 18rpx, 14px); }
.equipment__foot > text:not(.special) { flex: 1; }
.special { flex: none; }
.special { padding: 7rpx 12rpx; border-radius: 999rpx; color: var(--smis-warning); background: #fff1df; font-weight: 700; }
</style>
