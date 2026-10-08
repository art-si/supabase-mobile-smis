<script setup lang="ts">
import SmisIcon from './SmisIcon.vue'
import SmisStatusTag from './SmisStatusTag.vue'

defineProps<{
  title: string
  code: string
  status: string
  place?: string
  start?: string
  end?: string
  progress?: string
  dangerCount?: number
}>()
defineEmits<{ tap: [] }>()
</script>

<template>
  <button class="card" :class="`card--${status}`" @tap="$emit('tap')">
    <view class="card__identity"><text class="card__code">{{ code }}</text><SmisStatusTag :status="status" /></view>
    <view class="card__head">
      <view class="card__title-wrap">
        <view class="card__heading">
          <text class="card__title line-clamp-2">{{ title }}</text>
                  </view>
      </view>
    </view>
    <view v-if="place" class="card__meta">
      <SmisIcon name="location" size="28rpx" />
      <text class="line-clamp-2">{{ place }}</text>
    </view>
    <view class="card__foot">
      <text>{{ start }}{{ end ? `${start ? ' — ' : '截止 '}${end}` : '' }}</text>
      <text v-if="dangerCount" class="card__danger">{{ dangerCount }} 项异常</text>
      <text v-else-if="progress" class="card__progress">{{ progress }}</text>
      <SmisIcon name="chevron" size="28rpx" />
    </view>
  </button>
</template>

<style scoped lang="scss">
.card { width: 100%; margin: 0; padding: 24rpx; text-align: left; border-radius: var(--smis-radius-lg); background: #fff; box-shadow: var(--smis-shadow-card); border: 1rpx solid var(--smis-line-soft); }
.card__head { display: flex; align-items: flex-start; gap: 20rpx; }
.card__title-wrap { min-width: 0; flex: 1; display: flex; gap: 16rpx; }
.card__heading { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.card__title { color: var(--smis-text); font-size: clamp(15px, 29rpx, 17px); line-height: 1.5; font-weight: 700; text-wrap: pretty; }
.card__code { margin-top: 9rpx; color: var(--smis-text-muted); font-size: clamp(13px, 20rpx, 14px); font-variant-numeric: tabular-nums; }
.card__meta { margin-top: 16rpx; padding: 14rpx 16rpx; border-radius: 14rpx; color: var(--smis-text-secondary); background: var(--smis-control-bg); display: flex; align-items: center; gap: 10rpx; font-size: clamp(13px, 22rpx, 14px); }
.card__foot { margin-top: 18rpx; padding-top: 18rpx; border-top: 1rpx solid var(--smis-line-soft); color: var(--smis-text-muted); font-size: clamp(13px, 20rpx, 14px); display: flex; align-items: center; gap: 10rpx; }
.card__foot > text:first-child { min-width: 0; flex: 1; overflow-wrap: anywhere; line-height: 1.5; font-variant-numeric: tabular-nums; }
.card__danger { flex: 0 0 auto; color: var(--smis-danger); font-weight: 700; }
.card__progress { flex: 0 0 auto; color: var(--smis-text-secondary); font-weight: 700; }
.card__identity { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-bottom: 14rpx; }
.card__identity .card__code { min-width: 0; margin: 0; overflow-wrap: anywhere; }
</style>
