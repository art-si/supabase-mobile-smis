<script setup lang="ts">
import SmisLoadError from '@/components/business/SmisLoadError.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import SmisIcon from '@/components/business/SmisIcon.vue'
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

function previewNameplate() {
  if (item.value?.nameplateUrl) uni.previewImage({ urls: [item.value.nameplateUrl] })
}

onLoad((query) => load(String(query?.id || '')))
</script>

<template>
<wd-config-provider :theme="themeName">
  <view class="page-shell">
    <MobileTopBar capsule="none" title="设备详情" :subtitle="item?.equipmentCode" show-back />
    <view class="page-body detail-body">
      <SmisLoadError v-if="loadError" :message="loadError" @retry="load(currentId)" />
      <view v-if="loading" class="loading"><wd-loading color="var(--smis-primary)" /></view>

      <template v-else-if="item">
        <view class="identity surface-card">
          <image v-if="item.photoUrl" :src="item.photoUrl" mode="aspectFill" />
          <view v-else class="identity__fallback"><SmisIcon name="equipment" size="52rpx" /></view>
          <view class="identity__copy">
            <view class="identity__tags">
              <SmisStatusTag :status="item.operationStatus" />
              <SmisStatusTag v-if="item.isSpecialEquipment" status="" label="特种设备" />
            </view>
            <text class="identity__name">{{ item.equipmentName }}</text>
            <text class="identity__meta">{{ item.category?.categoryName || equipmentKindLabel }} · {{ item.model || item.specification || '未录入型号' }}</text>
          </view>
        </view>

        <view class="fact-card surface-card">
          <text class="card-title">设备身份</text>
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
          <text class="card-title">责任与位置</text>
          <view class="location-panel">
            <view class="info-icon"><SmisIcon name="location" size="32rpx" /></view>
            <view>
              <text>安装位置</text>
              <text class="strong">{{ item.location?.locationName || item.detailLocation || '--' }}</text>
              <text v-if="item.location?.locationName && item.detailLocation" class="detail-location">{{ item.detailLocation }}</text>
            </view>
          </view>
          <view class="responsibility-grid">
            <view class="responsibility-item">
              <view class="info-icon"><SmisIcon name="organization" size="30rpx" /></view>
              <view><text>使用组织</text><text class="strong">{{ item.usingOrganization?.organizationName || '--' }}</text></view>
            </view>
            <view class="responsibility-item">
              <view class="info-icon"><SmisIcon name="user" size="30rpx" /></view>
              <view><text>设备责任人</text><text class="strong">{{ item.responsible?.employeeName || '--' }}</text></view>
            </view>
          </view>
        </view>

        <view class="inspect-card">
          <view><text>下次检验</text><text class="strong">{{ formatDate(item.nextInspectionDueDate) }}</text></view>
          <view><text>历史检验</text><text class="strong">{{ item.inspectionCount }} 次</text></view>
          <view><text>相关附件</text><text class="strong">{{ item.attachmentCount }} 份</text></view>
        </view>

        <view v-if="item.nameplateUrl && !nameplateFailed" class="nameplate-card surface-card">
          <view class="nameplate-card__head">
            <view><text class="card-title">设备铭牌</text><text>点击图片可查看完整信息</text></view>
            <SmisIcon name="photo" size="32rpx" />
          </view>
          <image
            class="nameplate"
            :src="item.nameplateUrl"
            mode="aspectFit"
            role="button"
            aria-label="预览设备铭牌"
            @tap="previewNameplate"
            @error="nameplateFailed = true"
          />
        </view>
      </template>

      <view v-else-if="!loadError" class="loading"><text>设备档案不存在或无权查看</text></view>
    </view>
  </view>
</wd-config-provider>
</template>

