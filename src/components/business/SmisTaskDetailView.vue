<script setup lang="ts">
import SmisLoadError from '@/components/business/SmisLoadError.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import SmisStatusTag from './SmisStatusTag.vue'
import SmisIcon from './SmisIcon.vue'
import SmisTextareaField from './SmisTextareaField.vue'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { getHazardInspectionTask, getRiskTask, saveHazardInspectionExecution, saveRiskExecution } from '@/api/smis'
import type { HazardInspectionTaskDetail, InspectionTaskItem, RiskTaskDetail } from '@/api/types'
import { formatDate } from '@/utils/format'
import { getErrorMessage } from '@/api/supabase'

const { themeName } = usePageTheme()

const props = defineProps<{ kind: 'risk' | 'inspection' }>()
const auth = useAuthStore()
const profile = useProfileStore()
const currentId = ref('')
const loadError = ref('')
const loading = ref(true)
const saving = ref(false)
const detail = ref<RiskTaskDetail | HazardInspectionTaskDetail | null>(null)
const summary = ref('')
const canEdit = computed(() => detail.value && !['completed', 'cancelled'].includes(detail.value.status))
const checked = computed(() => detail.value?.items.filter((item) => item.result !== 'pending').length || 0)
const abnormal = computed(() => detail.value?.items.filter((item) => item.result === 'abnormal').length || 0)

async function load(id: string) {
  currentId.value = id
  if (!(await auth.ensureValidSession())) return
  loading.value = true
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
  if (canEdit.value) item.result = result
}

async function save(complete: boolean) {
  if (!detail.value || saving.value) return
  if (complete && checked.value < detail.value.items.length) {
    uni.showToast({ title: '请完成全部检查项后再提交', icon: 'none' })
    return
  }
  if (complete && abnormal.value && !detail.value.items.filter((item) => item.result === 'abnormal').every((item) => item.remark?.trim())) {
    uni.showToast({ title: '请填写异常项说明', icon: 'none' })
    return
  }

  saving.value = true
  try {
    if (props.kind === 'risk') {
      const risk = detail.value as RiskTaskDetail
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
      const hazard = detail.value as HazardInspectionTaskDetail
      await saveHazardInspectionExecution(auth.token, {
        id: hazard.id,
        executionSummary: summary.value,
        attachmentUrls: hazard.attachmentUrls || [],
        items: hazard.items,
        complete
      })
    }
    uni.showToast({ title: complete ? '任务已完成' : '进度已保存', icon: 'success' })
    await load(detail.value.id)
  } catch (error) {
    uni.showToast({ title: getErrorMessage(error, '保存失败'), icon: 'none' })
  } finally {
    saving.value = false
  }
}

onLoad((query) => load(String(query?.id || '')))
</script>

