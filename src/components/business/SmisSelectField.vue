<script setup lang="ts">
import { computed, ref } from 'vue'
const props = withDefaults(defineProps<{
  customClass?: string
  modelValue: string
  label: string
  title: string
  prop: string
  columns: Array<{ value: string; label: string }>
  placeholder?: string
  disabled?: boolean
  required?: boolean
}>(), { customClass: '', placeholder: '请选择…', disabled: false, required: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const visible = ref(false)
const selectedLabel = computed(() => props.columns.find(item => item.value === props.modelValue)?.label || '')
</script>
<template>
  <wd-form-item :title="label" :prop="prop" :required="required" :value="selectedLabel" :placeholder="placeholder" :disabled="disabled" is-link :custom-class="`smis-select-field ${customClass}`" layout="vertical" value-align="left" :ellipsis="false" role="button" :aria-label="label" tabindex="0" @keydown.enter="!disabled && (visible = true)" @keydown.space.prevent="!disabled && (visible = true)" @click="!disabled && (visible = true)" />
  <view>
    <wd-picker :model-value="modelValue ? [modelValue] : []" v-model:visible="visible" :columns="columns" :title="title" root-portal :z-index="80" @update:model-value="emit('update:modelValue', String($event[0] ?? ''))" />
  </view>
</template>
<style scoped lang="scss">
:deep(.smis-select-field) { min-height: max(120rpx, 64px); padding: 22rpx !important; border: 1rpx solid var(--smis-control-border); border-radius: var(--smis-control-radius); background: var(--smis-control-bg); }
:deep(.smis-select-field .wd-cell__title) { font-size: 14px; color: var(--smis-text); font-weight: 600; }
:deep(.smis-select-field .wd-cell__value) { font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
</style>