<style scoped lang="scss">
.detail-body { padding-bottom: 44rpx; }
.loading { min-height: 320rpx; color: var(--smis-text-muted); display: flex; align-items: center; justify-content: center; }
.identity { padding: 26rpx; display: flex; align-items: center; gap: 22rpx; }
.identity > image,
.identity__fallback { width: 112rpx; height: 112rpx; flex: 0 0 112rpx; border-radius: 22rpx; background: #e9f1f6; }
.identity__fallback { color: var(--smis-primary); display: flex; align-items: center; justify-content: center; }
.identity__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; justify-content: center; }
.identity__tags { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; }
.identity__name { margin-top: 12rpx; color: var(--smis-text); font-size: clamp(15px, 29rpx, 17px); font-weight: 700; line-height: 1.35; }
.identity__meta { margin-top: 7rpx; color: var(--smis-text-muted); font-size: clamp(13px, 21rpx, 14px); line-height: 1.45; }
.fact-card { margin-top: 18rpx; padding: 26rpx; }
.card-title { display: block; color: var(--smis-text); font-size: clamp(15px, 28rpx, 17px); font-weight: 700; line-height: 1.3; }
.facts { margin-top: 22rpx; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24rpx 20rpx; }
.facts > view { min-width: 0; display: flex; flex-direction: column; }
.facts text,
.location-panel text,
.responsibility-item text { color: var(--smis-text-muted); font-size: clamp(13px, 20rpx, 14px); line-height: 1.35; }
.facts .strong,
.location-panel .strong,
.responsibility-item .strong { margin-top: 7rpx; color: var(--smis-text); font-size: clamp(13px, 23rpx, 14px); font-weight: 600; line-height: 1.6; overflow-wrap: anywhere; }
.responsibility-card { overflow: hidden; }
.location-panel { margin-top: 20rpx; padding: 22rpx; border: 1rpx solid var(--smis-control-border); border-radius: 18rpx; background: var(--smis-control-bg); display: flex; align-items: center; gap: 16rpx; }
.location-panel > view:last-child,
.responsibility-item > view:last-child { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.detail-location { margin-top: 5rpx; font-size: clamp(13px, 19rpx, 14px) !important; }
.responsibility-grid { margin-top: 16rpx; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; }
.responsibility-item { min-width: 0; padding: 20rpx; border: 0; background: var(--smis-panel); border-radius: 18rpx; display: flex; align-items: center; gap: 14rpx; }
.info-icon { width: 54rpx; height: 54rpx; flex: 0 0 54rpx; border-radius: 16rpx; color: var(--smis-primary); background: var(--smis-primary-soft); display: flex; align-items: center; justify-content: center; }
.inspect-card { margin-top: 18rpx; padding: 25rpx 14rpx; border-radius: 22rpx; color: #fff; background: var(--smis-hero-gradient); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.inspect-card > view { min-width: 0; display: flex; flex-direction: column; align-items: center; }
.inspect-card > view + view { border-left: 1rpx solid rgba(255, 255, 255, .14); }
.inspect-card text { font-size: clamp(13px, 19rpx, 14px); line-height: 1.3; opacity: .88; }
.inspect-card .strong { max-width: 100%; margin-top: 9rpx; font-size: clamp(13px, 22rpx, 14px); font-weight: 700; line-height: 1.25; text-align: center; opacity: 1; overflow-wrap: anywhere; }
.nameplate-card { margin-top: 18rpx; padding: 26rpx; overflow: hidden; }
.nameplate-card__head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; color: var(--smis-primary); }
.nameplate-card__head > view { min-width: 0; display: flex; flex-direction: column; }
.nameplate-card__head .card-title { margin: 0; }
.nameplate-card__head text:last-child { margin-top: 5rpx; color: var(--smis-text-muted); font-size: clamp(13px, 19rpx, 14px); }
.nameplate { width: 100%; height: 360rpx; margin-top: 20rpx; border-radius: 18rpx; background: var(--smis-control-bg); display: block; }

@media screen and (max-width: 350px) {
  .responsibility-grid { grid-template-columns: 1fr; }
}
</style>
