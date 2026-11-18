<script setup lang="ts">
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, getCurrentInstance, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { activateActionKey, preventActionKey } from '@mobile-core/action-keyboard'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { revealControl } from '@mobile-core/form-focus'
import SmisStatusTag from './SmisStatusTag.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileInlineLabel from '@mobile-core/components/MobileInlineLabel.vue'
import MobileField from '@mobile-core/components/MobileField.vue'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { getHazardInspectionTask, getRiskTask, saveHazardInspectionExecution, saveRiskExecution } from '@/api/smis'
import type { HazardInspectionTaskDetail, InspectionTaskItem, RiskTaskDetail } from '@/api/types'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

defineOptions({ options: { styleIsolation: 'apply-shared' } })

const { themeName } = usePageTheme()

const props = defineProps<{ kind: 'risk' | 'inspection' }>()
const nativeScope = getCurrentInstance()?.proxy
const auth = useAuthStore()
const profile = useProfileStore()
const currentId = ref('')
const loadError = ref('')
const loading = ref(true)
const pendingAction = ref<'save' | 'complete' | null>(null)
const submitError = ref('')
const submitted = ref(false)
const savedNotice = ref('')
const detail = ref<RiskTaskDetail | HazardInspectionTaskDetail | null>(null)
const summary = ref('')
const canEdit = computed(() => detail.value && !['completed', 'cancelled'].includes(detail.value.status))
const editDisabled = computed(() => !canEdit.value || pendingAction.value !== null)
const checked = computed(() => detail.value?.items.filter((item) => item.result !== 'pending').length || 0)
const abnormal = computed(() => detail.value?.items.filter((item) => item.result === 'abnormal').length || 0)

