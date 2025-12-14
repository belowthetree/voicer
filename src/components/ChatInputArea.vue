<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '../stores'
import { useRemoteStore } from '../stores/remote-store'
import { useChatCommands } from '../composables/useChatCommands'
import { 
  NInput, NButton, NIcon, NTooltip, NPopover, NText,
  NScrollbar, NCollapse, NCollapseItem, NTag, NAlert, NSpin
} from 'naive-ui'
import { 
  Send, Trash, TerminalOutline, Reload, ChevronUp, 
  FlashOutline, Play, StopCircle, PauseCircle, RefreshCircle
} from '@vicons/ionicons5'

const store = useAppStore()
const remoteStore = useRemoteStore()
const {
  hasCommands,
  commandsCount,
  isLoadingCommands,
  commandsError,
  commandsLastUpdated,
  groupedCommands,
  popularCommands,
  getCommandIcon,
  getCommandColor,
  refreshCommands,
  sendCommand,
  quickSendCommand
} = useChatCommands()

const messageInput = ref('')
const showCommandsPanel = ref(false)
const isSendingCommand = ref(false)

// 发送消息
const sendMessage = async () => {
  if (!messageInput.value.trim() || store.isLoading) return
  
  const message = messageInput.value
  messageInput.value = ''
  
  try {
    await store.sendMessageToAI(message)
  } catch (err) {
    // 错误已在store中处理
  }
}

// 清空消息
const clearMessages = () => {
  store.clearMessages()
}

// 中断模型输出
const interruptGeneration = async () => {
  if (!store.isRemoteConnected) return
  
  try {
    await remoteStore.sendInterrupt()
    store.isLoading = false
    store.loadingProgress = 0
  } catch (err: any) {
    console.error('中断生成失败:', err)
  }
}

// 重新生成回复
const regenerateResponse = async () => {
  if (!store.isRemoteConnected || store.messages.length === 0) return
  
  try {
    // 移除最后一条AI回复（如果有）
    const lastMessageIndex = store.messages.length - 1
    if (lastMessageIndex >= 0 && !store.messages[lastMessageIndex].isUser) {
      store.messages.splice(lastMessageIndex, 1)
    }
    
    // 发送重新生成请求
    await remoteStore.sendRegenerate()
    
    // 重新生成后，重新开始加载状态
    store.isLoading = true
    store.loadingProgress = 0
    
    // 添加重新生成的视觉反馈
    const feedbackId = Date.now().toString()
    store.messages.push({
      id: feedbackId,
      content: '正在重新生成回复...',
      isUser: false,
      timestamp: Date.now(),
      status: 'sending'
    })
    
    // 模拟等待新回复（实际由远程服务器处理）
    setTimeout(() => {
      const messageIndex = store.messages.findIndex(m => m.id === feedbackId)
      if (messageIndex !== -1) {
        store.messages[messageIndex].content = '重新生成请求已发送到远程服务器，等待回复...'
        store.messages[messageIndex].status = 'sent'
      }
    }, 500)
    
  } catch (err: any) {
    console.error('重新生成失败:', err)
    // 添加错误反馈
    store.addMessage(`重新生成失败: ${err.message}`, false)
  }
}

    // 发送命令（带参数）
    const sendCommandWithParams = async (commandName: string, parameters: Record<string, any> = {}) => {
      if (isSendingCommand.value) return
      
      isSendingCommand.value = true
      try {
        const response = await sendCommand(commandName, parameters)
        
        // 添加命令消息到聊天
        const commandDisplay = `执行命令: ${commandName}${Object.keys(parameters).length > 0 ? ` (参数: ${JSON.stringify(parameters)})` : ''}`
        store.addMessage(commandDisplay, true)
        
        // 添加响应消息（确保 response 是字符串）
        const responseText = typeof response === 'string' ? response : JSON.stringify(response, null, 2)
        store.addMessage(responseText, false)
      } catch (err: any) {
        console.error('发送命令失败:', err)
        // 添加错误消息
        store.addMessage(`执行命令 ${commandName} 失败: ${err.message}`, false)
      } finally {
        isSendingCommand.value = false
      }
    }

// 快速发送命令（无参数）
const quickSendCommandHandler = (commandName: string) => {
  sendCommandWithParams(commandName)
}
</script>

