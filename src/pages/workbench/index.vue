<script setup lang="ts">
import { usePageTheme } from '@/composables/usePageTheme'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import MobileAction from '@mobile-core/components/MobileAction.vue'
import MobileEmptyState from '@mobile-core/components/MobileEmptyState.vue'
import SmisBottomNav from '@/components/business/SmisBottomNav.vue'
import MobileIcon from '@mobile-core/components/MobileIcon.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import MobileSearch from '@mobile-core/components/MobileSearch.vue'
import type { MobileIconName } from '@mobile-core/icons'
import { useAuthStore } from '@/stores/auth'

const { themeName } = usePageTheme()
type AppItem = { title: string; subtitle: string; icon: MobileIconName; url?: string }
type AppGroup = { title: string; items: AppItem[]; reference?: true }
const query = ref('')
const groups: AppGroup[] = [
  { title: '现场作业', items: [
    { title: '风险巡查', subtitle: '查看分派任务并记录结果', icon: 'risk', url: '/pages/risk/index' },
    { title: '隐患排查', subtitle: '逐项确认检查结果', icon: 'inspection', url: '/pages/inspection/index' },
    { title: '隐患治理', subtitle: '跟进整改与验收', icon: 'hazard', url: '/pages/hazards/index' },
    { title: '随手拍', subtitle: '拍照记录并上报隐患', icon: 'camera', url: '/pages/quick-report/index' }
  ]},
  { title: '基础台账', items: [
    { title: '设备台账', subtitle: '查询设备状态和检验日期', icon: 'equipment', url: '/pages/equipment/index' },
    { title: '我的排班', subtitle: '查看班次与休假安排', icon: 'schedule', url: '/pages/schedule/index' }
  ]},
  { title: '仅在 Web 端提供', reference: true, items: [
    { title: '风险辨识', subtitle: '维护风险源与管控措施', icon: 'shield' },
    { title: '特殊作业', subtitle: '管理作业票', icon: 'notice' }
  ]}
]
function open(url: string) { uni.navigateTo({ url }) }
const filteredGroups = computed(() => {
  const terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return groups
    .map(group => ({ ...group, items: group.items.filter(item => terms.every(term => `${group.title} ${item.title} ${item.subtitle}`.toLowerCase().includes(term))) }))
    .filter(group => group.items.length)
})
onShow(() => useAuthStore().ensureValidSession())
</script>
<template>
<wd-config-provider :theme="themeName">
  <view class="page-shell page-shell--tabbed">
    <MobileTopBar capsule="always" title="安全工作台" subtitle="现场任务、设备与排班" />
    <view class="page-body workbench-body" role="main">
      <MobileSearch v-model="query" name="app-keyword" label="搜索应用" placeholder="搜索应用名称或用途…" action-label="" />
      <view v-for="group in filteredGroups" :key="group.title" class="workbench-group">
        <text class="mobile-group-title" :class="{ 'mobile-group-title--reference': group.reference }" role="heading" aria-level="2">{{ group.title }}</text>
        <view class="mobile-group" :class="{ 'mobile-group--reference': group.reference }">
          <template v-for="item in group.items" :key="item.title">
            <MobileAction v-if="item.url" class="mobile-row" @click="open(item.url)">
              <view class="mobile-row__icon"><MobileIcon :name="item.icon" size="18px" /></view>
              <view class="mobile-row__body"><text class="mobile-row__label">{{ item.title }}</text><text class="mobile-row__detail">{{ item.subtitle }}</text></view>
              <MobileIcon class="mobile-row__chevron" name="chevron" size="14px" />
            </MobileAction>
            <view v-else class="mobile-row mobile-row--static">
              <view class="mobile-row__icon"><MobileIcon :name="item.icon" size="18px" /></view>
              <view class="mobile-row__body"><text class="mobile-row__label">{{ item.title }}</text><text class="mobile-row__detail">{{ item.subtitle }}</text></view>
            </view>
          </template>
        </view>
      </view>
      <MobileEmptyState v-if="!filteredGroups.length" icon="search" title="未找到相关应用" description="试试“巡查”“设备”或“排班”" />
    </view>
    <SmisBottomNav active="workbench" />
  </view>
</wd-config-provider>
</template>
<style scoped lang="scss">
.workbench-group { margin-top: 24px; }
.workbench-group .mobile-row__label { font-size: max(15px, .9375rem); }
.workbench-group .mobile-row__detail { font-size: max(13px, .8125rem); }
</style>
