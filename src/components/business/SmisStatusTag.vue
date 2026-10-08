<script setup lang="ts">
import { computed } from 'vue'
import { STATUS_LABEL } from '@/utils/format'
const props = defineProps<{ status?: string | null; label?: string }>()
const text = computed(() => props.label || STATUS_LABEL[props.status || ''] || props.status || '--')
const tone = computed(() => {
  if (['completed','closed','normal','in_use','enabled','active'].includes(props.status || '')) return 'success'
  if (['overdue','abnormal','fault'].includes(props.status || '')) return 'danger'
  if (['in_progress','rectifying','pending_acceptance','maintenance'].includes(props.status || '')) return 'warning'
  return 'neutral'
})
</script>

<template>
  <view class="status-tag" :class="`status-tag--${tone}`"><text v-if="status" class="status-tag__dot" aria-hidden="true" />{{ text }}</view>
</template>
<style scoped lang="scss">
.status-tag { min-width: 96rpx; min-height: max(46rpx, 24px); padding: 4rpx 16rpx; border-radius: 999rpx; display: inline-flex; align-items: center; justify-content: center; gap: 9rpx; font-size: clamp(12px, 22rpx, 14px); font-weight: 700; line-height: 1.2; white-space: nowrap; flex: none; color: var(--smis-text-secondary); background: var(--smis-panel); }
.status-tag__dot { flex: none; width: 10rpx; height: 10rpx; border-radius: 50%; background: currentColor; opacity: .88; }
.status-tag--success { color: var(--smis-success); background: #ecfdf5; }
.status-tag--warning { color: var(--smis-warning); background: #fffbeb; }
.status-tag--danger { color: var(--smis-danger); background: #fef2f2; }
</style>
