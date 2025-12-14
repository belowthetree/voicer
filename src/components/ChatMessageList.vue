<script setup lang="ts">
import { useAppStore } from '../stores'
import { useRemoteStore } from '../stores/remote-store'
import { useChatMessages } from '../composables/useChatMessages'
import { 
  NAvatar, NButton, NIcon, NSpin, NAlert, NText, NTag, NCard, NPopover
} from 'naive-ui'
import { 
  WarningOutline, Copy, Checkmark, Refresh, StopCircle,
  CheckmarkCircle, CloseCircle, InformationCircle
} from '@vicons/ionicons5'
import { computed } from 'vue'

const appStore = useAppStore()
const remoteStore = useRemoteStore()
const { 
  messageContainer, 
  copiedMessageId, 
  retryLastMessage, 
  copyMessage, 
  stopGenerating,
  marked 
} = useChatMessages()

// 处理工具确认
const handleApproveToolCall = (requestId: string, name: string, arguments_: Record<string, any>) => {
  remoteStore.approveToolCall(requestId, name, arguments_, '用户已批准')
}

const handleRejectToolCall = (requestId: string, name: string, arguments_: Record<string, any>) => {
  remoteStore.rejectToolCall(requestId, name, arguments_, '用户已拒绝')
}

// 格式化工具参数为可读字符串
const formatToolArguments = (args: Record<string, any>): string => {
  try {
    return JSON.stringify(args, null, 2)
  } catch {
    return String(args)
  }
}

// 获取工具确认消息的状态标签
const getToolConfirmationStatusTag = (status: string) => {
  switch (status) {
    case 'pending':
      return { type: 'warning' as const, text: '待确认' }
    case 'approved':
      return { type: 'success' as const, text: '已批准' }
    case 'rejected':
      return { type: 'error' as const, text: '已拒绝' }
    default:
      return { type: 'default' as const, text: status }
  }
}
</script>