<template>
<wd-config-provider :theme="themeName">
  <view class="page-shell">
    <MobileTopBar capsule="none" :title="kind === 'risk' ? '风险巡查执行' : '隐患排查执行'" :subtitle="detail?.taskNo" show-back />
    <view class="page-body detail-body">
      <SmisLoadError v-if="loadError" :message="loadError" @retry="load(currentId)" />
      <view v-if="loading" class="loading"><wd-loading color="var(--smis-primary)" /></view>

      <template v-else-if="detail">
        <view class="task-head surface-card">
          <view><SmisStatusTag :status="detail.status" /><text class="task-head__type">{{ kind === 'risk' ? '风险巡查' : '隐患排查' }}</text></view>
          <text class="task-head__title">{{ kind === 'risk' ? (detail as RiskTaskDetail).riskPointName : (detail as HazardInspectionTaskDetail).inspectionObject }}</text>
          <view class="task-head__dates">
            <view><text>计划开始</text><text class="strong">{{ formatDate(detail.plannedStartAt, true) }}</text></view>
            <view class="i" />
            <view><text>计划完成</text><text class="strong">{{ formatDate(detail.plannedEndAt, true) }}</text></view>
          </view>
        </view>

        <view class="progress surface-card">
          <view><text>检查进度</text><text class="strong">{{ checked }} / {{ detail.items.length }}</text></view>
          <view class="progress__bar"><view class="i" :style="{ width: `${detail.items.length ? checked / detail.items.length * 100 : 0}%` }" /></view>
          <text v-if="abnormal" class="progress__danger">已发现 {{ abnormal }} 项异常</text>
          <text v-else>选择结果后，请保存进度或完成提交</text>
        </view>

        <view class="section-head">
          <view><text>检查项目</text><text class="small">逐项确认，异常项需补充说明</text></view>
        </view>

        <view class="items">
          <view v-for="(checkItem, index) in detail.items" :key="checkItem.id" class="check-item surface-card" :class="{ 'check-item--abnormal': checkItem.result === 'abnormal' }">
            <view class="check-item__head">
              <text>{{ String(index + 1).padStart(2, '0') }}</text>
              <view><text class="small">{{ checkItem.standardName || checkItem.standardCode || '检查标准' }}</text><text class="strong">{{ checkItem.inspectionContent }}</text></view>
            </view>
            <view class="result-actions">
              <wd-button
                :custom-class="`result-button ${checkItem.result === 'normal' ? 'is-normal' : ''}`"
                :round="false"
                :disabled="!canEdit"
                :aria-pressed="checkItem.result === 'normal'"
                @click="setResult(checkItem, 'normal')"
              ><SmisIcon name="check" size="27rpx" />正常</wd-button>
              <wd-button
                :custom-class="`result-button ${checkItem.result === 'abnormal' ? 'is-abnormal' : ''}`"
                :round="false"
                :disabled="!canEdit"
                :aria-pressed="checkItem.result === 'abnormal'"
                @click="setResult(checkItem, 'abnormal')"
              ><SmisIcon name="notice" size="27rpx" />异常</wd-button>
            </view>
            <SmisTextareaField
              v-if="checkItem.result === 'abnormal'"
              v-model="checkItem.remark"
              class="check-item__remark"
              label="异常说明"
              hint="必填"
              compact
              required
              :disabled="!canEdit"
              :maxlength="300"
              placeholder="描述异常情况、位置与建议措施…"
            />
          </view>
        </view>

        <view class="summary-field surface-card">
          <SmisTextareaField
            v-model="summary"
            label="执行小结"
            hint="选填"
            class="summary-textarea"
            :disabled="!canEdit"
            :maxlength="500"
            placeholder="填写本次巡查的整体情况（选填）…"
          />
        </view>

        <view v-if="canEdit" class="action-bar">
          <wd-button custom-class="smis-secondary-action save-action" :round="false" :disabled="saving" @click="save(false)">保存进度</wd-button>
          <wd-button custom-class="smis-primary-action submit-action" type="primary" :round="false" :loading="saving" :disabled="saving" @click="save(true)">完成并提交</wd-button>
        </view>
        <view v-else class="closed-note"><SmisIcon name="check" size="34rpx" /><text>该任务已结束，检查结果与操作记录已固化留痕。</text></view>
      </template>

      <view v-else-if="!loadError" class="loading">任务不存在或无权查看</view>
    </view>
  </view>
</wd-config-provider>
</template>

