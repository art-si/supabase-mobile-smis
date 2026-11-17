<script setup lang="ts">
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import SmisEvidenceUpload from '@/components/business/SmisEvidenceUpload.vue'
import MobileEvidence from '@mobile-core/components/MobileEvidence.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import SmisStatusTag from '@/components/business/SmisStatusTag.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import { revealControl } from '@mobile-core/form-focus'
import MobileField from '@mobile-core/components/MobileField.vue'
import { useAuthStore } from '@/stores/auth'
import { getHazard, submitHazardAcceptance, submitHazardRectification } from '@/api/smis'
import { getErrorMessage } from '@/api/supabase'
import type { HazardDetail } from '@/api/types'
import { formatDate, hazardLevelBadge } from '@/utils/format'

const { themeName } = usePageTheme()

const auth = useAuthStore()
const detail = ref<HazardDetail | null>(null)
const currentId = ref('')
const loadError = ref('')
const loading = ref(true)
const pendingAction = ref<'rectify' | 'passed' | 'rejected' | null>(null)
const saving = computed(() => pendingAction.value !== null)
const missingField = ref<'description' | 'evidence' | ''>('')
const submitError = ref('')
const submitNotice = ref('')
const uploading = ref(false)
const action = reactive({ description: '', imageUrls: [] as string[] })
const actionTitle = computed(() => detail.value?.status === 'rectifying'
  ? '提交整改'
  : detail.value?.status === 'pending_acceptance' ? '验收处理' : '')

