<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { usePageTheme } from '@/composables/usePageTheme'
import SmisBottomNav from '@/components/business/SmisBottomNav.vue'
import SmisIcon from '@/components/business/SmisIcon.vue'
import SmisLoadError from '@/components/business/SmisLoadError.vue'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { getErrorMessage } from '@/api/supabase'

const { themeName } = usePageTheme()
const auth = useAuthStore()
const profile = useProfileStore()
const loading = ref(false)
const loadError = ref('')
async function load() {
  if (loading.value || !(await auth.ensureValidSession())) return
  loading.value = true
  loadError.value = ''
  try { await profile.load(auth.token, true) }
  catch (error) { loadError.value = getErrorMessage(error) }
  finally { loading.value = false }
}
function logout() {
  uni.showModal({ title: '退出登录', content: '退出后需要重新验证账号，是否继续？', confirmText: '退出', success: result => { if (result.confirm) void auth.logout() } })
}
function open(url: string) { uni.navigateTo({ url }) }
function showPermission() { uni.showToast({ title: '数据与 Web 端权限同步', icon: 'none' }) }
onShow(load)
</script>
<template>
<wd-config-provider :theme="themeName"><view class="page-shell"><view class="profile-hero"><view class="profile-hero__avatar">{{(profile.profile?.employeeName||'安').slice(-1)}}</view><view class="profile-hero__copy"><text>{{profile.profile?.employeeName||'安全生产用户'}}</text><text class="small">{{profile.profile?.employeeNo||auth.user?.email||auth.user?.phone||'账号已登录'}}</text></view><view class="profile-hero__status"><view class="i"/>已登录</view></view><view class="page-body mine-body"><SmisLoadError v-if="loadError" :message="loadError" @retry="load"/><view v-if="loading" class="profile-loading" aria-live="polite"><wd-loading color="var(--smis-primary)"/><text>正在读取员工信息…</text></view><view class="identity surface-card"><view><text>所属组织</text><text class="strong">{{profile.profile?.organizationName||'未绑定组织'}}</text></view><view><text>联系电话</text><text class="strong">{{profile.profile?.phone||'--'}}</text></view></view><view class="menu surface-card"><button @tap="open('/pages/schedule/index')"><view><SmisIcon name="schedule" size="38rpx"/></view><text>我的排班</text><SmisIcon name="chevron" size="28rpx"/></button><button @tap="open('/pages/messages/index')"><view><SmisIcon name="message" size="38rpx"/></view><text>安全消息</text><SmisIcon name="chevron" size="28rpx"/></button><button @tap="open('/pages/settings/index')"><view><SmisIcon name="settings" size="38rpx"/></view><text>外观设置</text><SmisIcon name="chevron" size="28rpx"/></button><button @tap="showPermission"><view><SmisIcon name="shield" size="38rpx"/></view><text>账号与权限</text><SmisIcon name="chevron" size="28rpx"/></button></view><view v-if="profile.profile && !profile.profile.isEmployeeLinked" class="link-warning"><SmisIcon name="notice" size="34rpx"/><text>当前账号未关联员工档案，排班与现场任务可能不可用，请联系管理员在 Web 端绑定。</text></view><button class="logout" @tap="logout">退出登录</button><text class="version">SMIS Mobile · v0.1.0</text></view><SmisBottomNav active="mine"/></view></wd-config-provider>
</template>
<style scoped lang="scss">
.profile-hero { padding: calc(36rpx + env(safe-area-inset-top)) 28rpx 40rpx; background: var(--smis-hero-gradient); color: #fff; display: grid; grid-template-columns: 88rpx minmax(0, 1fr); gap: 20rpx; align-items: center; }
.profile-hero__avatar { width: 88rpx; height: 88rpx; border: 3rpx solid rgba(255,255,255,.2); border-radius: 28rpx; background: #f5b942; color: #493200; font-size: 24px; font-weight: 700; display: flex; align-items: center; justify-content: center; grid-row: 1 / 3; }
.profile-hero__copy { min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.profile-hero__copy text { font-size: clamp(20px, 36rpx, 22px); font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.profile-hero__copy .small { font-size: 13px; color: rgba(255,255,255,.88); font-weight: 400; }
.profile-hero__status { justify-self: start; display: flex; align-items: center; gap: 8rpx; font-size: 12px; color: rgba(255,255,255,.9); }
.profile-hero__status .i { width: 10rpx; height: 10rpx; border-radius: 50%; background: #60d09b; }
.mine-body { padding-top: 24rpx; }
.identity { padding: 26rpx; }
.identity > view { display: flex; flex-direction: column; gap: 12rpx; padding: 8rpx 0; }
.identity > view + view { margin-top: 20rpx; padding-top: 22rpx; border-top: 1rpx solid var(--smis-line); }
.identity text { font-size: 13px; color: var(--smis-text-secondary); }
.identity .strong { font-size: 15px; color: var(--smis-text); line-height: 1.6; }
.menu { margin-top: 24rpx; }
.menu button { width: 100%; min-height: max(112rpx, 60px); margin: 0; padding: 16rpx 24rpx; border: 0; border-radius: 0; background: #fff; text-align: left; display: flex; align-items: center; gap: 20rpx; }
.menu button + button { border-top: 1rpx solid var(--smis-line); }
.menu button > view { width: 64rpx; height: 64rpx; flex: none; border-radius: 18rpx; background: var(--smis-primary-soft); color: var(--smis-primary); display: flex; align-items: center; justify-content: center; }
.menu button > text { flex: 1; font-size: 15px; font-weight: 600; }
.link-warning { margin-top: 24rpx; padding: 24rpx; border-radius: 20rpx; background: #fff1df; color: #91551e; display: flex; align-items: flex-start; gap: 14rpx; font-size: 13px; line-height: 1.7; }
.logout { width: 100%; min-height: 48px; margin-top: 28rpx; border: 1rpx solid var(--smis-line); border-radius: 20rpx; background: #fff; color: var(--smis-danger); font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.version { display: block; margin-top: 24rpx; text-align: center; color: var(--smis-text-secondary); font-size: 12px; }
.profile-loading { padding: 24rpx; display: flex; align-items: center; justify-content: center; gap: 16rpx; color: var(--smis-text-secondary); font-size: 14px; }
</style>