<template>
  <div class="message-list" ref="messageContainer">
    <template v-if="appStore.messages.length === 0">
      <div class="empty-state">
        <div class="welcome-icon">
          <NAvatar round size="large" :style="{ backgroundColor: '#10a37f' }">
            <span style="color: white; font-weight: bold">AI</span>
          </NAvatar>
        </div>
        <h3>欢迎使用AI助手</h3>
        <p class="welcome-text">我可以帮助您解答问题、编写代码、分析问题等</p>
        <div class="example-prompts">
          <div class="prompt" @click="$emit('prompt-click', '帮我写一个Python函数来计算斐波那契数列')">
            帮我写一个Python函数来计算斐波那契数列
          </div>
          <div class="prompt" @click="$emit('prompt-click', '解释一下什么是机器学习')">
            解释一下什么是机器学习
          </div>
          <div class="prompt" @click="$emit('prompt-click', '如何优化网页性能？')">
            如何优化网页性能？
          </div>
        </div>
      </div>
    </template>
    
    <div v-for="message in appStore.messages" :key="message.id" 
         :class="['message', 
                 message.type === 'text' && message.isUser ? 'user-message' : 'ai-message', 
                 message.type === 'text' && message.status === 'sending' ? 'sending' : '',
                 message.type === 'text' && message.status === 'error' ? 'error' : '']">
      
      <!-- 文本消息 -->
      <div v-if="message.type === 'text'" class="message-wrapper">
        <div class="message-avatar">
          <NAvatar round size="small" :style="message.isUser ? { backgroundColor: '#10a37f' } : { backgroundColor: '#ececf1' }">
            <span :style="message.isUser ? { color: 'white' } : { color: '#000' }">
              {{ message.isUser ? '你' : 'AI' }}
            </span>
          </NAvatar>
        </div>
        <div class="message-content-wrapper">
          <div class="message-content" v-html="message.isUser ? message.content : marked.parse(message.content)"></div>
          <div class="message-actions" v-if="!message.isUser && message.status !== 'sending'">
            <NButton text size="tiny" @click="copyMessage(message.content, message.id)">
              <template #icon>
                <NIcon size="14">
                  <Checkmark v-if="copiedMessageId === message.id" />
                  <Copy v-else />
                </NIcon>
              </template>
              {{ copiedMessageId === message.id ? '已复制' : '复制' }}
            </NButton>
          </div>
          <div class="message-meta">
            <div class="message-status" v-if="message.status === 'sending'">
              <NSpin size="small" />
              <span>发送中...</span>
            </div>
            <div class="message-status error" v-else-if="message.status === 'error'">
              <NIcon size="14"><WarningOutline /></NIcon>
              <span>发送失败</span>
              <NButton text size="tiny" @click="retryLastMessage">
                <template #icon>
                  <NIcon size="12"><Refresh /></NIcon>
                </template>
                重试
              </NButton>
            </div>
            <div class="message-time">{{ new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</div>
          </div>
        </div>
      </div>
      
      <!-- 工具确认消息 -->
      <div v-else-if="message.type === 'tool-confirmation'" class="tool-confirmation-wrapper">
        <div class="message-avatar">
          <NAvatar round size="small" :style="{ backgroundColor: '#f0ad4e' }">
            <NIcon size="16" :style="{ color: 'white' }">
              <InformationCircle />
            </NIcon>
          </NAvatar>
        </div>
        <div class="tool-confirmation-content">
          <NCard size="small" :bordered="false" :style="{ backgroundColor: '#fff9e6', borderRadius: '12px' }">
            <div class="tool-confirmation-header">
              <div class="tool-confirmation-title">
                <span class="tool-name">{{ message.name }}</span>
                <NTag :type="getToolConfirmationStatusTag(message.status).type" size="small" round>
                  {{ getToolConfirmationStatusTag(message.status).text }}
                </NTag>
              </div>
              <div class="tool-description" v-if="message.description">
                {{ message.description }}
              </div>
            </div>
            
            <div class="tool-arguments" v-if="Object.keys(message.arguments).length > 0">
              <div class="arguments-title">参数:</div>
              <pre class="arguments-content">{{ formatToolArguments(message.arguments) }}</pre>
            </div>
            
            <div class="tool-confirmation-actions" v-if="message.status === 'pending'">
              <div class="action-buttons">
                <NButton 
                  type="primary" 
                  size="small" 
                  @click="handleApproveToolCall(message.requestId, message.name, message.arguments)"
                  :loading="remoteStore.toolConfirmationError !== ''"
                >
                  <template #icon>
                    <NIcon><CheckmarkCircle /></NIcon>
                  </template>
                  批准
                </NButton>
                <NButton 
                  type="error" 
                  size="small" 
                  @click="handleRejectToolCall(message.requestId, message.name, message.arguments)"
                  :loading="remoteStore.toolConfirmationError !== ''"
                >
                  <template #icon>
                    <NIcon><CloseCircle /></NIcon>
                  </template>
                  拒绝
                </NButton>
              </div>
            </div>
            
            <div class="tool-confirmation-meta">
              <div class="tool-time">{{ new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</div>
            </div>
          </NCard>
          
          <!-- 错误提示 -->
          <div v-if="remoteStore.toolConfirmationError" class="tool-confirmation-error">
            <NAlert type="error" size="small" :title="remoteStore.toolConfirmationError" closable @close="remoteStore.toolConfirmationError = ''" />
          </div>
        </div>
      </div>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="appStore.isLoading" class="loading-indicator">
      <div class="loading-avatar">
        <NAvatar round size="small" :style="{ backgroundColor: '#ececf1' }">
          <span style="color: #000">AI</span>
        </NAvatar>
      </div>
      <div class="loading-content">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
        <div class="loading-actions">
          <NButton text size="tiny" @click="stopGenerating">
            <template #icon>
              <NIcon size="12"><StopCircle /></NIcon>
            </template>
            停止生成
          </NButton>
        </div>
      </div>
    </div>
    
    <!-- 错误提示 -->
    <div v-if="appStore.error" class="error-container">
      <NAlert type="error" :title="appStore.error" closable @close="appStore.resetError()">
        <template v-if="appStore.canRetry">
          <NButton size="small" @click="retryLastMessage" :loading="appStore.isRetrying" style="margin-top: 8px">
            重试
          </NButton>
        </template>
      </NAlert>
    </div>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  scrollbar-width: thin;
  -ms-overflow-style: none;
  scroll-behavior: smooth;
  background-color: #ffffff;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.message-list::-webkit-scrollbar {
  width: 8px;
}

.message-list::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.message-list::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.2);
}

.message-wrapper {
  display: flex;
  gap: 12px;
  animation: fade-in 0.3s ease-in-out;
}

.user-message .message-wrapper {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.message-content-wrapper {
  flex: 1;
  max-width: 100%;
}

.user-message .message-content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-content {
  word-break: break-word;
  line-height: 1.6;
  padding: 12px 16px;
  border-radius: 18px;
  font-size: 15px;
  position: relative;
  transition: all 0.2s ease;
  max-width: 80%;
  overflow-wrap: break-word;
}

.ai-message .message-content {
  background-color: #f7f7f8;
  color: #374151;
  border-top-left-radius: 4px;
  max-width: 80%;
}

.user-message .message-content {
  background-color: #10a37f;
  color: white;
  border-top-right-radius: 4px;
  max-width: 80%;
}

.message-content :deep(pre) {
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 12px 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
}

.message-content :deep(code) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
}

.message-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
}

