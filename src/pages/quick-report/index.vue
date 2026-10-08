<script setup lang="ts">
import SmisLoadError from '@/components/business/SmisLoadError.vue'

import { usePageTheme } from '@/composables/usePageTheme'
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import type { FormInstance, FormSchema } from '@wot-ui/ui/components/wd-form/types'
import SmisSelectField from '@/components/business/SmisSelectField.vue'
import SmisBottomNav from '@/components/business/SmisBottomNav.vue'
import SmisEvidenceUpload from '@/components/business/SmisEvidenceUpload.vue'
import SmisFormSection from '@/components/business/SmisFormSection.vue'
import SmisIcon from '@/components/business/SmisIcon.vue'
import SmisLocationField from '@/components/business/SmisLocationField.vue'
import SmisTextareaField from '@/components/business/SmisTextareaField.vue'
import SmisTopBar from '@/components/business/SmisTopBar.vue'
import { useAuthStore } from '@/stores/auth'
import { useDictionaryStore } from '@/stores/dictionary'
import { useProfileStore } from '@/stores/profile'
import { submitQuickReport } from '@/api/smis'
import { getErrorMessage } from '@/api/supabase'
import type { ReportingOrganization, ReportingSite } from '@/api/types'
import { flattenHierarchy, toHierarchyOptions } from '@/utils/options'

const { themeName } = usePageTheme()

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
const formRef = ref<FormInstance>()
const loadError = ref('')
const loading = ref(false)
const uploading = ref(false)
const locating = ref(false)
const submitting = ref(false)
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
const schema: FormSchema = {
  validate(model: Record<string, unknown>) {
    return Object.entries(requiredFields)
      .filter(([key]) => typeof model[key] !== 'string' || !String(model[key]).trim())
      .map(([key, message]) => ({ path: [key], message }))
  },
  isRequired(path) { return path in requiredFields }
}

const organizations = computed(() => flattenHierarchy<ReportingOrganization>(profileStore.options?.organizations || []))
const sites = computed(() => flattenHierarchy<ReportingSite>(profileStore.options?.sites || []))
const organizationOptions = computed(() => toHierarchyOptions(organizations.value, (item) => item.organizationName))
const siteOptions = computed(() => toHierarchyOptions(sites.value, (item) => item.siteName))
const hazardLevelOptions = computed(() => {
  const typeId = dictionary.typeIdByCode.smisHazardLevel
  const rows = dictionary.entries.filter((item) => item.typeId === typeId)
  const source = rows.length ? rows : [
    { id: '1', typeId: '', value: 'D', label: 'D级 · 一般隐患' },
    { id: '2', typeId: '', value: 'C', label: 'C级 · 较大隐患' },
    { id: '3', typeId: '', value: 'B', label: 'B级 · 重大隐患' }
  ]
  return source.map((item) => ({ value: item.value, label: item.label }))
})

