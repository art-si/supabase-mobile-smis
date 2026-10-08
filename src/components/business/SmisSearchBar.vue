<script setup lang="ts">
import SmisIcon from './SmisIcon.vue'

withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  actionLabel?: string
  disabled?: boolean
  embedded?: boolean
}>(), { placeholder: '请输入关键词…', actionLabel: '', disabled: false, embedded: false })

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: []
}>()
</script>

<template>
  <view class="smis-search" :class="{ 'surface-card': !embedded, 'smis-search--embedded': embedded }">
    <view class="smis-search__icon"><SmisIcon name="search" size="29rpx" /></view>
    <view class="smis-search__field">
      <wd-input
        :model-value="modelValue"
        custom-class="smis-search__input"
        type="text"
        :aria-label="placeholder"
        :placeholder="placeholder"
        :disabled="disabled"
        clearable
        no-border
        confirm-type="search"
        @update:model-value="emit('update:modelValue', String($event))"
        @confirm="emit('search')"
        @clear="emit('search')"
      />
    </view>
    <view v-if="actionLabel" class="smis-search__action-wrap">
      <wd-button
        custom-class="smis-search__action"
        type="primary"
        size="small"
        :round="false"
        :disabled="disabled"
        @click="emit('search')"
      >{{ actionLabel }}</wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.smis-search { width: 100%; min-height: 52px; height: 52px; padding: 4px 4px 4px 12px; color: var(--smis-text-muted); display: flex; align-items: center; gap: 8px; overflow: hidden; }
.smis-search--embedded { border: 1rpx solid var(--smis-control-border); border-radius: var(--smis-control-radius); background: var(--smis-control-bg); box-shadow: none; }
.smis-search__icon { width: 20px; height: 20px; flex: none; display: flex; align-items: center; justify-content: center; }
.smis-search__field { min-width: 0; height: 44px; flex: 1; display: flex; align-items: center; }
.smis-search__action-wrap { width: 62px; height: 44px; flex: none; display: flex; align-items: center; justify-content: center; }
.smis-search__field :deep(.wd-input),
:deep(.smis-search__input) { width: 100% !important; min-width: 0; height: 44px; min-height: 44px; padding: 0 !important; background: transparent !important; }
:deep(.smis-search__input .wd-input__value) { width: 100%; height: 44px; min-height: 44px; padding: 0 !important; display: flex; align-items: center; }
:deep(.smis-search__input .wd-input__inner) { width: 100%; height: 44px; color: var(--smis-text); font-size: 14px; line-height: 44px; }
:deep(.smis-search__input .wd-input__placeholder) { line-height: 44px; }
// A Wot small button surface sits inside a 44px touch target.
:deep(.smis-search__action) { width: 62px !important; min-width: 44px !important; height: 44px !important; min-height: 44px !important; margin: 0 !important; padding: 0 4px !important; border: 0 !important; border-radius: var(--smis-control-radius) !important; background: transparent !important; color: #fff !important; font-size: 13px !important; font-weight: 600 !important; line-height: 1.2 !important; display: flex !important; align-items: center !important; justify-content: center !important; }
:deep(.smis-search__action .wd-button__content) { width: 100%; height: var(--wot-button-height-small, 32px); min-height: 32px; border-radius: 8px; background: var(--smis-primary-gradient); display: flex; align-items: center; justify-content: center; }
:deep(.smis-search__action.is-disabled .wd-button__content) { opacity: .6; }
</style>