<style scoped lang="scss">
.detail-body { padding-bottom: calc(220rpx + env(safe-area-inset-bottom)) !important; }
.loading { min-height: 340rpx; color: var(--smis-text-muted); display: flex; align-items: center; justify-content: center; }
.task-head { padding: 26rpx; }
.task-head > view:first-child { display: flex; align-items: center; gap: 12rpx; }
.task-head__type { color: var(--smis-text-muted); font-size: clamp(13px, 18rpx, 14px); }
.task-head__title { display: block; margin-top: 15rpx; font-size: clamp(15px, 28rpx, 17px); font-weight: 700; line-height: 1.45; }
.task-head__dates { margin-top: 20rpx; padding: 18rpx; border-radius: 17rpx; background: var(--smis-control-bg); display: grid; grid-template-columns: minmax(0, 1fr) 1rpx minmax(0, 1fr); gap: 18rpx; }
.task-head__dates > view { min-width: 0; display: flex; flex-direction: column; }
.task-head__dates text { color: var(--smis-text-muted); font-size: clamp(13px, 18rpx, 14px); }
.task-head__dates .strong { margin-top: 5rpx; color: var(--smis-text); font-size: clamp(13px, 20rpx, 14px); font-weight: 600; line-height: 1.35; }
.task-head__dates .i { background: var(--smis-line); }
.progress { margin-top: 16rpx; padding: 23rpx; }
.progress > view:first-child { display: flex; align-items: center; justify-content: space-between; }
.progress > view text { color: var(--smis-text-secondary); font-size: clamp(13px, 20rpx, 14px); }
.progress > view .strong { color: var(--smis-primary); font-size: clamp(14px, 24rpx, 15px); font-weight: 700; }
.progress__bar { height: 12rpx; margin: 16rpx 0 10rpx; border-radius: 999rpx; background: #e8edf0; overflow: hidden; }
.progress__bar .i { display: block; height: 100%; border-radius: 999rpx; background: var(--smis-primary-gradient); }
.progress > text { color: var(--smis-text-muted); font-size: clamp(13px, 18rpx, 14px); }
.progress .progress__danger { color: var(--smis-danger); }
.section-head { margin: 30rpx 4rpx 16rpx; }
.section-head > view { display: flex; align-items: flex-start; flex-direction: column; gap: 8rpx; }
.section-head text { color: var(--smis-text); font-size: clamp(15px, 28rpx, 17px); font-weight: 700; }
.section-head .small { color: var(--smis-text-muted); font-size: clamp(13px, 18rpx, 14px); font-weight: 500; line-height: 1.4; text-align: right; }
.items { display: flex; flex-direction: column; gap: 15rpx; }
.check-item { padding: 24rpx; }
.check-item--abnormal { border-left: 7rpx solid var(--smis-danger); }
.check-item__head { display: flex; align-items: flex-start; gap: 16rpx; }
.check-item__head > text { width: 46rpx; height: 46rpx; flex: 0 0 46rpx; border-radius: 14rpx; color: var(--smis-primary); background: var(--smis-primary-soft); font-size: clamp(13px, 18rpx, 14px); font-weight: 700; line-height: 1; display: flex; align-items: center; justify-content: center; }
.check-item__head > view { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.check-item__head .small { color: var(--smis-text-muted); font-size: clamp(13px, 17rpx, 14px); }
.check-item__head .strong { margin-top: 6rpx; color: var(--smis-text); font-size: clamp(15px, 28rpx, 17px); font-weight: 600; line-height: 1.65; }
.result-actions { margin-top: 20rpx; display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; }
.result-actions :deep(.result-button) { width: 100% !important; height: var(--smis-control-height) !important; margin: 0 !important; border: 1rpx solid var(--smis-control-border) !important; border-radius: 17rpx !important; color: var(--smis-text-secondary) !important; background: var(--smis-control-bg) !important; font-size: clamp(13px, 21rpx, 14px) !important; font-weight: 700 !important; display: flex !important; align-items: center !important; justify-content: center !important; gap: 8rpx; }
.result-actions :deep(.result-button.is-normal) { border-color: rgba(37, 115, 84, .14) !important; color: var(--smis-success) !important; background: #e5f3ec !important; }
.result-actions :deep(.result-button.is-abnormal) { border-color: rgba(174, 55, 53, .14) !important; color: var(--smis-danger) !important; background: #fbe9e8 !important; }
.check-item__remark { margin-top: 14rpx; }
.summary-field { margin-top: 18rpx; padding: 24rpx; }
.action-bar { position: fixed; z-index: 20; left: 50%; right: auto; bottom: 0; width: min(100%, 520px); box-sizing: border-box; padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom)); background: rgba(255,255,255,.95); border-top: 1rpx solid var(--smis-line); box-shadow: 0 -4rpx 16rpx rgba(31,59,76,.04); transform: translateX(-50%); backdrop-filter: blur(24rpx); display: grid; grid-template-columns: 1fr 1.6fr; gap: 14rpx; }
.action-bar :deep(.wd-button) { width: 100% !important; height: var(--smis-control-height) !important; margin: 0 !important; border-radius: 18rpx !important; font-size: clamp(13px, 23rpx, 14px) !important; font-weight: 700 !important; }
.closed-note { margin-top: 18rpx; padding: 22rpx; border-radius: 18rpx; color: var(--smis-success); background: #e5f3ec; display: flex; align-items: flex-start; gap: 13rpx; font-size: clamp(13px, 20rpx, 14px); line-height: 1.5; }
</style>
