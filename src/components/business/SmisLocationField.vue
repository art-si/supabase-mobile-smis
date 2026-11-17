<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileField from '@mobile-core/components/MobileField.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileInlineLabel from '@mobile-core/components/MobileInlineLabel.vue'
import MobileLocationFeedback from '@mobile-core/components/MobileLocationFeedback.vue'
import { revealControl } from '@mobile-core/form-focus'
import { LocationPermissionError } from '@mobile-core/location'
import { useThemeStore } from '@/stores/theme'
import { createAmapPointMap, getCurrentGcj02Location, type AmapMapHandle, type CapturedLocation } from '@/utils/location'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const props = withDefaults(defineProps<{
  modelValue: string
  error?: string
  disabled?: boolean
}>(), {
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:locating': [value: boolean]
  'permission-denied': []
}>()

const theme = useThemeStore()
const locating = ref(false)
const locationError = ref('')
const locationPermissionDenied = ref(false)
const point = ref<CapturedLocation | null>(null)
const mapLoading = ref(false)
const mapError = ref('')
let locationSequence = 0
let mapSequence = 0
const h5MapId = `smis-location-map-${Math.random().toString(36).slice(2, 10)}`
let h5Map: AmapMapHandle | undefined
const markers = computed(() => point.value ? [{
  id: 1,
  longitude: point.value.longitude,
  latitude: point.value.latitude,
  width: 28,
  height: 34,
  callout: {
    content: point.value.poiName || '隐患位置',
    color: '#ffffff',
    fontSize: 12,
    borderRadius: 12,
    bgColor: theme.mapColor,
    padding: 6,
    display: 'ALWAYS' as const
  }
}] : [])

function updateLocationText(value: string) {
  locationError.value = ''
  if (locating.value) {
    locationSequence++
    locating.value = false
    emit('update:locating', false)
  }
  if (!value.trim()) {
    point.value = null
    mapSequence++
    mapLoading.value = false
    mapError.value = ''
    h5Map?.destroy?.()
    h5Map = undefined
  }
  emit('update:modelValue', value)
}

function clearLocation() {
  updateLocationText('')
  void revealControl('report-location')
}

async function locate() {
  if (locating.value || props.disabled) return
  const sequence = ++locationSequence
  locationError.value = ''
  locationPermissionDenied.value = false
  locating.value = true
  emit('update:locating', true)
  try {
    const result = await getCurrentGcj02Location()
    if (sequence !== locationSequence) return
    point.value = result
    const fallback = `经度 ${result.longitude.toFixed(6)}，纬度 ${result.latitude.toFixed(6)}`
    emit('update:modelValue', result.locationText || fallback)
    void renderH5Map(result)
  } catch (error) {
    if (sequence !== locationSequence) return
    locationPermissionDenied.value = error instanceof LocationPermissionError
    const message = error instanceof Error ? error.message : '定位失败，请稍后重试'
    locationError.value = `${message}。也可手动填写具体位置。`
    if (locationPermissionDenied.value) emit('permission-denied')
  } finally {
    if (sequence === locationSequence) {
      locating.value = false
      emit('update:locating', false)
    }
  }
}

async function renderH5Map(result: CapturedLocation) {
  // #ifdef H5
  const sequence = ++mapSequence
  mapLoading.value = true
  mapError.value = ''
  await nextTick()
  h5Map?.destroy?.()
  h5Map = undefined
  try {
    const handle = await createAmapPointMap(h5MapId, result)
    if (sequence !== mapSequence) { handle.destroy?.(); return }
    h5Map = handle
  } catch (error) {
    if (sequence === mapSequence) mapError.value = error instanceof Error ? error.message : '地图加载失败，请重试'
  } finally {
    if (sequence === mapSequence) mapLoading.value = false
  }
  // #endif
}

onBeforeUnmount(() => { locationSequence++; mapSequence++; h5Map?.destroy?.() })
</script>

<template>
  <view class="location-field">
    <MobileField field="report-location" class="location-field__input" label="具体位置" required
      :model-value="modelValue" :error="error" :disabled="disabled" :maxlength="120"
      placeholder="例如：2 号厂房南侧通道"
      hint="可手工补充楼层、设备或局部点位。"
      @update:model-value="updateLocationText"
    />
    <view class="location-field__actions">
      <MobileAction
        class="smis-secondary-action location-field__button"
        :aria-busy="locating"
        :disabled="disabled || locating"
        @click="locate"
      >
        <view v-if="locating" class="mobile-inline-pair">
          <wd-loading size="14px" color="var(--smis-primary)" aria-hidden="true" />
          <text class="mobile-inline-pair__label">定位中…</text>
        </view>
        <MobileInlineLabel v-else icon="location" label="采集位置" />
      </MobileAction>
      <MobileAction v-if="modelValue" variant="link" class="location-field__clear" :disabled="disabled || locating" @click="clearLocation">清除位置</MobileAction>
    </view>
    <MobileLocationFeedback v-if="locationError" :message="locationError" :permission-denied="locationPermissionDenied" @permission-granted="locate" />

    <view v-if="point" class="location-field__map-shell">
      <view class="location-field__resolved mobile-inline-pair mobile-inline-pair--start">
        <view class="mobile-inline-pair__icon" aria-hidden="true">
          <view class="location-field__resolved-icon mobile-icon-box"><MobileIcon name="location" size="28rpx" /></view>
        </view>
        <view class="location-field__resolved-copy">
          <text class="location-field__resolved-title">{{ point.poiName || point.locationText || '位置已采集' }}</text>
          <text v-if="point.addressText && point.addressText !== point.poiName" class="location-field__resolved-address">{{ point.addressText }}</text>
          <text class="location-field__coordinates">{{ point.longitude.toFixed(6) }}, {{ point.latitude.toFixed(6) }}</text>
        </view>
      </view>
      <!-- #ifdef H5 -->
      <view class="location-field__map-frame">
        <div :id="h5MapId" class="location-field__map location-field__map--h5" role="img" aria-label="高德地图上的隐患位置" />
        <view v-if="mapLoading" class="location-field__map-state" role="status"><wd-loading color="var(--smis-primary)" /><text>正在加载高德地图…</text></view>
        <view v-else-if="mapError" class="location-field__map-state" role="status">
          <MobileIcon name="location" size="40rpx" />
          <text>{{ mapError }}</text><text class="small">定位坐标已保留，可继续填写上报</text>
          <MobileAction class="smis-secondary-action" @click="point && renderH5Map(point)">重新加载地图</MobileAction>
        </view>
      </view>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <map
        class="location-field__map"
        :longitude="point.longitude"
        :latitude="point.latitude"
        :markers="markers"
        :scale="16"
        show-location
        :enable-scroll="false"
        :enable-zoom="false"
      />
      <!-- #endif -->
      <view class="location-field__map-meta">
        <view class="location-field__map-status" role="status">
          <MobileInlineLabel icon="check" label="位置已采集" />
        </view>
        <text>精度 {{ point.accuracyM ? `约 ${Math.round(point.accuracyM)} 米` : '由设备提供' }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.location-field { min-width: 0; }
.location-field__actions { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.location-field__button { flex: none; padding-inline: 14px; }
.location-field__clear { --mobile-action-link-color: var(--smis-text-secondary); --mobile-action-link-font-size: max(24rpx, 13px); --mobile-action-link-padding: 0 10px; }
.location-field__map-shell { margin-top: 12rpx; overflow: hidden; border: 1rpx solid var(--smis-control-border); border-radius: 16rpx; background: #fff; }
.location-field__resolved { --mobile-inline-pair-leading: 1.6; --mobile-inline-pair-gap: 12rpx; padding: 16rpx; border-bottom: 1rpx solid var(--smis-line-soft); display: flex; font-size: clamp(13px, 22rpx, 14px); }
.location-field__resolved-icon { width: 50rpx; height: 50rpx; border-radius: 14rpx; color: var(--smis-primary); background: var(--smis-primary-soft); }
.location-field__resolved-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.location-field__resolved-title { color: var(--smis-text); font-weight: 700; line-height: inherit; }
.location-field__resolved-address { margin-top: 4rpx; color: var(--smis-text-secondary); font-size: clamp(13px, 19rpx, 14px); line-height: 1.65; }
.location-field__coordinates { margin-top: 5rpx; color: var(--smis-text-muted); font-size: clamp(13px, 17rpx, 14px); line-height: 1.35; font-variant-numeric: tabular-nums; }
.location-field__map { display: block; width: 100%; height: 230rpx; }
.location-field__map-frame { position: relative; min-height: max(300rpx, 180px); }
.location-field__map--h5 { height: max(300rpx, 180px); }
.location-field__map-state { position: absolute; inset: 0; padding: 20rpx; background: var(--smis-panel); color: var(--smis-text-secondary); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; font-size: 13px; text-align: center; line-height: 1.5; }
.location-field__map-state .small { font-size: 12px; }
.location-field__map-meta { min-height: 58rpx; padding: 0 16rpx; color: var(--smis-text-muted); display: flex; align-items: center; justify-content: space-between; gap: 12rpx; font-size: clamp(13px, 18rpx, 14px); }
.location-field__map-status { color: var(--smis-success); font-weight: 700; }
</style>