async function load(id: string, refresh = false) {
  currentId.value = id
  if (!(await auth.ensureValidSession())) return
  loading.value = !refresh
  loadError.value = ''
  try {
    detail.value = await getHazard(auth.token, id)
  } catch (error) {
    loadError.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function preview(index: number) {
  const urls = detail.value?.imageUrls
  if (urls?.[index]) uni.previewImage({ urls, current: urls[index] })
}

async function submit(result?: 'passed' | 'rejected') {
  const record = detail.value
  if (!record || !actionTitle.value || saving.value || uploading.value) return
  submitError.value = ''
  if (!action.description.trim()) {
    missingField.value = 'description'
    void revealControl('hazard-action-description', { focus: true })
    return
  }
  if (!action.imageUrls.length) {
    missingField.value = 'evidence'
    void revealControl('hazard-action-evidence', { focus: true })
    return
  }

  missingField.value = ''
  submitNotice.value = ''
  const operation = record.status === 'rectifying' ? 'rectify' : result
  if (!operation) return
  pendingAction.value = operation
  try {
    if (operation === 'rectify') {
      await submitHazardRectification(auth.token, record.id, {
        completedAt: new Date().toISOString(),
        description: action.description.trim(),
        imageUrls: action.imageUrls
      })
    } else {
      await submitHazardAcceptance(auth.token, record.id, {
        result: operation,
        description: action.description.trim(),
        imageUrls: action.imageUrls
      })
    }
    record.status = operation === 'rectify' ? 'pending_acceptance' : operation === 'passed' ? 'completed' : 'rectifying'
    submitNotice.value = operation === 'rectify' ? '整改已提交，等待验收' : operation === 'passed' ? '验收通过，隐患已完成' : '已退回整改'
    action.description = ''
    action.imageUrls = []
    await load(record.id, true)
  } catch (error) {
    submitError.value = getErrorMessage(error, '处理失败，已保留填写内容，请重试')
  } finally {
    pendingAction.value = null
  }
}

onLoad((query) => load(String(query?.id || '')))
</script>

<template>
<wd-config-provider :theme="themeName">
  <view class="page-shell">
    <MobileTopBar capsule="always" title="隐患详情" :subtitle="detail?.hazardNo || '隐患治理闭环'" show-back />
    <view class="page-body detail-body">
      <MobileLoadError v-if="loadError" :message="loadError" @retry="load(currentId)" />
      <view v-if="loading" class="loading" aria-live="polite"><wd-loading color="var(--smis-primary)" /></view>

      <template v-else-if="detail">
        <view class="hazard-main surface-card">
          <view class="hazard-main__head">
            <view class="level">{{ hazardLevelBadge(detail.hazardLevel) }}</view>
            <view><SmisStatusTag :status="detail.status" /><text>{{ detail.inspectionTypeName || '现场隐患' }}</text></view>
          </view>
          <text class="hazard-main__desc">{{ detail.description }}</text>
          <view class="hazard-main__place mobile-inline-pair mobile-inline-pair--start">
            <view class="mobile-inline-pair__icon" aria-hidden="true"><MobileIcon name="location" size="1em" align-to-label /></view>
            <text class="mobile-inline-pair__label">{{ detail.location }}</text>
          </view>
          <view v-if="detail.imageUrls.length" class="hazard-evidence">
            <MobileEvidence :images="detail.imageUrls" label="隐患现场照片" readonly @preview="preview" />
          </view>
        </view>

        <view class="facts surface-card">
          <text class="title">隐患信息</text>
          <view><text>上报人</text><text class="strong">{{ detail.reporterEmployeeName }}</text></view>
          <view><text>上报时间</text><text class="strong">{{ formatDate(detail.reportedAt, true) }}</text></view>
          <view><text>整改责任人</text><text class="strong">{{ detail.rectificationResponsibleEmployeeName || '待核准指定' }}</text></view>
          <view><text>整改期限</text><text class="strong">{{ formatDate(detail.rectificationDeadline) }}</text></view>
          <view v-if="detail.rectificationSuggestion"><text>整改建议</text><text class="strong">{{ detail.rectificationSuggestion }}</text></view>
        </view>

        <view class="timeline">
          <text class="title">闭环轨迹</text>
          <text v-if="!detail.events.length" class="timeline__empty">暂无流转记录，后续处理节点将在这里展示</text>
          <view v-for="(event, index) in detail.events" :key="event.id" class="event">
            <view class="event__rail" aria-hidden="true">
              <view class="mobile-inline-pair__icon"><view class="i" :class="{ 'event__dot--current': index === 0 }" /></view>
              <view v-if="index < detail.events.length - 1" class="span" />
            </view>
            <view class="event__copy">
              <view><text class="strong">{{ event.eventTitle }}</text><text class="small">{{ formatDate(event.eventAt, true) }}</text></view>
              <text>{{ event.eventContent || event.operatorEmployeeName || '节点已记录' }}</text>
            </view>
          </view>
        </view>

        <view v-if="submitNotice" class="action-notice surface-card mobile-inline-pair mobile-inline-pair--start" role="status">
          <view class="mobile-inline-pair__icon" aria-hidden="true">
            <MobileIcon name="check" size="20px" color="var(--smis-green-strong)" />
          </view>
          <text class="mobile-inline-pair__label">{{ submitNotice }}</text>
        </view>
        <view v-if="actionTitle" class="action surface-card" :aria-busy="saving || uploading">
          <view class="action__head">
            <view class="action__icon mobile-icon-box"><MobileIcon :name="detail.status === 'rectifying' ? 'hazard' : 'check'" size="34rpx" /></view>
            <view><text class="title">{{ actionTitle }}</text><text>填写说明并上传现场证据</text></view>
          </view>
          <MobileField
            field="hazard-action-description"
            v-model="action.description"
            class="action__textarea"
            label="处理说明"
            multiline
            show-count
            required
            :disabled="saving"
            :error="missingField === 'description' && !action.description.trim() ? '请填写处理说明' : ''"
            :maxlength="500"
            :placeholder="detail.status === 'rectifying' ? '说明整改措施与完成情况…' : '填写验收意见…'"
          />
          <SmisEvidenceUpload
            id="hazard-action-evidence"
            v-model="action.imageUrls"
            v-model:uploading="uploading"
            :token="auth.token"
            folder="smis/hazard-action"
            title="处理证据"
            description="至少 1 张，确保整改结果或验收现场清晰可见"
            required
            :max="6"
            :disabled="saving"
          />
          <text v-if="missingField === 'evidence' && !action.imageUrls.length" class="smis-inline-error" role="alert">请上传现场证据</text>
          <text v-if="submitError" class="smis-inline-error" role="alert">{{ submitError }}</text>
          <wd-button
            v-if="detail.status === 'rectifying'"
            custom-class="smis-primary-action action__primary"
            type="primary"
            block
            :round="false"
            :loading="pendingAction === 'rectify'"
            :disabled="saving || uploading"
            @click="submit()"
          >{{ pendingAction === 'rectify' ? '正在提交整改…' : '提交整改，等待验收' }}</wd-button>
          <view v-else class="accept-actions">
            <wd-button custom-class="smis-secondary-action" :round="false" :loading="pendingAction === 'rejected'" :disabled="saving || uploading" @click="submit('rejected')">{{ pendingAction === 'rejected' ? '正在退回…' : '退回整改' }}</wd-button>
            <wd-button custom-class="smis-primary-action" type="success" :round="false" :loading="pendingAction === 'passed'" :disabled="saving || uploading" @click="submit('passed')">{{ pendingAction === 'passed' ? '正在提交…' : '验收通过' }}</wd-button>
          </view>
        </view>
      </template>

      <view v-else-if="!loadError" class="loading surface-card">隐患不存在或无权查看</view>
    </view>
  </view>
</wd-config-provider>
</template>

<style scoped lang="scss">
.action-notice { --mobile-inline-pair-gap: 8px; --mobile-inline-pair-leading: 1.45; display: flex; padding: 12px 16px; margin-top: 16px; background: var(--smis-green-soft); color: var(--smis-text-strong); font-size: max(14px, .875rem); }
.detail-body { padding-top: 26rpx; padding-bottom: 50rpx; }
.loading { min-height: 340rpx; display: flex; align-items: center; justify-content: center; color: var(--smis-text-muted); }
.hazard-main { padding: 26rpx; }
.hazard-main__head { display: flex; align-items: center; gap: 15rpx; }
.level { width: 64rpx; height: 64rpx; border-radius: 19rpx; background: #fff1df; color: var(--smis-warning); font-size: clamp(15px, 28rpx, 17px); font-weight: 700; display: flex; align-items: center; justify-content: center; }
.hazard-main__head > view:nth-child(2) { min-width: 0; flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 7rpx; }
.hazard-main__head > view > text { color: var(--smis-text-muted); font-size: clamp(13px, 20rpx, 14px); }
.hazard-main__desc { display: block; margin-top: 20rpx; font-size: clamp(15px, 29rpx, 17px); font-weight: 600; line-height: 1.65; overflow-wrap: anywhere; }
.hazard-main__place { margin-top: 16rpx; padding: 15rpx; border-radius: 15rpx; background: var(--smis-control-bg); color: var(--smis-text-secondary); font-size: clamp(13px, 22rpx, 14px); display: flex; }
.hazard-evidence { margin-top: 18rpx; }
.facts { margin-top: 17rpx; padding: 25rpx; }
.title { display: block; margin-bottom: 17rpx; font-size: clamp(15px, 28rpx, 17px); font-weight: 700; }
.facts > view { min-height: 70rpx; display: grid; grid-template-columns: max(72px, 150rpx) minmax(0, 1fr); gap: 16rpx; align-items: center; }
.facts > view + view { border-top: 1rpx solid var(--smis-line); }
.facts > view text { color: var(--smis-text-muted); font-size: clamp(13px, 20rpx, 14px); }
.facts .strong { color: var(--smis-text); font-size: clamp(13px, 22rpx, 14px); line-height: 1.5; overflow-wrap: anywhere; }
.timeline { margin-top: 20rpx; padding: 24rpx; border: 1rpx solid var(--smis-line); border-radius: var(--smis-radius-lg); background: var(--smis-surface); }
.event { --mobile-inline-pair-leading: 1.5; display: flex; gap: 16rpx; font-size: clamp(13px, 23rpx, 14px); line-height: 1.5; }
.event__rail { width: 24rpx; display: flex; flex-direction: column; align-items: center; }
.event__rail .i { width: 18rpx; height: 18rpx; border: 4rpx solid #9eb1bf; border-radius: 50%; background: var(--smis-bg); }
.event__rail .event__dot--current { border-color: var(--smis-safety); }
.event__rail .span { width: 2rpx; min-height: 76rpx; flex: 1; background: #d8e1e7; }
.event__copy { min-width: 0; flex: 1; padding-bottom: 28rpx; }
.event__copy > view { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 12rpx; }
.event__copy .strong { min-width: 0; overflow-wrap: anywhere; font-weight: 650; }
.event__copy .small { color: var(--smis-text-muted); white-space: nowrap; }
.event__copy > text { display: block; margin-top: 7rpx; color: var(--smis-text-secondary); font-size: clamp(13px, 20rpx, 14px); line-height: 1.45; }
.action { margin-top: 20rpx; padding: 25rpx; overflow: visible; }
.action__head { margin-bottom: 18rpx; display: flex; align-items: center; gap: 14rpx; }
.action__head .title { margin: 0; }
.action__head > view:last-child { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.action__head > view:last-child > text:last-child { margin-top: 4rpx; color: var(--smis-text-muted); font-size: clamp(13px, 19rpx, 14px); }
.action__icon { width: 58rpx; height: 58rpx; border-radius: 18rpx; background: var(--smis-primary-soft); color: var(--smis-primary); }
.action__textarea { margin-bottom: 22rpx; }
:deep(.action__primary) { width: 100% !important; margin-top: 22rpx !important; }
.accept-actions { margin-top: 22rpx; display: grid; grid-template-columns: 1fr 1.45fr; gap: 12rpx; }
.accept-actions :deep(.wd-button) { width: 100% !important; margin: 0 !important; }
.timeline__empty { display: block; padding: 12rpx 0; font-size: 13px; line-height: 1.6; color: var(--smis-text-secondary); }
.facts > view { padding: 16rpx 0; }
</style>
