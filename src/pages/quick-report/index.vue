<script setup lang="ts">
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, getCurrentInstance, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import { revealControl } from '@mobile-core/form-focus'
import SmisBottomNav from '@/components/business/SmisBottomNav.vue'
import SmisEvidenceUpload from '@/components/business/SmisEvidenceUpload.vue'
import SmisFormSection from '@/components/business/SmisFormSection.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileInlineLabel from '@mobile-core/components/MobileInlineLabel.vue'
import SmisLocationField from '@/components/business/SmisLocationField.vue'
import MobileField from '@mobile-core/components/MobileField.vue'
import MobileSelect from '@mobile-core/components/MobileSelect.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
import { useAuthStore } from '@/stores/auth'
import { useDictionaryStore } from '@/stores/dictionary'
import { useProfileStore } from '@/stores/profile'
import { submitQuickReport } from '@/api/smis'
import { getErrorMessage } from '@/api/supabase'
import { toHierarchyOptions } from '@/utils/options'

const { themeName } = usePageTheme()
const nativeScope = getCurrentInstance()?.proxy

function revealSection(id: string, focus = true) {
  void revealControl(id, { focus, nativeScope })
}

interface QuickReportForm {
  hazardOrganizationId: string
  siteId: string
  location: string
  hazardLevel: string
  description: string
  rectificationSuggestion: string
  imageUrls: string[]
}

const auth = useAuthStore()
const dictionary = useDictionaryStore()
const profileStore = useProfileStore()
const loadError = ref('')
const loading = ref(false)
const uploading = ref(false)
const locating = ref(false)
const submitting = ref(false)
const submitError = ref('')
const submitted = ref(false)
const photoRequired = ref(false)
const reported = ref<Awaited<ReturnType<typeof submitQuickReport>> | null>(null)
const showSubmitDock = computed(() => !loading.value && !reported.value && !loadError.value)
const submitLabel = computed(() => submitting.value ? '正在提交…' : uploading.value ? '正在处理照片…' : locating.value ? '正在采集位置…' : '提交隐患上报')
const form = reactive<QuickReportForm>({
  hazardOrganizationId: '',
  siteId: '',
  location: '',
  hazardLevel: '',
  description: '',
  rectificationSuggestion: '',
  imageUrls: []
})

const requiredFields = {
  hazardOrganizationId: '请选择隐患所属组织',
  siteId: '请选择场所区域',
  location: '请填写或采集具体位置',
  hazardLevel: '请选择隐患等级',
  description: '请描述现场隐患'
} as const
type RequiredField = keyof typeof requiredFields
const fields = Object.keys(requiredFields) as RequiredField[]
function fieldError(field: RequiredField) {
  return submitted.value && !form[field].trim() ? requiredFields[field] : ''
}

const organizationOptions = computed(() => toHierarchyOptions(profileStore.options?.organizations || [], item => item.organizationName))
const siteOptions = computed(() => toHierarchyOptions(profileStore.options?.sites || [], item => item.siteName))
const hazardLevelOptions = computed(() => {
  const typeId = dictionary.typeIdByCode.smisHazardLevel
  const rows = dictionary.entries.filter((item) => item.typeId === typeId)
  const source = rows.length ? rows : [
    { id: '1', typeId: '', value: 'D', label: 'D级 · 一般隐患' },
    { id: '2', typeId: '', value: 'C', label: 'C级 · 较大隐患' },
    { id: '3', typeId: '', value: 'B', label: 'B级 · 重大隐患' }
  ]
  return source.map((item) => ({ id: item.value, name: item.label }))
})

