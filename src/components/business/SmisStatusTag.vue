<script setup lang="ts">
import { computed } from 'vue'
import MobileStatusTag from '@mobile-core/components/MobileStatusTag.vue'
import { STATUS_LABEL } from '@/utils/format'
const props = defineProps<{ status?: string | null; label?: string }>()
const text = computed(() => props.label || STATUS_LABEL[props.status || ''] || '状态未知')
const tone = computed(() => {
  if (['completed','closed','normal','in_use','enabled','active'].includes(props.status || '')) return 'green'
  if (['overdue','abnormal','fault'].includes(props.status || '')) return 'red'
  if (['in_progress','rectifying','pending_acceptance','maintenance'].includes(props.status || '')) return 'orange'
  return 'gray'
})
</script>

<template>
  <MobileStatusTag :label="text" :tone="tone" :hide-dot="!status" />
</template>
