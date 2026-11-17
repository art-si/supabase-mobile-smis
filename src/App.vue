<script setup lang="ts">
import { useStartupData } from '@mobile-core/startup'
import { useAuthStore } from '@/stores/auth'
import { useDictionaryStore } from '@/stores/dictionary'

useStartupData(useAuthStore, useDictionaryStore)
</script>

<style lang="scss">
@use '@mobile-core/styles/global.scss' as mobile;
@use '@mobile-core/styles/grouped-list.scss' as grouped;
@use '@mobile-core/styles/workspace.scss' as workspace;
@use '@mobile-core/styles/control-reset.scss';
@use './styles/theme.scss' as smis;

@include mobile.apply('smis');
@include grouped.styles();
@include workspace.apply('smis', 'smis', $page-class: 'page-shell');
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

@include control-reset.apply('smis');
</style>
