<script setup lang="ts">
import { activateActionKey, preventActionKey } from '@mobile-core/action-keyboard'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import SmisStatusTag from './SmisStatusTag.vue'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

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
const emit = defineEmits<{ click: [] }>()
const open = () => emit('click')
</script>

<template>
  <button class="mobile-action card" :class="`card--${status}`" role="button" tabindex="0"
    hover-class="mobile-action--pressed" @click="open" @keydown="preventActionKey" @keyup="activateActionKey($event, open)"
  >
    <view class="card__identity mobile-card-identity"><text class="card__code mobile-card-identity__main" translate="no">{{ code }}</text><SmisStatusTag :status="status" /></view>
    <text class="card__title line-clamp-2">{{ title }}</text>
    <view v-if="place" class="card__meta mobile-inline-pair mobile-inline-pair--start">
      <view class="mobile-inline-pair__icon" aria-hidden="true"><MobileIcon name="location" size="1em" align-to-label /></view>
      <text class="line-clamp-2">{{ place }}</text>
    </view>
    <view class="card__foot">
      <text class="card__date">{{ start }}{{ end ? `${start ? ' — ' : '截止 '}${end}` : '' }}</text>
      <text v-if="dangerCount" class="card__danger">{{ dangerCount }} 项异常</text>
      <text v-else-if="progress" class="card__progress">{{ progress }}</text>
      <MobileIcon name="chevron" size="28rpx" />
    </view>
  </button>
</template>

<style scoped lang="scss">
.card.mobile-action { width: 100%; margin: 0; padding: 24rpx; text-align: start; border-radius: var(--smis-radius-lg); background: var(--smis-surface); box-shadow: var(--smis-shadow-card); border: 1rpx solid var(--smis-line-soft); }
.card__title { color: var(--smis-text); font-size: clamp(15px, 29rpx, 17px); line-height: 1.5; font-weight: 700; text-wrap: pretty; overflow-wrap: anywhere; }
.card__code { color: var(--smis-text-muted); font-size: max(13px, .8125rem); }
.card__meta { margin-top: 16rpx; padding: 14rpx 16rpx; border-radius: 14rpx; color: var(--smis-text-secondary); background: var(--smis-control-bg); display: flex; font-size: clamp(13px, 22rpx, 14px); }
.card__foot { margin-top: 18rpx; padding-top: 18rpx; border-top: 1rpx solid var(--smis-line-soft); color: var(--smis-text-muted); font-size: clamp(13px, 20rpx, 14px); display: flex; align-items: center; gap: 10rpx; }
.card__date { min-width: 0; flex: 1; overflow-wrap: anywhere; line-height: 1.5; font-variant-numeric: tabular-nums; }
.card__danger { flex: 0 0 auto; color: var(--smis-danger); font-weight: 700; }
.card__progress { flex: 0 0 auto; color: var(--smis-text-secondary); font-weight: 700; }
.card__identity { margin-bottom: 14rpx; }
</style>
