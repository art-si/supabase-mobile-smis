<script setup lang="ts">
import MobileIcon from '@mobile-core/components/MobileIcon.vue'

defineProps<{ name: string; size?: string | number; color?: string }>()
</script>

<template>
  <MobileIcon :name="name" :size="size" :color="color" container-class="smis-icon" />
</template>
