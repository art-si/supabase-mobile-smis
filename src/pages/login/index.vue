<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import MobileLogin from '@mobile-core/components/MobileLogin.vue'
import { getErrorMessage } from '@/api/supabase'
import { usePageTheme } from '@/composables/usePageTheme'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'

const { themeName } = usePageTheme()
const auth = useAuthStore()
const profile = useProfileStore()

const brand = {
  name: 'SMIS',
  badge: '移动端',
  eyebrow: '智慧现场安全协同',
  title: '每一处风险，都清晰可控',
  description: '设备、排班、风险与隐患集中处理，让现场安全闭环更简单。',
  benefits: ['任务实时同步', '数据安全连接']
}

function openHome() {
  uni.reLaunch({ url: '/pages/home/index' })
}

onLoad(() => {
  auth.hydrate()
  if (auth.isLoggedIn) openHome()
})

async function authenticate(account: string, password: string) {
  await auth.login(account, password)
  await profile.load(auth.token, true)
}

function explainError(error: unknown) {
  return getErrorMessage(error, '登录失败，请稍后重试')
}
</script>

<template>
  <MobileLogin
    :theme-name="themeName"
    theme-scope="smis"
    :brand="brand"
    account-label="手机号或邮箱"
    account-placeholder="请输入手机号/邮箱"
    account-hint="使用后台分配的手机号或邮箱"
    remember-key="smis-mobile-account"
    help-text="安全生产账号由系统管理员开通与管理"
    forgot-password-text="请联系系统管理员重置密码"
    :authenticate="authenticate"
    :explain-error="explainError"
    @success="openHome"
  />
</template>
