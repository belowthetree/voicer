<script setup lang="ts">
import { useRemoteStore } from '../stores/remote-store'
import { 
  NButton, NIcon, NTooltip, NPopover, NText, NTag,
  NDivider, NSpace, NAvatar, NBadge
} from 'naive-ui'
import { 
  SettingsOutline, Power, Refresh, InformationCircleOutline,
  CloudOutline, CloudOfflineOutline, CloudDownloadOutline
} from '@vicons/ionicons5'

const remoteStore = useRemoteStore()

// 定义props
const props = defineProps<{
  isRemoteConnected: boolean
  remoteStatusText: string
  remoteStatusColor: string
  remoteStatusTag: any
}>()

// 定义事件
const emit = defineEmits<{
  connect: []
  disconnect: []
  openConfig: []
  openAbout: []
}>()

// 切换远程连接
const toggleRemoteConnection = () => {
  if (props.isRemoteConnected) {
    emit('disconnect')
  } else {
    emit('connect')
  }
}

// 刷新远程状态
const refreshRemoteStatus = () => {
  // 这里可以添加刷新逻辑，比如重新获取命令列表
  remoteStore.refreshCommands().catch(err => {
    console.warn('刷新命令列表失败:', err)
  })
}

// 打开远程配置
const openRemoteConfig = () => {
  emit('openConfig')
}

// 打开关于信息
const openAbout = () => {
  emit('openAbout')
}
</script>

<template>
  <div class="chat-toolbar">
    <div class="toolbar-left">
      <!-- 应用标题 -->
      <div class="app-title">
        <NAvatar round size="small" src="/favicon.ico" />
        <span class="title-text">Voicer AI</span>
        <NTag size="small" type="info" round>v1.0.0</NTag>
      </div>
    </div>
    
    <div class="toolbar-center">
      <!-- 远程连接状态 -->
      <div class="remote-status">
        <NBadge :value="props.isRemoteConnected ? '在线' : '离线'" :type="props.remoteStatusColor as any" dot>
          <NButton 
            size="small" 
            :type="props.remoteStatusColor as any" 
            @click="toggleRemoteConnection"
            :loading="remoteStore.isConnecting"
          >
            <template #icon>
              <NIcon>
                <CloudOutline v-if="props.isRemoteConnected" />
                <CloudOfflineOutline v-else />
              </NIcon>
            </template>
            {{ props.remoteStatusText }}
          </NButton>
        </NBadge>
        
        <!-- 连接统计 -->
        <NPopover trigger="hover" v-if="props.isRemoteConnected">
          <template #trigger>
            <NButton size="tiny" text @click="refreshRemoteStatus">
              <template #icon>
                <NIcon><Refresh /></NIcon>
              </template>
            </NButton>
          </template>
          <div class="connection-stats">
            <div class="stat-item">
              <span class="stat-label">消息发送:</span>
              <span class="stat-value">{{ remoteStore.messagesSent }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">消息接收:</span>
              <span class="stat-value">{{ remoteStore.messagesReceived }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">命令发送:</span>
              <span class="stat-value">{{ remoteStore.commandsSent }}</span>
            </div>
          </div>
        </NPopover>
      </div>
    </div>
    
    <div class="toolbar-right">
      <NSpace :size="8">
        <!-- 远程配置按钮 -->
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton 
              size="small" 
              circle 
              @click="openRemoteConfig"
              :disabled="remoteStore.isConnecting"
            >
              <template #icon>
                <NIcon><SettingsOutline /></NIcon>
              </template>
            </NButton>
          </template>
          远程服务器配置
        </NTooltip>
        
        <NDivider vertical />
        
        <!-- 关于按钮 -->
        <NTooltip trigger="hover">
          <template #trigger>
            <NButton 
              size="small" 
              circle 
              @click="openAbout"
            >
              <template #icon>
                <NIcon><InformationCircleOutline /></NIcon>
              </template>
            </NButton>
          </template>
          关于应用
        </NTooltip>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.chat-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e5e5;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.toolbar-left,
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-text {
  font-weight: 600;
  font-size: 16px;
  color: #374151;
}

.remote-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.connection-stats {
  padding: 8px;
  min-width: 150px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
}

.stat-label {
  color: #6b7280;
}

.stat-value {
  font-weight: 600;
  color: #374151;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .chat-toolbar {
    padding: 8px 12px;
  }
  
  .title-text {
    font-size: 14px;
  }
  
  .remote-status {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