async function load() {
  if (loading.value || reported.value || submitting.value) return
  loading.value = true
  loadError.value = ''
  try {
    if (!(await auth.ensureValidSession())) return
    await Promise.all([profileStore.load(auth.token), dictionary.load(auth.token)])
    form.hazardOrganizationId ||= profileStore.profile?.organizationId || ''
  } catch (error) {
    loadError.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (submitting.value || uploading.value || locating.value || reported.value) return
  submitError.value = ''
  submitted.value = true
  const first = fields.find(fieldError)
  if (first) {
    revealSection(`report-focus-${first}`)
    return
  }
  if (!form.imageUrls.length) {
    photoRequired.value = true
    revealSection('report-photo')
    return
  }

  submitting.value = true
  try {
    reported.value = await submitQuickReport(auth.token, {
      ...form,
      location: form.location.trim(),
      description: form.description.trim(),
      rectificationSuggestion: form.rectificationSuggestion.trim() || undefined
    })
    revealSection('report-receipt')
  } catch (error) {
    submitError.value = getErrorMessage(error, '上报失败，请重试')
  } finally {
    submitting.value = false
  }
}

function openReport() {
  if (reported.value) uni.redirectTo({ url: `/pages/hazards/detail?id=${reported.value.id}` })
}

onShow(load)
</script>

<template>
<wd-config-provider :theme="themeName">
  <MobileWorkspace :container-class="[
    'page-shell page-shell--tabbed mobile-workspace--sticky-dock report-page',
    showSubmitDock ? 'mobile-workspace--sticky-tabbed-dock' : ''
  ]">
    <MobileTopBar capsule="always" title="现场随手拍" subtitle="记录隐患并跟进处理" show-back />

    <view class="page-body report-body" :class="{ 'report-body--with-dock': showSubmitDock }" role="main">
      <MobileLoadError v-if="loadError" :message="loadError" @retry="load()" />
      <view v-if="loading" class="loading surface-card" aria-live="polite">
        <wd-loading color="var(--smis-primary)" />
        <text>正在加载上报信息…</text>
      </view>

      <view v-else-if="reported" id="report-receipt" class="surface-card">
        <MobileEmptyState icon="check" title="上报成功" description="已进入待核准状态">
          <view class="receipt-actions">
            <text id="report-receipt-reference" class="receipt-reference" user-select>隐患编号 {{ reported.hazardNo }}</text>
            <wd-button custom-class="smis-primary-action" type="primary" :round="false" aria-describedby="report-receipt-reference" @click="openReport">查看隐患</wd-button>
          </view>
        </MobileEmptyState>
      </view>

      <template v-else-if="!loadError">
        <view class="reporter surface-card">
          <view class="reporter__avatar">{{ (profileStore.profile?.employeeName || '安').slice(-1) }}</view>
          <view class="reporter__copy">
            <text>{{ profileStore.profile?.employeeName || '当前登录用户' }}</text>
            <text class="small">{{ profileStore.profile?.organizationName || '请先选择所属组织' }}</text>
          </view>
          <view v-if="profileStore.profile?.isEmployeeLinked" class="mobile-icon-box reporter__verified">
            <MobileInlineLabel icon="check" label="实名" />
          </view>
        </view>

        <SmisFormSection title="隐患位置" description="选择业务归属，并记录可复核的现场位置" icon="location">
          <view class="form-stack">
            <view id="report-focus-hazardOrganizationId">
              <MobileField field="report-hazardOrganizationId" label="所属组织" :error="fieldError('hazardOrganizationId')" required>
                <MobileSelect
                  v-model="form.hazardOrganizationId" field="report-hazardOrganizationId" label="所属组织"
                  placeholder="请选择所属组织" :options="organizationOptions" :disabled="submitting"
                  :invalid="Boolean(fieldError('hazardOrganizationId'))"
                  :described-by="fieldError('hazardOrganizationId') ? 'report-hazardOrganizationId-error' : undefined"
                />
              </MobileField>
            </view>
            <view id="report-focus-siteId">
              <MobileField field="report-siteId" label="场所区域" :error="siteOptions.length ? fieldError('siteId') : ''" required>
                <MobileSelect
                  v-model="form.siteId" field="report-siteId" label="场所区域" :options="siteOptions"
                  :placeholder="siteOptions.length ? '请选择场所区域' : '暂无可用场所'" :disabled="submitting || !siteOptions.length"
                  :invalid="Boolean(fieldError('siteId') && siteOptions.length)"
                  :described-by="!siteOptions.length ? 'report-site-unavailable' : fieldError('siteId') ? 'report-siteId-error' : undefined"
                />
              </MobileField>
            </view>
            <view v-if="!siteOptions.length" class="option-warning mobile-inline-pair mobile-inline-pair--start">
              <view class="mobile-inline-pair__icon" aria-hidden="true"><MobileIcon name="notice" size="1em" /></view>
              <text id="report-site-unavailable" class="mobile-inline-pair__label">当前租户还没有维护场所，请先在 Web 端基础资料中新增场所。</text>
            </view>
            <view id="report-focus-location">
              <SmisLocationField
                v-model="form.location" :error="fieldError('location')" :disabled="submitting"
                @update:locating="locating = $event" @permission-denied="revealSection('report-focus-location', false)"
              />
            </view>
          </view>
        </SmisFormSection>

        <SmisFormSection title="隐患情况" description="描述问题、风险后果与建议措施" icon="risk">
          <view class="form-stack">
            <view id="report-focus-hazardLevel">
              <MobileField field="report-hazardLevel" label="隐患等级" :error="fieldError('hazardLevel')" required>
                <MobileSelect
                  v-model="form.hazardLevel" field="report-hazardLevel" label="隐患等级"
                  placeholder="请选择隐患等级" :options="hazardLevelOptions" :disabled="submitting"
                  :invalid="Boolean(fieldError('hazardLevel'))"
                  :described-by="fieldError('hazardLevel') ? 'report-hazardLevel-error' : undefined"
                />
              </MobileField>
            </view>
            <view id="report-focus-description">
              <MobileField
                v-model="form.description" field="report-description" label="隐患描述"
                hint="说明危险状态、可能后果与影响范围。" multiline show-count required
                :disabled="submitting" :error="fieldError('description')" :maxlength="500"
                placeholder="例如：设备防护罩松动，可能碰伤操作人员。"
              />
            </view>
            <MobileField
              v-model="form.rectificationSuggestion" field="report-suggestion" label="整改建议（选填）"
              multiline show-count :disabled="submitting" :maxlength="300" placeholder="建议隔离、修复或管控措施…"
            />
          </view>
        </SmisFormSection>

        <view id="report-photo" class="report-evidence">
          <SmisFormSection title="现场证据" description="照片会进入后续核准、整改与验收记录" icon="camera">
            <SmisEvidenceUpload
              v-model="form.imageUrls"
              v-model:uploading="uploading"
              :token="auth.token"
              folder="smis/hazard"
              title="现场照片"
              description="至少 1 张，建议同时拍摄全景与问题细节"
              :disabled="submitting"
              required
              :max="6"
            />
            <text v-if="photoRequired && !form.imageUrls.length" class="smis-inline-error" role="alert">请至少上传 1 张现场照片</text>
          </SmisFormSection>
        </view>

        <view class="submit-note mobile-inline-pair mobile-inline-pair--start">
          <view class="mobile-inline-pair__icon" aria-hidden="true"><view class="i" /></view>
          <text class="mobile-inline-pair__label">提交后进入“待核准”，后续整改和验收节点会完整留痕。</text>
        </view>
      </template>
    </view>
    <view v-if="showSubmitDock" class="mobile-dock mobile-dock--sticky mobile-dock--tabbed report-action-dock" aria-label="隐患上报操作">
      <text v-if="submitError" class="mobile-dock__note mobile-dock__note--error" role="alert">{{ submitError }}</text>
      <MobileAction class="smis-primary-action mobile-dock__action report-submit" :aria-busy="submitting"
        :disabled="submitting || uploading || locating" @click="submit"
      >
        {{ submitLabel }}
      </MobileAction>
    </view>
    <SmisBottomNav active="quick" />
  </MobileWorkspace>
