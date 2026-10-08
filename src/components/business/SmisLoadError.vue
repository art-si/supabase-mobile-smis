<script setup lang="ts">
defineProps<{ message: string }>()
const emit = defineEmits<{ retry: [] }>()
</script>
<template>
  <view class="load-error" role="alert">
    <view><text class="load-error__title">暂时无法读取数据</text><text>{{ message }}</text></view>
    <wd-button custom-class="load-error__retry" variant="plain" :round="false" @click="emit('retry')">重试</wd-button>
  </view>
</template>
<style scoped lang="scss">
.load-error { margin-bottom: 24rpx; padding: 24rpx; display: flex; align-items: center; gap: 16rpx; border: 1rpx solid #f3d6b0; border-radius: var(--smis-radius-md); background: #fff8ed; color: #8b5712; font-size: clamp(14px, 24rpx, 15px); line-height: 1.5; }
.load-error > view { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow-wrap: anywhere; }
.load-error__title { font-weight: 600; }
:deep(.load-error__retry) { flex: none; min-width: 44px; min-height: 44px; }
</style>
