<script setup lang="ts">
import MobileBottomNav from '@mobile-core/components/MobileBottomNav.vue'

type NavKey = 'home' | 'messages' | 'quick' | 'workbench' | 'mine'
defineProps<{ active: NavKey }>()

const items = [
  { key: 'home', label: '首页', icon: 'home', url: '/pages/home/index' },
  { key: 'messages', label: '消息', icon: 'message', url: '/pages/messages/index' },
  { key: 'quick', label: '随手拍', icon: 'camera', url: '/pages/quick-report/index', prominent: true },
  { key: 'workbench', label: '工作台', icon: 'work', url: '/pages/workbench/index' },
  { key: 'mine', label: '我的', icon: 'user', url: '/pages/mine/index' }
] as const
</script>

<template>
  <MobileBottomNav :active="active" :items="items" />
</template>
