<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import SmisIcon from './SmisIcon.vue'
import { useThemeStore } from '@/stores/theme'
import { createAmapPointMap, getCurrentGcj02Location, type AmapMapHandle, type CapturedLocation } from '@/utils/location'

const props = withDefaults(defineProps<{
  modelValue: string
  prop?: string
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}>(), {
  prop: 'location',
  label: '具体位置',
  placeholder: '例如：2号厂房南侧通道…',
  required: false,
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:locating': [value: boolean]
}>()

const theme = useThemeStore()
const locating = ref(false)
const point = ref<CapturedLocation | null>(null)
const mapLoading = ref(false)
const mapError = ref('')
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

async function locate() {
  if (locating.value || props.disabled) return
  locating.value = true
  emit('update:locating', true)
  try {
    const result = await getCurrentGcj02Location()
    point.value = result
    const fallback = `经度 ${result.longitude.toFixed(6)}，纬度 ${result.latitude.toFixed(6)}`
    emit('update:modelValue', result.locationText || fallback)
    void renderH5Map(result)
    uni.showToast({ title: '位置已采集', icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '定位失败，请稍后重试', icon: 'none', duration: 2600 })
  } finally {
    locating.value = false
    emit('update:locating', false)
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

onBeforeUnmount(() => { mapSequence++; h5Map?.destroy?.() })
</script>

<template>
  <view class="location-field">
    <view class="location-field__head">
      <view>
        <text>{{ label }}<text v-if="required" class="required-mark"> *</text></text>
        <text class="location-field__hint">可自动定位，也可以手工补充楼层和设备点位</text>
      </view>
      <wd-button
        custom-class="smis-secondary-action location-field__button"
        type="primary"
        variant="plain"
        size="small"
        :round="false"
        :loading="locating"
        :disabled="disabled || locating"
        @click="locate"
      >
        <SmisIcon v-if="!locating" name="location" size="25rpx" />
        {{ locating ? '定位中…' : '采集位置' }}
      </wd-button>
    </view>

    <wd-input
      :model-value="modelValue"
      custom-class="location-field__input"
      :prop="prop"
      :aria-label="label"
      :required="required"
      :placeholder="placeholder"
      :disabled="disabled"
      clearable
      no-border
      :maxlength="120"
      @update:model-value="emit('update:modelValue', String($event))"
    />

    <view v-if="point" class="location-field__map-shell">
      <view class="location-field__resolved">
        <view class="location-field__resolved-icon"><SmisIcon name="location" size="28rpx" /></view>
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
          <SmisIcon name="location" size="40rpx" />
          <text>{{ mapError }}</text><text class="small">定位坐标已保留，可继续填写上报</text>
          <wd-button custom-class="smis-secondary-action" :round="false" size="small" @click="point && renderH5Map(point)">重新加载地图</wd-button>
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
        <view><SmisIcon name="check" size="24rpx" />位置已采集</view>
        <text>精度 {{ point.accuracyM ? `约 ${Math.round(point.accuracyM)} 米` : '由设备提供' }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.location-field { padding: 20rpx; border-radius: var(--smis-control-radius); background: var(--smis-control-bg); }
.location-field__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.location-field__head > view { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.location-field__head text { color: var(--smis-text-secondary); font-size: 14px; font-weight: 600; }
.required-mark { color: var(--smis-danger) !important; }
.location-field__hint { margin-top: 5rpx; color: var(--smis-text-muted) !important; font-size: clamp(13px, 18rpx, 14px) !important; font-weight: 500 !important; line-height: 1.6; }
:deep(.location-field__button) { flex: none; margin: 0 !important; padding: 0 20rpx !important; }
:deep(.location-field__input) { min-height: 72rpx; margin-top: 10rpx; padding: 0 !important; background: transparent; }
:deep(.location-field__input .wd-input__value) { padding: 0; }
:deep(.location-field__input .wd-input__inner) { color: var(--smis-text); font-size: clamp(14px, 25rpx, 15px); }
.location-field__map-shell { margin-top: 12rpx; overflow: hidden; border: 1rpx solid var(--smis-control-border); border-radius: 16rpx; background: #fff; }
.location-field__resolved { padding: 16rpx; border-bottom: 1rpx solid var(--smis-line-soft); display: flex; align-items: flex-start; gap: 12rpx; }
.location-field__resolved-icon { width: 50rpx; height: 50rpx; flex: 0 0 50rpx; border-radius: 14rpx; color: var(--smis-primary); background: var(--smis-primary-soft); display: flex; align-items: center; justify-content: center; }
.location-field__resolved-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.location-field__resolved-title { color: var(--smis-text); font-size: clamp(13px, 22rpx, 14px); font-weight: 700; line-height: 1.6; }
.location-field__resolved-address { margin-top: 4rpx; color: var(--smis-text-secondary); font-size: clamp(13px, 19rpx, 14px); line-height: 1.65; }
.location-field__coordinates { margin-top: 5rpx; color: var(--smis-text-muted); font-size: clamp(13px, 17rpx, 14px); line-height: 1.35; font-variant-numeric: tabular-nums; }
.location-field__map { display: block; width: 100%; height: 230rpx; }
.location-field__map-frame { position: relative; min-height: max(300rpx, 180px); }
.location-field__map--h5 { height: max(300rpx, 180px); }
.location-field__map-state { position: absolute; inset: 0; padding: 20rpx; background: var(--smis-panel); color: var(--smis-text-secondary); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; font-size: 13px; text-align: center; line-height: 1.5; }
.location-field__map-state .small { font-size: 12px; }
.location-field__map-meta { min-height: 58rpx; padding: 0 16rpx; color: var(--smis-text-muted); display: flex; align-items: center; justify-content: space-between; gap: 12rpx; font-size: clamp(13px, 18rpx, 14px); }
.location-field__map-meta view { color: var(--smis-success); display: flex; align-items: center; gap: 6rpx; font-weight: 700; }
</style>
