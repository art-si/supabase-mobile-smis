<script setup lang="ts">
import { usePageTheme } from '@/composables/usePageTheme'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import SmisBottomNav from '@/components/business/SmisBottomNav.vue'
import SmisIcon from '@/components/business/SmisIcon.vue'
import MobileTopBar from '@mobile-core/components/MobileTopBar.vue'
import SmisSearchBar from '@/components/business/SmisSearchBar.vue'
import { useAuthStore } from '@/stores/auth'

const { themeName } = usePageTheme()
type AppItem = { title: string; subtitle: string; icon: string; tone: string; url: string; available?: boolean }
const query = ref('')
const groups: Array<{ title: string; eyebrow: string; items: AppItem[] }> = [
  { title: '现场作业', eyebrow: 'FIELD WORK', items: [
    { title:'风险巡查',subtitle:'分级管控任务',icon:'risk',tone:'blue',url:'/pages/risk/index',available:true },
    { title:'隐患排查',subtitle:'逐项检查与留痕',icon:'inspection',tone:'yellow',url:'/pages/inspection/index',available:true },
    { title:'隐患治理',subtitle:'整改验收闭环',icon:'hazard',tone:'orange',url:'/pages/hazards/index',available:true },
    { title:'随手拍',subtitle:'现场快速上报',icon:'camera',tone:'red',url:'/pages/quick-report/index',available:true }
  ]},
  { title: '基础台账', eyebrow: 'FOUNDATION', items: [
    { title:'设备台账',subtitle:'设备状态与档案',icon:'equipment',tone:'green',url:'/pages/equipment/index',available:true },
    { title:'我的排班',subtitle:'月历与班次',icon:'schedule',tone:'violet',url:'/pages/schedule/index',available:true },
    { title:'风险辨识',subtitle:'风险源与措施',icon:'shield',tone:'blue',url:'',available:false },
    { title:'特殊作业',subtitle:'作业票协同',icon:'notice',tone:'orange',url:'',available:false }
  ]}
]
function open(item: AppItem) { item.available ? uni.navigateTo({ url: item.url }) : uni.showToast({ title: '该能力由 Web 端维护，请在 Web 端使用', icon: 'none' }) }
function visible(item: AppItem) { const value = query.value.trim(); return !value || `${item.title}${item.subtitle}`.includes(value) }
const filteredGroups = computed(() => groups.map(group => ({ ...group, items: group.items.filter(visible) })).filter(group => group.items.length))
onShow(() => useAuthStore().ensureValidSession())
</script>
<template>
<wd-config-provider :theme="themeName">
  <view class="page-shell"><MobileTopBar capsule="none" title="安全工作台" eyebrow="SAFETY WORKBENCH" subtitle="任务、台账与现场闭环" />
    <view class="page-body workbench-body">
      <SmisSearchBar v-model="query" placeholder="搜索应用" />
      <view v-for="group in filteredGroups" :key="group.title" class="app-group"><view class="app-group__head"><view><text>{{ group.eyebrow }}</text><text class="strong">{{ group.title }}</text></view><view class="i" /></view><view class="app-grid"><button v-for="item in group.items" :key="item.title" class="app" :class="{ 'app--disabled': !item.available }" @tap="open(item)"><view class="app__icon" :class="`app__icon--${item.tone}`"><SmisIcon :name="item.icon" size="46rpx" /></view><text v-if="!item.available" class="app__availability">Web 端</text><view class="app__copy"><text>{{ item.title }}</text><text class="small">{{ item.subtitle }}</text></view></button></view></view>
      <view v-if="!filteredGroups.length" class="search-empty"><SmisIcon name="search" size="48rpx" /><text>未找到相关应用</text><text class="small">试试“巡查”“设备”或“排班”</text></view>
      <view class="web-note"><SmisIcon name="shield" size="38rpx" /><view><text>统一业务口径</text><text class="small">字典、权限、状态流转与 SMIS Web 端保持一致</text></view></view>
    </view><SmisBottomNav active="workbench" />
  </view>
</wd-config-provider>
</template>
<style scoped lang="scss">
.workbench-body { padding-top: 24rpx; }
.app-group { margin-top: 32rpx; }
.app-group__head { margin-bottom: 20rpx; }
.app-group__head > view:first-child { display: flex; flex-direction: column; }
.app-group__head text:first-child { display: none; }
.app-group__head .strong { font-size: clamp(17px, 30rpx, 19px); font-weight: 700; color: var(--smis-text); }
.app-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18rpx; }
.app { position: relative; min-width: 0; margin: 0; padding: 24rpx; border: 1rpx solid var(--smis-line); border-radius: 24rpx; background: #fff; text-align: left; }
.app__icon { width: 64rpx; height: 64rpx; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; }
.app__icon--blue { color: var(--smis-primary); background: var(--smis-primary-soft); }
.app__icon--yellow { color: #96610e; background: #fff2d1; }
.app__icon--orange { color: var(--smis-warning); background: #faeadf; }
.app__icon--red { color: var(--smis-danger); background: #fbe9e8; }
.app__icon--green { color: var(--smis-success); background: #e4f2eb; }
.app__icon--violet { color: #715aa3; background: #f0ecf7; }
.app__copy { margin-top: 16rpx; display: flex; flex-direction: column; gap: 8rpx; }
.app__copy text { font-size: clamp(15px, 28rpx, 17px); font-weight: 700; line-height: 1.4; color: var(--smis-text); }
.app__copy .small { font-size: clamp(13px, 22rpx, 14px); color: var(--smis-text-secondary); font-weight: 400; }
.app__availability { position: absolute; top: 24rpx; right: 20rpx; font-size: 12px; color: var(--smis-text-secondary); }
.app--disabled { background: var(--smis-panel); }
.web-note { margin-top: 24rpx; padding: 24rpx; border-radius: 20rpx; background: var(--smis-primary-soft); color: var(--smis-primary); display: flex; align-items: flex-start; gap: 18rpx; }
.web-note > view { min-width: 0; display: flex; flex-direction: column; gap: 8rpx; }
.web-note text { font-size: clamp(14px, 24rpx, 15px); font-weight: 600; }
.web-note .small { color: var(--smis-text-secondary); font-size: 13px; line-height: 1.6; font-weight: 400; }
.search-empty { padding: 56rpx 20rpx; color: var(--smis-text-secondary); display: flex; flex-direction: column; align-items: center; gap: 16rpx; font-size: 15px; }
.search-empty .small { font-size: 13px; }
</style>