<template>
  <div class="input-area">
    <!-- 命令面板 -->
    <div v-if="showCommandsPanel && store.isRemoteConnected" class="commands-panel">
      <div class="commands-header">
        <div class="commands-title">
          <NIcon :component="TerminalOutline" size="18" />
          <span>可用命令 ({{ commandsCount }})</span>
          <NTag v-if="commandsLastUpdated" size="small" type="info" round>
            更新于 {{ commandsLastUpdated }}
          </NTag>
        </div>
        <div class="commands-actions">
          <NButton 
            size="tiny" 
            @click="refreshCommands" 
            :loading="isLoadingCommands"
            :disabled="isLoadingCommands"
          >
            <template #icon>
              <NIcon :component="Reload" size="12" />
            </template>
            刷新
          </NButton>
          <NButton size="tiny" @click="showCommandsPanel = false">
            <template #icon>
              <NIcon :component="ChevronUp" size="12" />
            </template>
            收起
          </NButton>
        </div>
      </div>
      
      <div v-if="commandsError" class="commands-error">
        <NAlert type="error" :title="commandsError" closable>
          <NButton size="small" @click="refreshCommands" :loading="isLoadingCommands">
            重试
          </NButton>
        </NAlert>
      </div>
      
      <div v-else-if="isLoadingCommands" class="commands-loading">
        <NSpin size="small" />
        <span>正在加载命令列表...</span>
      </div>
      
      <div v-else-if="!hasCommands" class="commands-empty">
        <NIcon :component="TerminalOutline" size="48" :depth="3" />
        <p>暂无可用命令</p>
        <NButton size="small" @click="refreshCommands">
          刷新列表
        </NButton>
      </div>
      
      <NScrollbar v-else style="max-height: 300px;">
        <!-- 热门命令 -->
        <div v-if="popularCommands.length > 0" class="commands-section">
          <div class="section-title">
            <NIcon :component="FlashOutline" size="16" />
            <span>热门命令</span>
          </div>
          <div class="commands-grid">
            <div 
              v-for="command in popularCommands" 
              :key="command.name"
              class="command-card"
              @click="quickSendCommandHandler(command.name)"
            >
              <div class="command-icon">
                <NIcon :component="getCommandIcon(command.name)" size="20" />
              </div>
              <div class="command-info">
                <div class="command-name">{{ command.name }}</div>
                <div class="command-desc">{{ command.description }}</div>
              </div>
              <div class="command-action">
                <NButton circle size="tiny" :type="getCommandColor(command.name) as any">
                  <template #icon>
                    <NIcon :component="Play" size="12" />
                  </template>
                </NButton>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 所有命令分组 -->
        <NCollapse v-if="groupedCommands.length > 0" :default-expanded-names="groupedCommands.map(g => g.name).slice(0, 3)">
          <NCollapseItem 
            v-for="group in groupedCommands" 
            :key="group.name"
            :name="group.name"
            :title="group.name.toUpperCase()"
          >
            <template #header-extra>
              <NTag size="small" type="info" round>{{ group.commands.length }}</NTag>
            </template>
            <div class="grouped-commands">
              <div 
                v-for="command in group.commands" 
                :key="command.name"
                class="grouped-command-item"
                @click="quickSendCommandHandler(command.name)"
              >
                <div class="command-item-icon">
                  <NIcon :component="getCommandIcon(command.name)" size="16" />
                </div>
                <div class="command-item-info">
                  <div class="command-item-name">{{ command.name }}</div>
                  <div class="command-item-desc">{{ command.description }}</div>
                </div>
                <div class="command-item-action">
                  <NButton text size="tiny" @click.stop="quickSendCommandHandler(command.name)">
                    执行
                  </NButton>
                </div>
              </div>
            </div>
          </NCollapseItem>
        </NCollapse>
      </NScrollbar>
    </div>
    
    <div class="input-wrapper">
      <div class="input-left-actions">
        <!-- 中断按钮 -->
        <NTooltip v-if="store.isRemoteConnected && store.isLoading" trigger="hover">
          <template #trigger>
            <NButton 
              circle
              @click="interruptGeneration"
              type="warning"
              size="medium"
              class="interrupt-button"
            >
              <template #icon>
                <NIcon :component="PauseCircle" size="16" />
              </template>
            </NButton>
          </template>
          中断模型输出
        </NTooltip>

        <!-- 重新生成按钮 -->
        <NTooltip v-if="store.isRemoteConnected && !store.isLoading && store.messages.length > 0" trigger="hover">
          <template #trigger>
            <NButton 
              circle
              @click="regenerateResponse"
              type="info"
              size="medium"
              class="regenerate-button"
            >
              <template #icon>
                <NIcon :component="RefreshCircle" size="16" />
              </template>
            </NButton>
          </template>
          重新生成回复
        </NTooltip>

        <!-- 命令按钮 -->
        <NTooltip v-if="store.isRemoteConnected && hasCommands" trigger="hover">
          <template #trigger>
            <NButton 
              circle
              @click="showCommandsPanel = !showCommandsPanel"
              :type="showCommandsPanel ? 'primary' : 'default'"
              :loading="isLoadingCommands"
              size="medium"
              class="command-button"
            >
              <template #icon>
                <NIcon :component="TerminalOutline" size="16" />
              </template>
            </NButton>
          </template>
          显示可用命令 ({{ commandsCount }})
        </NTooltip>
      </div>
      
      <NInput 
        v-model:value="messageInput" 
        type="textarea" 
        placeholder="输入消息..." 
        :autosize="{ minRows: 1, maxRows: 4 }"
        @keydown.enter.exact.prevent="sendMessage"
        :disabled="store.isLoading"
        round
        class="message-input"
      />
      <div class="input-right-actions">
        <NButton 
          circle 
          type="primary" 
          @click="sendMessage" 
          :loading="store.isLoading" 
          :disabled="store.isLoading || !messageInput.trim()"
          size="medium"
          class="send-button"
        >
          <template #icon>
            <NIcon><Send /></NIcon>
          </template>
        </NButton>
        <NPopover trigger="hover">
          <template #trigger>
            <NButton 
              circle 
              @click="clearMessages" 
              :disabled="store.isLoading || store.messages.length === 0"
              size="medium"
              class="clear-button"
            >
              <template #icon>
                <NIcon><Trash /></NIcon>
              </template>
            </NButton>
          </template>
          清空对话
        </NPopover>
      </div>
    </div>
    <div class="input-footer">
      <NText depth="3" size="small">
        按 Enter 发送，Shift + Enter 换行
      </NText>
    </div>
    
    <!-- 命令发送状态 -->
    <div v-if="isSendingCommand" class="command-sending">
      <div class="sending-indicator">
        <NSpin size="small" />
        <span>正在执行命令...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-area {
  padding: 20px;
  background-color: #ffffff;
  border-top: 1px solid #e5e5e5;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-left-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.input-right-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.message-input {
  flex: 1;
}

