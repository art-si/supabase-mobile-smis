<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import MobileAppearanceSettings from '@mobile-core/components/MobileAppearanceSettings.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import { usePageTheme } from '@/composables/usePageTheme'
import { useAuthStore } from '@/stores/auth'

const { theme, themeName } = usePageTheme()
const auth = useAuthStore()
onShow(() => { void auth.ensureValidSession() })
</script>

<template>
  <wd-config-provider :theme="themeName">
    <view class="page-shell">
      <MobileTopBar capsule="always" title="外观设置" eyebrow="偏好设置" subtitle="调整安全生产移动端的显示方式" show-back />
      <view class="page-body" role="main">
        <MobileAppearanceSettings
          :model-value="theme.preset"
          :persist-preset="theme.selectPreset"
          hint="主题色会立即应用到所有页面，并在下次打开时保留。"
        />
      </view>
    </view>
  </wd-config-provider>
</template>
