<script setup lang="ts">
import { useStartupData } from '@mobile-core/startup'
import { useAuthStore } from '@/stores/auth'
import { useDictionaryStore } from '@/stores/dictionary'

useStartupData(useAuthStore, useDictionaryStore)
</script>

<style lang="scss">
@use '@mobile-core/styles/global.scss' as mobile;
@use './styles/theme.scss' as smis;

@include mobile.apply('smis');
@include smis.apply();

page {
  min-height: 100%;
  background: var(--smis-bg);
  color: var(--smis-text);
  font-family: var(--smis-font-family);
  font-weight: 400;
  font-synthesis: none;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

view,
text,
button,
input,
textarea {
  box-sizing: border-box;
}

button::after {
  border: 0;
}

button,
[role='button'] {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

button,
input,
textarea {
  font-family: inherit;
}

button:focus-visible,
[role='button']:focus-visible {
  outline: 4rpx solid rgba(var(--smis-primary-rgb), 0.32);
  outline-offset: 4rpx;
}

/* uni-button 不继承页面的 scoped 样式，凭证操作统一放在应用全局层。 */
.smis-evidence-preview {
  display: block;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: inherit;
  background: transparent;
  line-height: 0;
}

.smis-evidence-preview::after,
.smis-evidence-remove::after {
  border: 0;
}

.smis-evidence-preview image {
  display: block;
  width: 100%;
  height: 100%;
}

.smis-evidence-preview:focus-visible {
  outline: 4rpx solid var(--smis-primary);
  outline-offset: -4rpx;
}

.smis-evidence-remove {
  position: absolute;
  z-index: 2;
  top: 0;
  right: 0;
  width: 88rpx;
  height: 88rpx;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  color: #fff;
  background: radial-gradient(circle at center, rgba(16, 24, 40, 0.78) 21rpx, transparent 22rpx);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  line-height: 1;
}

.smis-evidence-remove:focus-visible {
  outline: 4rpx solid var(--smis-primary);
  outline-offset: -4rpx;
}

/* #ifdef H5 */
uni-scroll-view .uni-scroll-view {
  scrollbar-width: none;
}

uni-scroll-view .uni-scroll-view::-webkit-scrollbar {
  width: 0;
  height: 0;
}
/* #endif */

input,
textarea {
  caret-color: var(--smis-primary);
}
</style>
