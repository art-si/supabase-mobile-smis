<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import MobileAccountIdentity from '@mobile-core/components/MobileAccountIdentity.vue'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileSignOutDialog from '@mobile-core/components/MobileSignOutDialog.vue'
import { usePageTheme } from '@/composables/usePageTheme'
import SmisBottomNav from '@/components/business/SmisBottomNav.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileLoadError from '@mobile-core/components/MobileLoadError.vue'
import MobileLoadingStatus from '@mobile-core/components/MobileLoadingStatus.vue'
import MobileSectionHeading from '@mobile-core/components/MobileSectionHeading.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileWorkspace from '@mobile-core/components/MobileWorkspace.vue'
// #ifdef MP-WEIXIN
import MobileWechatPhoneBinding from '@mobile-core/components/MobileWechatPhoneBinding.vue'
import { isWechatPhoneLoginEnabled } from '@mobile-core/wechat-phone-login'
// #endif
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { bindWechatPhoneNumber, getErrorMessage } from '@/api/supabase'

const { themeName } = usePageTheme()
const auth = useAuthStore()
const profile = useProfileStore()
const loading = ref(false)
const loadError = ref('')
const logoutVisible = ref(false)

const links = [
  { name: '我的排班', icon: 'schedule', url: '/pages/schedule/index' },
  { name: '安全消息', icon: 'message', url: '/pages/messages/index' }
] as const

async function load() {
  if (loading.value || !(await auth.ensureValidSession())) return
  loading.value = true
  loadError.value = ''
  try { await profile.load(auth.token, true) }
  catch (error) { loadError.value = getErrorMessage(error) }
  finally { loading.value = false }
}
// #ifdef MP-WEIXIN
async function bindWechatPhone(phoneCode: string) {
  if (!(await auth.ensureValidSession())) throw new Error('登录已过期，请重新登录')
  await bindWechatPhoneNumber(phoneCode, auth.token)
}
// #endif
function open(url: string) { uni.navigateTo({ url }) }
onShow(load)
</script>
<template>
  <wd-config-provider :theme="themeName">
    <MobileWorkspace container-class="page-shell page-shell--tabbed">
      <MobileTopBar capsule="always" title="我的" />
      <view class="page-body mine-body" role="main">
        <MobileAccountIdentity
          :name="profile.profile?.employeeName || '安全生产用户'"
          :detail="profile.profile?.employeeNo || auth.user?.email || auth.user?.phone || '账号已登录'"
          :initials="Boolean(profile.profile?.employeeName)"
        >
          <template #details>
            <template v-if="profile.profile">
              <view class="mobile-row mobile-row--static">
                <view class="mobile-row__body">
                  <text class="mobile-row__label">所属组织</text>
                  <text class="mobile-row__detail">{{ profile.profile.organizationName || '未绑定组织' }}</text>
                </view>
              </view>
              <view class="mobile-row mobile-row--static">
                <view class="mobile-row__body">
                  <text class="mobile-row__label">联系电话</text>
                  <text class="mobile-row__detail">{{ profile.profile.phone || '未登记' }}</text>
                </view>
              </view>
            </template>
          </template>
        </MobileAccountIdentity>
        <MobileLoadError v-if="loadError" :message="loadError" @retry="load" />
        <MobileLoadingStatus v-if="loading" block label="正在读取员工信息…" />
        <view v-if="profile.profile && !profile.profile.isEmployeeLinked" class="link-warning mobile-inline-pair mobile-inline-pair--start">
          <view class="mobile-inline-pair__icon" aria-hidden="true"><MobileIcon name="notice" size="1em" /></view>
          <text class="mobile-inline-pair__label">当前账号未关联员工档案，排班与现场任务可能不可用，请联系管理员在 Web 端绑定。</text>
        </view>
        <view class="mobile-group-section">
          <MobileSectionHeading title="常用服务" />
          <view class="mobile-group account-links">
            <MobileAction v-for="link in links" :key="link.url" class="mobile-row" @click="open(link.url)">
              <view class="mobile-row__icon" aria-hidden="true"><MobileIcon :name="link.icon" size="18px" /></view>
              <text class="mobile-row__label mobile-row__body">{{ link.name }}</text>
              <MobileIcon class="mobile-row__chevron" name="chevron" size="14px" aria-hidden="true" />
            </MobileAction>
          </view>
        </view>
        <view class="mobile-group-section">
          <MobileSectionHeading title="设置与账号" />
          <view class="mobile-group account-links">
            <MobileAction class="mobile-row" @click="open('/pages/settings/index')">
              <view class="mobile-row__icon" aria-hidden="true"><MobileIcon name="settings" size="18px" /></view>
              <text class="mobile-row__label mobile-row__body">外观设置</text>
              <MobileIcon class="mobile-row__chevron" name="chevron" size="14px" aria-hidden="true" />
            </MobileAction>
            <view class="mobile-row mobile-row--static">
              <view class="mobile-row__icon" aria-hidden="true"><MobileIcon name="shield" size="18px" /></view>
              <view class="mobile-row__body">
                <text class="mobile-row__label">账号与权限</text>
                <text class="mobile-row__detail">与 Web 端同步</text>
              </view>
            </view>
            <!-- #ifdef MP-WEIXIN -->
            <MobileWechatPhoneBinding v-if="isWechatPhoneLoginEnabled && auth.isLoggedIn" :bind-phone="bindWechatPhone" />
            <!-- #endif -->
          </view>
        </view>
        <view class="mobile-group">
          <MobileAction class="mobile-row mobile-row--danger" @click="logoutVisible = true">
            <text class="mobile-row__label">退出登录</text>
          </MobileAction>
        </view>
        <text class="version">SMIS Mobile · v0.1.0</text>
      </view>
      <SmisBottomNav active="mine" />
      <MobileSignOutDialog v-model="logoutVisible" :sign-out="auth.logout" />
    </MobileWorkspace>
  </wd-config-provider>
</template>
<style scoped lang="scss">
.mine-body { display: grid; gap: 16px; min-width: 0; }
.link-warning { --mobile-inline-pair-gap: 8px; --mobile-inline-pair-leading: 1.6; padding: 12px; border-radius: 12px; background: var(--smis-orange-soft); color: var(--mobile-workspace-ink, var(--smis-text-strong)); font-size: max(13px, .8125rem); }
.link-warning .mobile-inline-pair__icon { color: var(--smis-orange-strong); }
.version { text-align: center; color: var(--smis-text-secondary); font-size: max(12px, .75rem); }
</style>
