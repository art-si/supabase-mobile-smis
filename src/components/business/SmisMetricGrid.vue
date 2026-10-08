<script setup lang="ts">
defineProps<{ items: Array<{ label: string; value: number | string; tone?: 'danger' | 'warning' }> }>()
</script>
<template>
  <view class="metric-grid">
    <view v-for="item in items" :key="item.label" class="metric" :class="item.tone ? `metric--${item.tone}` : ''">
      <text class="metric__label">{{ item.label }}</text>
      <text class="metric__value">{{ item.value }}</text>
    </view>
  </view>
</template>
<style scoped lang="scss">
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.metric {
  position: relative;
  min-width: 0;
  min-height: 136rpx;
  padding: 22rpx 14rpx;
  overflow: hidden;
  border: 1rpx solid #e5eaf2;
  border-radius: 20rpx;
  background: linear-gradient(150deg, #ffffff 0%, var(--smis-primary-soft) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 13rpx;
}

.metric::before {
  position: absolute;
  top: 0;
  left: 22rpx;
  right: 22rpx;
  height: 5rpx;
  content: '';
  border-radius: 0 0 999rpx 999rpx;
  background: linear-gradient(90deg, var(--smis-primary), var(--smis-primary-bright));
  opacity: 0.72;
}

.metric__label {
  min-width: 0;
  max-width: 100%;
  color: var(--smis-text-secondary);
  font-size: clamp(13px, 24rpx, 14px);
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  overflow-wrap: anywhere;
}

.metric__value {
  color: #172033;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  font-size: clamp(22px, 34rpx, 25px);
  font-weight: 700;
  display: flex;
  align-items: flex-end;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.metric-grid__unit {
  margin-left: 4rpx;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.1;
}
.metric--danger .metric__value { color: var(--smis-danger); }
.metric--warning .metric__value { color: var(--smis-warning); }
</style>
