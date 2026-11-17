<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { activateActionKey, preventActionKey } from '@mobile-core/action-keyboard'
import MobileEvidence from '@mobile-core/components/MobileEvidence.vue'
import MobileInlineLabel from '@mobile-core/components/MobileInlineLabel.vue'
import { getErrorMessage, uploadFile } from '@/api/supabase'
import { chooseImages } from '@mobile-core/files'

type EvidenceStatus = 'ready' | 'uploading' | 'failed'

interface EvidenceItem {
  id: string
  url: string
  localPath?: string
  remoteUrl?: string
  status: EvidenceStatus
  error?: string
}

const props = withDefaults(defineProps<{
  modelValue: string[]
  token: string
  folder: string
  title?: string
  description?: string
  max?: number
  required?: boolean
  disabled?: boolean
}>(), {
  title: '现场照片',
  description: '请拍摄清晰完整的现场环境与问题细节',
  max: 6,
  required: false,
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'update:uploading': [value: boolean]
}>()

const items = ref<EvidenceItem[]>([])
const choosing = ref(false)
const pickerError = ref('')
const evidenceError = computed(() => pickerError.value || items.value.find((item) => item.status === 'failed')?.error)
const activeUploads = ref(0)
const images = computed(() => items.value.map(({ url }) => url))
const busy = computed(() => choosing.value || activeUploads.value > 0)
let nextId = 1

function createRemoteItems(urls: string[]): EvidenceItem[] {
  return urls.map((url) => ({ id: `remote-${nextId++}`, url, remoteUrl: url, status: 'ready' }))
}

function successfulUrls() {
  return items.value.flatMap((item) => item.status === 'ready' && item.remoteUrl ? [item.remoteUrl] : [])
}

function sameValues(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function updateBusyState() {
  emit('update:uploading', busy.value)
}

function syncValue() {
  emit('update:modelValue', successfulUrls())
}

watch(() => props.modelValue, (urls) => {
  if (choosing.value || activeUploads.value) return
  if (!sameValues(successfulUrls(), urls)) items.value = createRemoteItems(urls)
}, { immediate: true })

async function uploadItem(item: EvidenceItem) {
  if (!item.localPath) return
  item.status = 'uploading'
  item.error = ''
  activeUploads.value += 1
  updateBusyState()
  try {
    const remoteUrl = await uploadFile(item.localPath, props.token, props.folder)
    item.url = remoteUrl
    item.remoteUrl = remoteUrl
    item.status = 'ready'
    syncValue()
  } catch (error) {
    item.status = 'failed'
    item.error = getErrorMessage(error, '照片上传失败，请重试')
  } finally {
    activeUploads.value = Math.max(0, activeUploads.value - 1)
    updateBusyState()
  }
}

async function addPhotos() {
  if (props.disabled || choosing.value || activeUploads.value || items.value.length >= props.max) return
  choosing.value = true
  pickerError.value = ''
  updateBusyState()
  try {
    const paths = await chooseImages(props.max - items.value.length, '选择照片失败')
    if (!paths.length) return
    const additions: EvidenceItem[] = paths.map((path) => ({
      id: `local-${nextId++}`,
      url: path,
      localPath: path,
      status: 'uploading'
    }))
    items.value = [...items.value, ...additions]
    await Promise.all(items.value.slice(-additions.length).map(uploadItem))
  } catch (error) {
    pickerError.value = getErrorMessage(error, '无法选择照片，请重试')
  } finally {
    choosing.value = false
    updateBusyState()
  }
}

function retry(item?: EvidenceItem) {
  if (props.disabled || item?.status !== 'failed') return
  void uploadItem(item)
}

function remove(item?: EvidenceItem) {
  if (!item || props.disabled || item.status === 'uploading') return
  items.value = items.value.filter((candidate) => candidate.id !== item.id)
  syncValue()
}

function preview(item?: EvidenceItem) {
  if (item) uni.previewImage({ urls: images.value, current: item.url })
}
</script>

<template>
  <view class="evidence-upload">
    <view class="evidence-upload__head">
      <view class="evidence-upload__copy">
        <text class="evidence-upload__title">{{ title }}<text v-if="required" class="required-mark"> *</text></text>
        <text class="evidence-upload__description">{{ description }}</text>
      </view>
      <text class="evidence-upload__quota">{{ successfulUrls().length }} / {{ max }}</text>
    </view>

    <MobileEvidence
      class="evidence-upload__controls"
      :images="images" :label="title" :limit="max" :disabled="disabled" :uploading="busy"
      @preview="preview(items[$event])" @remove="remove(items[$event])" @upload="addPhotos"
    >
      <template #status="{ index }">
        <text v-if="items[index]?.status === 'uploading'" class="evidence-upload__state" role="status">上传中…</text>
        <button
          v-else-if="items[index]?.status === 'failed'"
          class="mobile-action evidence-upload__retry"
          role="button"
          :tabindex="disabled || busy ? -1 : 0"
          :aria-label="`重新上传第 ${index + 1} 张${title}`"
          :disabled="disabled || busy"
          :aria-disabled="disabled || busy || undefined"
          hover-class="mobile-action--pressed"
          @click="retry(items[index])"
          @keydown="preventActionKey"
          @keyup="activateActionKey($event, () => retry(items[index]))"
        >
          <MobileInlineLabel icon="refresh" label="重试上传" icon-size="14px" />
        </button>
      </template>
    </MobileEvidence>
    <text v-if="evidenceError" class="smis-inline-error" role="alert">{{ evidenceError }}</text>
    <text v-else class="evidence-upload__hint">可从相册选择或直接拍摄</text>
  </view>
</template>

<style scoped lang="scss">
.evidence-upload__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18rpx; }
.evidence-upload__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.evidence-upload__title { color: var(--smis-text); font-size: 14px; font-weight: 700; }
.required-mark { color: var(--smis-danger); }
.evidence-upload__description { margin-top: 6rpx; color: var(--smis-text-muted); font-size: clamp(13px, 19rpx, 14px); line-height: 1.45; }
.evidence-upload__quota { flex: 0 0 auto; color: var(--smis-text-muted); font-size: clamp(13px, 19rpx, 14px); font-variant-numeric: tabular-nums; }
.evidence-upload__controls { margin-top: 8px; }
.evidence-upload__state,
.evidence-upload__retry { text-align: center; font-size: 12px; line-height: 1.4; }
.evidence-upload__state { padding: 6px 4px; color: var(--smis-muted); }
.evidence-upload__retry.mobile-action { --mobile-inline-pair-gap: 4px; --mobile-inline-pair-leading: 1.4; display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; padding: 4px; color: var(--smis-red-strong); }
.evidence-upload__hint { display: block; margin-top: 12rpx; color: var(--smis-text-muted); font-size: clamp(13px, 18rpx, 14px); line-height: 1.45; }
</style>