</wd-config-provider>
</template>

<style scoped lang="scss">
.page-shell--tabbed .report-body--with-dock { padding-bottom: 24px; }
.receipt-actions { display: grid; min-width: 0; justify-items: center; gap: 16px; }
.receipt-reference { color: var(--smis-text-strong); font-size: 14px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.loading { min-height: 340rpx; display: flex; align-items: center; justify-content: center; gap: 14rpx; color: var(--smis-text-secondary); }
.reporter { margin-bottom: 18rpx; padding: 22rpx; display: flex; align-items: center; gap: 16rpx; }
.reporter__avatar { width: 66rpx; height: 66rpx; flex: 0 0 66rpx; border-radius: 20rpx; background: var(--smis-primary-soft); color: var(--smis-primary); font-size: clamp(14px, 27rpx, 15px); font-weight: 700; display: flex; align-items: center; justify-content: center; }
.reporter__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.reporter__copy > text { overflow: hidden; overflow-wrap: anywhere; line-height: 1.5; font-size: clamp(14px, 25rpx, 15px); font-weight: 700; }
.reporter__copy .small { margin-top: 4rpx; color: var(--smis-text-muted); font-size: clamp(13px, 20rpx, 14px); font-weight: 500; }
.reporter__verified { --mobile-inline-pair-gap: 4px; min-height: 48rpx; padding: 2px 14rpx; border-radius: 999rpx; background: #e4f2eb; color: var(--smis-success); font-size: clamp(13px, 18rpx, 14px); font-weight: 700; }
.form-stack { display: flex; flex-direction: column; gap: 14px; }
.option-warning { --mobile-inline-pair-gap: 6px; padding: 16rpx; border-radius: 14rpx; background: #fff7e8; color: #9a6611; font-size: clamp(13px, 20rpx, 14px); }
.report-evidence { margin-top: 18rpx; }
.submit-note { margin: 20rpx 4rpx 0; color: var(--smis-text-secondary); font-size: clamp(13px, 19rpx, 14px); }
.submit-note .i { width: 6px; height: 6px; border-radius: 50%; background: var(--smis-safety); }
</style>