.message-input :deep(.n-input__textarea) {
  font-size: 15px;
  line-height: 1.5;
}

.message-input :deep(.n-input__textarea::placeholder) {
  color: #9ca3af;
}

.command-button {
  color: #6b7280 !important;
  border-color: #e5e5e5 !important;
}

.command-button:hover {
  background-color: #f7f7f8 !important;
  border-color: #d4d4d4 !important;
}

.command-button.primary {
  background-color: #10a37f !important;
  border-color: #10a37f !important;
  color: white !important;
}

.command-button.primary:hover {
  background-color: #0d8c6d !important;
  border-color: #0d8c6d !important;
}

.send-button {
  background-color: #10a37f !important;
  border-color: #10a37f !important;
}

.send-button:hover {
  background-color: #0d8c6d !important;
  border-color: #0d8c6d !important;
}

.clear-button {
  color: #6b7280 !important;
  border-color: #e5e5e5 !important;
}

.clear-button:hover {
  background-color: #f7f7f8 !important;
  border-color: #d4d4d4 !important;
}

.input-footer {
  margin-top: 8px;
  text-align: center;
}

/* 命令面板样式 */
.commands-panel {
  background-color: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  margin: 0 20px 16px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  animation: slide-down 0.3s ease-out;
}

@keyframes slide-down {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.commands-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e5e5;
}

.commands-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #374151;
  font-size: 15px;
}

.commands-actions {
  display: flex;
  gap: 8px;
}

.commands-error {
  padding: 12px 16px;
}

.commands-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: #6b7280;
}

.commands-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: #9ca3af;
  text-align: center;
}

.commands-empty p {
  margin: 12px 0 16px 0;
  font-size: 14px;
}

.commands-section {
  padding: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.commands-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.command-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: #f9fafb;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.command-card:hover {
  background-color: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.command-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e5e5;
  flex-shrink: 0;
}

.command-info {
  flex: 1;
  min-width: 0;
}

.command-name {
  font-weight: 600;
  font-size: 13px;
  color: #374151;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-desc {
  font-size: 11px;
  color: #6b7280;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.command-action {
  flex-shrink: 0;
}

.grouped-commands {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grouped-command-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background-color: #ffffff;
  border: 1px solid #f3f4f6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.grouped-command-item:hover {
  background-color: #f9fafb;
  border-color: #e5e5e5;
}

.command-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background-color: #f9fafb;
  border-radius: 6px;
  flex-shrink: 0;
}

.command-item-info {
  flex: 1;
  min-width: 0;
}

.command-item-name {
  font-weight: 500;
  font-size: 13px;
  color: #374151;
  margin-bottom: 2px;
}

.command-item-desc {
  font-size: 11px;
  color: #6b7280;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-item-action {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.grouped-command-item:hover .command-item-action {
  opacity: 1;
}

.command-sending {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.sending-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: #f9fafb;
  border-radius: 8px;
  color: #6b7280;
  font-size: 14px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .input-area {
    padding: 12px;
  }
  
  .input-wrapper {
    gap: 8px;
  }
  
  .input-left-actions,
  .input-right-actions {
    gap: 6px;
  }
  
  .commands-panel {
    margin: 0 12px 12px 12px;
  }
  
  .commands-header {
    padding: 10px 12px;
  }
  
  .commands-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  
  .command-card {
    padding: 10px;
  }
  
  .commands-section {
    padding: 12px;
  }
  
  .grouped-command-item {
    padding: 8px 10px;
  }
}
</style>