.message-content :deep(h1),
.message-content :deep(h2),
.message-content :deep(h3),
.message-content :deep(h4),
.message-content :deep(h5),
.message-content :deep(h6) {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
  line-height: 1.3;
}

.message-content :deep(p) {
  margin-bottom: 12px;
}

.message-content :deep(ul),
.message-content :deep(ol) {
  margin-bottom: 12px;
  padding-left: 24px;
}

.message-content :deep(blockquote) {
  border-left: 4px solid #10a37f;
  margin: 12px 0;
  padding-left: 16px;
  color: #666;
  font-style: italic;
}

.message-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}

.message-content :deep(th),
.message-content :deep(td) {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.message-content :deep(th) {
  background-color: #f7f7f8;
  font-weight: 600;
}

.message-actions {
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message-wrapper:hover .message-actions {
  opacity: 1;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 12px;
  color: #999;
}

.user-message .message-meta {
  flex-direction: row-reverse;
}

.message-time {
  font-size: 11px;
}

.message-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.message-status.error {
  color: #ef4444;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 20px;
  text-align: center;
}

.welcome-icon {
  margin-bottom: 20px;
}

.empty-state h3 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #374151;
}

.welcome-text {
  color: #6b7280;
  margin-bottom: 32px;
  font-size: 15px;
  max-width: 500px;
}

.example-prompts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  max-width: 600px;
  width: 100%;
}

.prompt {
  background-color: #f7f7f8;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.prompt:hover {
  background-color: #e5e5e5;
  border-color: #d4d4d4;
  transform: translateY(-2px);
}

.loading-indicator {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  animation: fade-in 0.3s ease-in-out;
}

.loading-avatar {
  flex-shrink: 0;
}

.loading-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background-color: #f7f7f8;
  border-radius: 18px;
  border-top-left-radius: 4px;
  width: fit-content;
}

.typing-dot {
  width: 8px;
  height: 8px;
  background-color: #9ca3af;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.loading-actions {
  margin-top: 4px;
}

.error-container {
  margin: 16px 0;
  animation: fade-in 0.3s ease-in-out;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

  /* 移动端适配 */
  @media (max-width: 768px) {
    .message-list {
      padding: 12px;
      gap: 16px;
    }
    
    .message-wrapper {
      gap: 8px;
    }
    
    .message-content-wrapper {
      max-width: 100%;
    }
    
    .message-content {
      padding: 10px 14px;
      font-size: 14px;
    }
    
    .empty-state h3 {
      font-size: 20px;
    }
    
    .welcome-text {
      font-size: 14px;
      margin-bottom: 24px;
    }
    
    .example-prompts {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    
    .prompt {
      padding: 10px 14px;
      font-size: 13px;
    }
    
    .message-content :deep(pre) {
      padding: 12px;
      font-size: 13px;
    }
  }

  /* 工具确认消息样式 */
  .tool-confirmation-wrapper {
    display: flex;
    gap: 12px;
    animation: fade-in 0.3s ease-in-out;
  }

  .tool-confirmation-content {
    flex: 1;
    max-width: 80%;
  }

  /* 移动端工具确认消息适配 */
  @media (max-width: 768px) {
    .tool-confirmation-content {
      max-width: 85%;
    }
  }
</style>