async function load() {
  if (!(await auth.ensureValidSession())) return
  loading.value = true
  loadError.value = ''
  try {
    await Promise.all([profileStore.load(auth.token), dictionary.load(auth.token)])
    form.hazardOrganizationId ||= profileStore.profile?.organizationId || ''
  } catch (error) {
    loadError.value = getErrorMessage(error)
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (submitting.value || uploading.value || locating.value) return
  const validation = await formRef.value?.validate()
  if (validation && !validation.valid) return
  if (!form.imageUrls.length) {
    uni.showToast({ title: '请至少上传 1 张现场照片', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const result = await submitQuickReport(auth.token, {
      ...form,
      location: form.location.trim(),
      description: form.description.trim(),
      rectificationSuggestion: form.rectificationSuggestion.trim() || undefined
    })
    uni.showModal({
      title: '上报成功',
      content: `隐患编号 ${result.hazardNo}\n已进入待核准状态`,
      showCancel: false,
      confirmText: '查看隐患',
      success: () => uni.redirectTo({ url: `/pages/hazards/detail?id=${result.id}` })
    })
  } catch (error) {
    uni.showToast({ title: getErrorMessage(error, '提交失败'), icon: 'none', duration: 2500 })
  } finally {
    submitting.value = false
  }
}

onShow(load)
</script>

<template>
<wd-config-provider :theme="themeName">
  <view class="page-shell report-page">
    <SmisTopBar title="现场随手拍" eyebrow="QUICK HAZARD REPORT" subtitle="拍照留证，隐患直达闭环" show-back />

    <view class="page-body report-body">
      <SmisLoadError v-if="loadError" :message="loadError" @retry="load()" />
      <view v-if="loading" class="loading surface-card" aria-live="polite">
        <wd-loading color="var(--smis-primary)" />
        <text>正在加载上报信息…</text>
      </view>

      <template v-else-if="!loadError">
        <view class="reporter surface-card">
          <view class="reporter__avatar">{{ (profileStore.profile?.employeeName || '安').slice(-1) }}</view>
          <view class="reporter__copy">
            <text>{{ profileStore.profile?.employeeName || '当前登录用户' }}</text>
            <text class="small">{{ profileStore.profile?.organizationName || '请先选择所属组织' }}</text>
          </view>
          <view v-if="profileStore.profile?.isEmployeeLinked" class="reporter__verified"><SmisIcon name="check" size="22rpx" />实名</view>
        </view>

        <wd-form ref="formRef" :model="form" :schema="schema" error-type="toast">
          <SmisFormSection title="隐患位置" description="选择业务归属，并记录可复核的现场位置" icon="location">
            <view class="form-stack">
              <SmisSelectField
                v-model="form.hazardOrganizationId"
                custom-class="smis-form-control"
                label="所属组织"
                title="选择隐患所属组织"
                placeholder="请选择所属组织…"
                prop="hazardOrganizationId"
                required
                :columns="organizationOptions"
              />
              <SmisSelectField
                v-model="form.siteId"
                custom-class="smis-form-control"
                label="场所区域"
                title="选择场所区域"
                :placeholder="siteOptions.length ? '请选择场所区域…' : '暂无可用场所'"
                prop="siteId"
                required
                :disabled="!siteOptions.length"
                :columns="siteOptions"
              />
              <view v-if="!siteOptions.length" class="option-warning">
                <SmisIcon name="notice" size="27rpx" />
                <text>当前租户还没有维护场所，请先在 Web 端基础资料中新增场所。</text>
              </view>
              <wd-form-item prop="location" required>
              <SmisLocationField
                v-model="form.location"
                required
                @update:locating="locating = $event"
              />
              </wd-form-item>
            </view>
          </SmisFormSection>

          <SmisFormSection title="隐患情况" description="描述问题、风险后果与建议措施" icon="risk">
            <view class="form-stack">
              <SmisSelectField
                v-model="form.hazardLevel"
                custom-class="smis-form-control"
                label="隐患等级"
                title="选择隐患等级"
                placeholder="请选择隐患等级…"
                prop="hazardLevel"
                required
                :columns="hazardLevelOptions"
              />
              <wd-form-item prop="description" required>
              <SmisTextareaField
                v-model="form.description"
                label="隐患描述"
                hint="说明风险状态与后果"
                prop="description"
                required
                :maxlength="500"
                placeholder="描述危险状态、可能后果与影响范围…"
              />
              </wd-form-item>
              <SmisTextareaField
                v-model="form.rectificationSuggestion"
                label="整改建议"
                hint="选填"
                compact
                :maxlength="300"
                placeholder="建议隔离、修复或管控措施…"
              />
            </view>
          </SmisFormSection>
        </wd-form>

        <SmisFormSection class="report-evidence" title="现场证据" description="照片会进入后续核准、整改与验收记录" icon="camera">
          <SmisEvidenceUpload
            v-model="form.imageUrls"
            v-model:uploading="uploading"
            :token="auth.token"
            folder="smis/hazard"
            title="现场照片"
            description="至少 1 张，建议同时拍摄全景与问题细节"
            required
            :max="6"
          />
        </SmisFormSection>

        <view class="submit-note">
          <view class="i" />
          <text>提交后进入“待核准”，后续整改和验收节点会完整留痕。</text>
        </view>
        <view class="report-action-dock">
          <wd-button
            custom-class="smis-primary-action report-submit"
            type="primary"
            block
            :round="false"
            :loading="submitting"
            :disabled="submitting || uploading || locating"
            @click="submit"
          >
            提交隐患上报
          </wd-button>
        </view>
      </template>
    </view>
    <SmisBottomNav active="quick" />
  </view>
</wd-config-provider>
</template>

<style scoped lang="scss">
.report-body { padding-top: 26rpx; padding-bottom: calc(var(--smis-nav-height) + var(--smis-control-height) + 112rpx + env(safe-area-inset-bottom)) !important; }
.loading { min-height: 340rpx; display: flex; align-items: center; justify-content: center; gap: 14rpx; color: var(--smis-text-secondary); }
.reporter { margin-bottom: 18rpx; padding: 22rpx; display: flex; align-items: center; gap: 16rpx; }
.reporter__avatar { width: 66rpx; height: 66rpx; flex: 0 0 66rpx; border-radius: 20rpx; background: var(--smis-primary-soft); color: var(--smis-primary); font-size: clamp(14px, 27rpx, 15px); font-weight: 700; display: flex; align-items: center; justify-content: center; }
.reporter__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.reporter__copy > text { overflow: hidden; overflow-wrap: anywhere; line-height: 1.5; font-size: clamp(14px, 25rpx, 15px); font-weight: 700; }
.reporter__copy .small { margin-top: 4rpx; color: var(--smis-text-muted); font-size: clamp(13px, 20rpx, 14px); font-weight: 500; }
.reporter__verified { height: 48rpx; padding: 0 14rpx; border-radius: 999rpx; background: #e4f2eb; color: var(--smis-success); display: flex; align-items: center; gap: 5rpx; font-size: clamp(13px, 18rpx, 14px); font-weight: 700; }
.form-stack { display: flex; flex-direction: column; gap: 14rpx; }
:deep(.smis-form-control) { overflow: hidden; border: 1rpx solid var(--smis-control-border); border-radius: var(--smis-control-radius); background: var(--smis-control-bg); }

:deep(.smis-form-control .wd-cell__title) { color: var(--smis-text-secondary); font-size: clamp(13px, 21rpx, 14px); font-weight: 700; }
:deep(.smis-form-control .wd-cell__value) { color: var(--smis-text); font-size: clamp(14px, 24rpx, 15px); }
.option-warning { padding: 16rpx; border-radius: 14rpx; background: #fff7e8; color: #9a6611; display: flex; align-items: flex-start; gap: 10rpx; font-size: clamp(13px, 20rpx, 14px); line-height: 1.5; }
.report-evidence { margin-top: 18rpx; }
.submit-note { margin: 20rpx 4rpx 0; display: flex; align-items: flex-start; gap: 12rpx; color: var(--smis-text-secondary); font-size: clamp(13px, 19rpx, 14px); line-height: 1.5; }
.submit-note .i { width: 10rpx; height: 10rpx; flex: 0 0 10rpx; margin-top: 9rpx; border-radius: 50%; background: var(--smis-safety); }
.report-action-dock { position: fixed; z-index: 26; left: 50%; bottom: calc(var(--smis-nav-height) + 32rpx + env(safe-area-inset-bottom)); width: min(calc(100vw - 56rpx), 484px); box-sizing: border-box; padding: 12rpx; border: 1rpx solid rgba(220, 227, 238, .88); border-radius: 24rpx; background: rgba(255, 255, 255, .96); box-shadow: 0 4rpx 16rpx rgba(29, 39, 66, .08); transform: translateX(-50%); backdrop-filter: blur(24rpx) saturate(150%); }
:deep(.report-submit) { width: 100% !important; }
</style>
