<script setup lang="ts">
import { activateActionKey, preventActionKey } from '@mobile-core/action-keyboard'
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileImagePreview from '@mobile-core/components/MobileImagePreview.vue'
import MobileMetricGrid from '@mobile-core/components/MobileMetricGrid.vue'
import SmisStatusTag from '@/components/business/SmisStatusTag.vue'
import { useAuthStore } from '@/stores/auth'
import { useDictionaryStore } from '@/stores/dictionary'
import { getEquipment } from '@/api/smis'
import type { Equipment } from '@/api/types'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

const { themeName } = usePageTheme()

const auth = useAuthStore()
const dictionary = useDictionaryStore()
const item = ref<Equipment | null>(null)
const currentId = ref('')
const loadError = ref('')
const loading = ref(true)
const nameplateFailed = ref(false)

const equipmentKindLabel = computed(() => dictionary.labelAny(
  ['smisEquipmentKind'], item.value?.equipmentKind, item.value?.equipmentKind || '--'
))
const importanceLevelLabel = computed(() => dictionary.labelAny(
  ['smisEquipmentImportanceLevel'], item.value?.importanceLevel, item.value?.importanceLevel || '--'
))

async function load(id: string) {
  currentId.value = id
  if (!(await auth.ensureValidSession())) return
  loading.value = true
  nameplateFailed.value = false
  loadError.value = ''
  try {
    const [equipment] = await Promise.all([
      getEquipment(auth.token, id),
      dictionary.load(auth.token).catch(() => undefined)
    ])
    item.value = equipment
  } catch (error) {
    loadError.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const nameplateViewer = ref<InstanceType<typeof MobileImagePreview>>()
function previewNameplate(event: Event) {
  if (item.value?.nameplateUrl) nameplateViewer.value?.open([item.value.nameplateUrl], '设备铭牌', 0, event)
}

onLoad((query) => load(String(query?.id || '')))
</script>

<template>
<wd-config-provider :theme="themeName">
  <MobileWorkspace container-class="page-shell">
    <MobileTopBar capsule="always" title="设备详情" :subtitle="item?.equipmentCode" show-back />
    <view class="page-body detail-body" role="main">
      <MobileLoadError v-if="loadError" :message="loadError" @retry="load(currentId)" />
      <view v-if="loading" class="loading"><wd-loading color="var(--smis-primary)" /></view>

      <template v-else-if="item">
        <view class="identity surface-card">
          <image v-if="item.photoUrl" :src="item.photoUrl" mode="aspectFill" />
          <view v-else class="identity__fallback mobile-icon-box"><MobileIcon name="equipment" size="52rpx" /></view>
          <view class="identity__copy">
            <view class="identity__tags">
              <SmisStatusTag :status="item.operationStatus" />
              <SmisStatusTag v-if="item.isSpecialEquipment" status="" label="特种设备" />
            </view>
            <text class="identity__name" role="heading" aria-level="2">{{ item.equipmentName || '未命名设备' }}</text>
            <text class="identity__meta">{{ item.category?.categoryName || equipmentKindLabel }} · {{ item.model || item.specification || '未录入型号' }}</text>
          </view>
        </view>

        <view class="fact-card surface-card">
          <text class="card-title" role="heading" aria-level="2">设备身份</text>
          <view class="facts">
            <view><text>设备编号</text><text class="strong">{{ item.equipmentCode }}</text></view>
            <view><text>出厂编号</text><text class="strong">{{ item.factoryNo || '--' }}</text></view>
            <view><text>注册代码</text><text class="strong">{{ item.registrationCode || '--' }}</text></view>
            <view><text>制造厂家</text><text class="strong">{{ item.manufacturer || '--' }}</text></view>
            <view><text>启用日期</text><text class="strong">{{ formatDate(item.enableDate) }}</text></view>
            <view><text>重要等级</text><text class="strong">{{ importanceLevelLabel }}</text></view>
          </view>
        </view>

        <view class="fact-card responsibility-card surface-card">
          <text class="card-title" role="heading" aria-level="2">责任与位置</text>
          <view class="location-panel">
            <view class="info-icon mobile-icon-box"><MobileIcon name="location" size="32rpx" /></view>
            <view>
              <text>安装位置</text>
              <text class="strong">{{ item.location?.locationName || item.detailLocation || '--' }}</text>
              <text v-if="item.location?.locationName && item.detailLocation" class="detail-location">{{ item.detailLocation }}</text>
            </view>
          </view>
          <view class="responsibility-grid">
            <view class="responsibility-item">
              <view class="info-icon mobile-icon-box"><MobileIcon name="organization" size="30rpx" /></view>
              <view><text>使用组织</text><text class="strong">{{ item.usingOrganization?.organizationName || '--' }}</text></view>
            </view>
            <view class="responsibility-item">
              <view class="info-icon mobile-icon-box"><MobileIcon name="user" size="30rpx" /></view>
              <view><text>设备责任人</text><text class="strong">{{ item.responsible?.employeeName || '--' }}</text></view>
            </view>
          </view>
        </view>

        <view class="inspection-summary surface-card">
          <text class="card-title" role="heading" aria-level="2">检验与附件</text>
          <MobileMetricGrid summary :items="[
            { label: '下次检验', value: formatDate(item.nextInspectionDueDate), emphasis: true },
            { label: '历史检验', value: item.inspectionCount, unit: '次' },
            { label: '相关附件', value: item.attachmentCount, unit: '份' }
          ]" />
        </view>

        <view v-if="item.nameplateUrl && !nameplateFailed" class="nameplate-card surface-card">
          <view class="nameplate-card__head">
            <view><text class="card-title" role="heading" aria-level="2">设备铭牌</text><text>点击图片可查看完整信息</text></view>
            <MobileIcon name="photo" size="32rpx" />
          </view>
          <button
            class="mobile-action nameplate"
            role="button"
            tabindex="0"
            aria-label="预览设备铭牌"
            hover-class="mobile-action--pressed"
            @click="previewNameplate"
            @keydown="preventActionKey"
            @keyup="activateActionKey($event, () => previewNameplate($event))"
          >
            <image class="nameplate__image" :src="item.nameplateUrl" mode="aspectFit" aria-hidden="true" @error="nameplateFailed = true" />
          </button>
          <MobileImagePreview ref="nameplateViewer" />
        </view>
      </template>

      <view v-else-if="!loadError" class="loading"><text>设备档案不存在或无权查看</text></view>
    </view>
  </MobileWorkspace>
</wd-config-provider>
</template>

<style scoped lang="scss">
@use '@mobile-core/styles/form.scss' as form;

.loading { min-height: 320rpx; color: var(--smis-text-muted); display: flex; align-items: center; justify-content: center; }
.identity { padding: 26rpx; display: flex; flex-wrap: wrap; align-items: center; gap: 22rpx; }
.identity > image,
.identity__fallback { width: 112rpx; height: 112rpx; border-radius: 22rpx; background: #e9f1f6; }
.identity > image { flex: none; }
.identity__fallback { color: var(--smis-primary); }
.identity__copy { min-width: 0; flex: 1 1 max(160px, 10rem); display: flex; flex-direction: column; justify-content: center; }
.identity__tags { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; }
.identity__name { margin-top: 12rpx; color: var(--smis-text); font-size: max(17px, 1.0625rem); font-weight: 700; line-height: 1.4; }
.identity__meta { margin-top: 7rpx; color: var(--smis-text-muted); font-size: max(13px, .8125rem); line-height: 1.5; }
.fact-card { margin-top: 18rpx; padding: 26rpx; }
.card-title { display: block; color: var(--smis-text); font-size: max(15px, .9375rem); font-weight: 700; line-height: 1.4; }
.facts { margin-top: 16px; @include form.field-grid($min-width: 128px, $gap: 16px); }
.facts > view { min-width: 0; display: flex; flex-direction: column; }
.facts text,
.location-panel text,
.responsibility-item text { color: var(--smis-text-muted); font-size: max(13px, .8125rem); line-height: 1.5; }
.facts .strong,
.location-panel .strong,
.responsibility-item .strong { margin-top: 7rpx; color: var(--smis-text); font-size: max(14px, .875rem); font-weight: 600; line-height: 1.6; overflow-wrap: anywhere; }
.responsibility-card { overflow: hidden; }
.location-panel { margin-top: 20rpx; padding: 22rpx; border: 1rpx solid var(--smis-control-border); border-radius: 18rpx; background: var(--smis-control-bg); display: flex; align-items: center; gap: 16rpx; }
.location-panel > view:last-child,
.responsibility-item > view:last-child { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.detail-location { margin-top: 5rpx; }
.responsibility-grid { margin-top: 12px; @include form.field-grid($min-width: 128px); }
.responsibility-item { min-width: 0; padding: 20rpx; border: 0; background: var(--smis-panel); border-radius: 18rpx; display: flex; align-items: center; gap: 14rpx; }
.info-icon { width: 54rpx; height: 54rpx; border-radius: 16rpx; color: var(--smis-primary); background: var(--smis-primary-soft); }
.inspection-summary { margin-top: 18rpx; }
.inspection-summary > .card-title { padding: 16px; }
.nameplate-card { margin-top: 18rpx; padding: 26rpx; overflow: hidden; }
.nameplate-card__head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; color: var(--smis-primary); }
.nameplate-card__head > view { min-width: 0; display: flex; flex-direction: column; }
.nameplate-card__head .card-title { margin: 0; }
.nameplate-card__head text:last-child { margin-top: 5rpx; color: var(--smis-text-muted); font-size: max(13px, .8125rem); line-height: 1.5; }
.nameplate.mobile-action { width: 100%; height: 360rpx; margin-top: 20rpx; border-radius: 18rpx; background: var(--smis-control-bg); display: block; overflow: hidden; }
.nameplate__image { display: block; width: 100%; height: 100%; }

</style>