async function load(id: string, refresh = false) {
  currentId.value = id
  if (!(await auth.ensureValidSession())) return
  loading.value = !refresh
  loadError.value = ''
  try {
    await profile.load(auth.token)
    detail.value = props.kind === 'risk'
      ? await getRiskTask(auth.token, id)
      : await getHazardInspectionTask(auth.token, id)
    summary.value = detail.value?.executionSummary || ''
  } catch (error) {
    loadError.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

function setResult(item: InspectionTaskItem, result: 'normal' | 'abnormal') {
  if (!editDisabled.value) item.result = result
}

async function save(complete: boolean) {
  const task = detail.value
  if (!task || editDisabled.value) return
  submitError.value = ''
  savedNotice.value = ''
  if (complete) {
    submitted.value = true
    const incomplete = task.items.findIndex((item) => item.result === 'pending' || (item.result === 'abnormal' && !item.remark?.trim()))
    const item = task.items[incomplete]
    if (item) {
      void revealControl(`check-${item.result === 'pending' ? '' : 'remark-region-'}${incomplete}`, { nativeScope })
      return
    }
  }

  pendingAction.value = complete ? 'complete' : 'save'
  try {
    if (props.kind === 'risk') {
      const risk = task as RiskTaskDetail
      const employeeId = profile.profile?.employeeId || risk.actualExecutorEmployeeId || risk.assigneeEmployeeId
      if (!employeeId) throw new Error('当前账号未关联员工档案')
      await saveRiskExecution(auth.token, {
        id: risk.id,
        actualExecutorEmployeeId: employeeId,
        executionSummary: summary.value,
        attachmentUrls: risk.attachmentUrls || [],
        items: risk.items,
        complete
      })
    } else {
      const hazard = task as HazardInspectionTaskDetail
      await saveHazardInspectionExecution(auth.token, {
        id: hazard.id,
        executionSummary: summary.value,
        attachmentUrls: hazard.attachmentUrls || [],
        items: hazard.items,
        complete
      })
    }
    if (complete) task.status = 'completed'
    else savedNotice.value = '进度已保存'
    submitted.value = false
    await load(task.id, true)
  } catch (error) {
    submitError.value = getErrorMessage(error, '保存失败，已保留本次检查结果，请重试')
  } finally {
    pendingAction.value = null
  }
}

onLoad((query) => load(String(query?.id || '')))
</script>

<template>
<wd-config-provider :theme="themeName">
  <MobileWorkspace container-class="page-shell mobile-workspace--sticky-dock">
    <MobileTopBar capsule="always" :title="kind === 'risk' ? '风险巡查执行' : '隐患排查执行'" :subtitle="detail?.taskNo" show-back />
    <view class="page-body" :class="{ 'task-edit-content': canEdit }" role="main">
      <MobileLoadError v-if="loadError" :message="loadError" @retry="load(currentId)" />
      <view v-if="loading" class="loading"><wd-loading color="var(--smis-primary)" /></view>

      <template v-else-if="detail">
        <view class="task-head surface-card">
          <view class="task-head__meta"><SmisStatusTag :status="detail.status" /><text class="task-head__type">{{ kind === 'risk' ? '风险巡查' : '隐患排查' }}</text></view>
          <text class="task-head__title">{{ kind === 'risk' ? (detail as RiskTaskDetail).riskPointName : (detail as HazardInspectionTaskDetail).inspectionObject }}</text>
          <view class="task-head__dates">
            <view class="task-head__date"><text class="task-head__date-label">计划开始</text><text class="task-head__date-value">{{ formatDate(detail.plannedStartAt, true) }}</text></view>
            <view class="task-head__date"><text class="task-head__date-label">计划完成</text><text class="task-head__date-value">{{ formatDate(detail.plannedEndAt, true) }}</text></view>
          </view>
        </view>

        <view class="progress surface-card">
          <view class="progress__head"><text class="progress__label">检查进度</text><text class="progress__count">{{ checked }} / {{ detail.items.length }}</text></view>
          <view v-if="detail.items.length" class="progress__bar" role="progressbar" aria-label="检查进度" :aria-valuenow="checked" :aria-valuemax="detail.items.length" aria-valuemin="0"><view class="i" :style="{ width: `${checked / detail.items.length * 100}%` }" /></view>
          <text v-if="abnormal" class="progress__hint progress__danger">已发现 {{ abnormal }} 项异常</text>
          <text v-else-if="canEdit" class="progress__hint">选择结果后，请保存进度或完成提交</text>
        </view>

        <view class="section-head">
          <view class="section-head__copy"><text class="section-head__title" role="heading" aria-level="2">检查项目</text><text class="section-head__description">逐项确认，异常项需补充说明</text></view>
        </view>

        <view class="items" :aria-busy="pendingAction !== null">
          <view v-for="(checkItem, index) in detail.items" :id="`check-${index}`" :key="checkItem.id" class="check-item surface-card" :class="{ 'check-item--abnormal': checkItem.result === 'abnormal' }">
            <view class="check-item__head">
              <text class="check-item__index">{{ String(index + 1).padStart(2, '0') }}</text>
              <view class="check-item__copy"><text class="small">{{ checkItem.standardName || checkItem.standardCode || '检查标准' }}</text><text class="strong">{{ checkItem.inspectionContent }}</text></view>
            </view>
            <view class="result-actions" role="group" :aria-label="`第 ${index + 1} 项检查结果`">
              <button class="mobile-action result-button" :class="{ 'result-button--normal': checkItem.result === 'normal' }"
                role="button" :tabindex="editDisabled ? -1 : 0" :disabled="editDisabled"
                :aria-disabled="editDisabled || undefined" :aria-pressed="checkItem.result === 'normal'"
                hover-class="mobile-action--pressed" @click="setResult(checkItem, 'normal')"
                @keydown="preventActionKey" @keyup="activateActionKey($event, () => setResult(checkItem, 'normal'))"
              >
                <MobileInlineLabel icon="check" label="正常" />
              </button>
              <button class="mobile-action result-button" :class="{ 'result-button--abnormal': checkItem.result === 'abnormal' }"
                role="button" :tabindex="editDisabled ? -1 : 0" :disabled="editDisabled"
                :aria-disabled="editDisabled || undefined" :aria-pressed="checkItem.result === 'abnormal'"
                hover-class="mobile-action--pressed" @click="setResult(checkItem, 'abnormal')"
                @keydown="preventActionKey" @keyup="activateActionKey($event, () => setResult(checkItem, 'abnormal'))"
              >
                <MobileInlineLabel icon="warning" label="异常" />
              </button>
            </view>
            <text v-if="submitted && checkItem.result === 'pending'" class="smis-inline-error" role="alert">请选择检查结果</text>
            <view v-if="checkItem.result === 'abnormal'" :id="`check-remark-region-${index}`" class="check-item__remark">
              <MobileField
                :field="`check-remark-${index}`"
                :model-value="checkItem.remark ?? ''"
                label="异常说明"
                multiline
                show-count
                required
                :disabled="editDisabled"
                :error="submitted && !checkItem.remark?.trim() ? '请补充异常情况与位置' : ''"
                :maxlength="300"
                placeholder="描述异常情况、位置与建议措施…"
                @update:model-value="checkItem.remark = $event"
              />
            </view>
          </view>
        </view>

        <view class="summary-field surface-card">
          <MobileField
            v-model="summary"
            field="execution-summary"
            label="执行小结（选填）"
            class="summary-textarea"
            multiline
            show-count
            :disabled="editDisabled"
            :maxlength="500"
            placeholder="填写本次检查的整体情况…"
          />
        </view>

        <view v-if="!canEdit" class="closed-note mobile-inline-pair mobile-inline-pair--start" role="status">
          <view class="mobile-inline-pair__icon" aria-hidden="true"><MobileIcon name="check" size="1em" /></view>
          <text class="mobile-inline-pair__label">该任务已结束，检查结果和操作记录已保留。</text>
        </view>
      </template>

      <view v-else-if="!loadError" class="loading">任务不存在或无权查看</view>
    </view>
    <view v-if="canEdit && !loading" class="mobile-dock mobile-dock--sticky task-dock" aria-label="检查结果操作">
      <text v-if="submitError" class="mobile-dock__note mobile-dock__note--error" role="alert">{{ submitError }}</text>
      <text v-else-if="savedNotice" class="mobile-dock__note" role="status">{{ savedNotice }}</text>
      <view class="mobile-dock__actions" :aria-busy="pendingAction !== null">
        <MobileAction class="smis-secondary-action mobile-dock__action" :disabled="editDisabled" @click="save(false)">
          {{ pendingAction === 'save' ? '正在保存…' : '保存进度' }}
        </MobileAction>
        <MobileAction class="smis-primary-action mobile-dock__action" :disabled="editDisabled" @click="save(true)">
          {{ pendingAction === 'complete' ? '正在提交…' : '完成并提交' }}
        </MobileAction>
      </view>
    </view>
  </MobileWorkspace>
</wd-config-provider>
</template>

<style scoped lang="scss">
@use '@mobile-core/styles/form';
.task-edit-content { padding-bottom: 24px; }
.loading { min-height: 340rpx; color: var(--smis-text-muted); display: flex; align-items: center; justify-content: center; }
.task-head { padding: 26rpx; }
.task-head__meta { display: flex; align-items: center; gap: 12rpx; }
.task-head__type { color: var(--smis-text-muted); font-size: clamp(13px, 18rpx, 14px); }
.task-head__title { display: block; margin-top: 15rpx; font-size: clamp(15px, 28rpx, 17px); font-weight: 700; line-height: 1.45; }
.task-head__dates { @include form.field-grid; margin-top: 20rpx; padding: 12px; border-radius: 17rpx; background: var(--smis-control-bg); }
.task-head__date { min-width: 0; display: flex; flex-direction: column; }
.task-head__date-label { color: var(--smis-text-muted); font-size: max(13px, .8125rem); }
.task-head__date-value { margin-top: 5rpx; color: var(--smis-text); font-size: max(14px, .875rem); font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.task-dock .mobile-dock__actions { @include form.field-grid($gap: 8px); }
.progress { margin-top: 16rpx; padding: 23rpx; }
.progress__head { display: flex; align-items: center; justify-content: space-between; }
.progress__label { color: var(--smis-text-secondary); font-size: clamp(13px, 20rpx, 14px); }
.progress__count { color: var(--smis-primary); font-size: clamp(14px, 24rpx, 15px); font-weight: 700; }
.progress__bar { height: 12rpx; margin: 16rpx 0 10rpx; border-radius: 999rpx; background: #e8edf0; overflow: hidden; }
.progress__bar .i { display: block; height: 100%; border-radius: 999rpx; background: var(--smis-primary-gradient); }
.progress__hint { color: var(--smis-text-muted); font-size: clamp(13px, 18rpx, 14px); }
.progress__danger { color: var(--smis-danger); }
.section-head { margin: 30rpx 4rpx 16rpx; }
.section-head__copy { display: flex; align-items: flex-start; flex-direction: column; gap: 8rpx; }
.section-head__title { color: var(--smis-text); font-size: clamp(15px, 28rpx, 17px); font-weight: 700; }
.section-head__description { color: var(--smis-text-muted); font-size: clamp(13px, 18rpx, 14px); font-weight: 500; line-height: 1.4; text-align: right; }
.items { display: flex; flex-direction: column; gap: 15rpx; }
.check-item { padding: 24rpx; }
.check-item--abnormal { border-left: 7rpx solid var(--smis-danger); }
.check-item__head { display: flex; align-items: flex-start; gap: 16rpx; }
.check-item__index { width: 46rpx; height: 46rpx; flex: 0 0 46rpx; border-radius: 14rpx; color: var(--smis-primary); background: var(--smis-primary-soft); font-size: clamp(13px, 18rpx, 14px); font-weight: 700; line-height: 1; display: flex; align-items: center; justify-content: center; }
.check-item__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.check-item__head .small { color: var(--smis-text-muted); font-size: clamp(13px, 17rpx, 14px); }
.check-item__head .strong { margin-top: 6rpx; color: var(--smis-text); font-size: clamp(15px, 28rpx, 17px); font-weight: 600; line-height: 1.65; }
.result-actions { margin-top: 20rpx; display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.result-button.mobile-action { --mobile-inline-pair-leading: 1.35; width: 100%; min-height: max(44px, var(--smis-control-height)); padding: 6px; border: 1px solid var(--smis-control-border); border-radius: 17rpx; color: var(--smis-text-secondary); background: var(--smis-control-bg); font-size: clamp(13px, 21rpx, 14px); font-weight: 700; display: flex; align-items: center; justify-content: center; }
.result-button--normal.mobile-action { border-color: var(--smis-success); color: var(--smis-success); background: #e5f3ec; }
.result-button--abnormal.mobile-action { border-color: var(--smis-danger); color: var(--smis-danger); background: #fbe9e8; }
.check-item__remark { margin-top: 14rpx; }
.summary-field { margin-top: 18rpx; padding: 24rpx; }
.closed-note { margin-top: 18rpx; padding: 22rpx; border-radius: 18rpx; color: var(--smis-success); background: #e5f3ec; font-size: clamp(13px, 20rpx, 14px); }
</style>
