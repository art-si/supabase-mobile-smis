<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  label?: string
  hint?: string
  placeholder?: string
  maxlength?: number
  prop?: string
  required?: boolean
  disabled?: boolean
  compact?: boolean
}>(), {
  label: '',
  hint: '',
  placeholder: '请输入…',
  maxlength: 500,
  prop: '',
  required: false,
  disabled: false,
  compact: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const model = computed({
  get: () => props.modelValue || '',
  set: (value: string | number) => emit('update:modelValue', String(value))
})
</script>

<template>
  <view class="smis-textarea-field" :class="{ 'smis-textarea-field--compact': compact }">
    <view v-if="label || hint" class="smis-textarea-field__head">
      <text v-if="label" class="smis-textarea-field__label">
        {{ label }}<text v-if="required" class="required-mark"> *</text>
      </text>
      <text v-if="hint" class="smis-textarea-field__hint">{{ hint }}</text>
    </view>
    <textarea
      v-model="model"
      class="smis-textarea-field__input"
      :name="prop"
      :aria-label="label || placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      :placeholder="placeholder"
    />
    <text class="smis-textarea-field__count">{{ model.length }}/{{ maxlength }}</text>
  </view>
</template>

<style scoped lang="scss">
.smis-textarea-field {
  position: relative;
  box-sizing: border-box;
  padding: 18rpx 18rpx 16rpx;
  overflow: hidden;
  border: 1rpx solid var(--smis-control-border);
  border-radius: var(--smis-control-radius);
  background: var(--smis-control-bg);
  transition:
    border-color 160ms cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 160ms cubic-bezier(0.23, 1, 0.32, 1);
}

.smis-textarea-field:focus-within {
  border-color: rgba(var(--smis-primary-rgb), 0.48);
  box-shadow: 0 0 0 5rpx rgba(var(--smis-primary-rgb), 0.09);
}

.smis-textarea-field__head {
  min-width: 0;
  margin-bottom: 10rpx;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16rpx;
}

.smis-textarea-field__label {
  min-width: 0;
  color: var(--smis-text);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}

.required-mark { color: var(--smis-danger); }

.smis-textarea-field__hint {
  flex: 0 1 auto;
  overflow: hidden;
  color: var(--smis-text-muted);
  font-size: clamp(13px, 17rpx, 14px);
  line-height: 1.35;
  text-align: right;
  overflow-wrap: anywhere;
}

.smis-textarea-field__input {
  display: block;
  width: 100%;
  height: max(180rpx, 100px);
  min-height: max(180rpx, 100px);
  margin: 0;
  padding: 0 0 34rpx;
  border: 0;
  color: var(--smis-text);
  background: transparent;
  font-family: inherit;
  font-size: clamp(14px, 26rpx, 15px);
  line-height: 1.55;
  resize: none;
  outline: none;
}

.smis-textarea-field__count {
  position: absolute;
  right: 18rpx;
  bottom: 15rpx;
  color: var(--smis-text-muted);
  font-size: clamp(13px, 17rpx, 14px);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.smis-textarea-field--compact .smis-textarea-field__input {
  height: max(140rpx, 80px);
  min-height: max(140rpx, 80px);
}
</style>
