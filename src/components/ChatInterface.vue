<script setup lang="ts">
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import { useAppStore } from '../stores'
import { useRemoteStore } from '../stores/remote-store'
import { 
  NInput, NButton, NCard, NSpace, NIcon, NSpin, NAlert, NProgress, NAvatar, NText, NPopover,
  NModal, NForm, NFormItem, NSelect, NSwitch, NDivider, NTag, NGrid, NGi, NInputNumber,
  NTooltip, NBadge, NScrollbar, NCollapse, NCollapseItem, NList, NListItem, NThing
} from 'naive-ui'
import { 
  Send, Trash, WarningOutline, Copy, Checkmark, Refresh, StopCircle, 
  Settings, Server, CheckmarkCircleOutline, CloseCircleOutline,
  Play, Terminal, Code, DocumentText, ArchiveOutline, GlobeOutline, CogOutline, Rocket,
  ChevronDown, ChevronUp, Reload, TerminalOutline, FlashOutline, StarOutline
} from '@vicons/ionicons5'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

const store = useAppStore()
const remoteStore = useRemoteStore()
const messageInput = ref('')
const messageContainer = ref<HTMLElement | null>(null)
const copiedMessageId = ref<string | null>(null)

// 远程连接配置
const showRemoteConfig = ref(false)
const remoteHost = ref('127.0.0.1')
const remotePort = ref(8080)
const useTools = ref(true)
const maxTokens = ref(2000)
const askBeforeToolExecution = ref(true)

// 命令相关状态
const showCommandsPanel = ref(false)
const selectedCommand = ref<string | null>(null)
const commandParameters = ref<Record<string, any>>({})
const isSendingCommand = ref(false)

// 配置marked以支持代码高亮
marked.use({
  renderer: {
    code(this: any, { text: code, lang }: { text: string; lang?: string }) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre><code class="hljs language-${lang}">${hljs.highlight(code, { language: lang }).value}</code></pre>`
        } catch (err) {
          return `<pre><code class="hljs">${hljs.highlightAuto(code).value}</code></pre>`
        }
      }
      return `<pre><code class="hljs">${hljs.highlightAuto(code).value}</code></pre>`
    }
  },
  breaks: true,
  gfm: true
})

// 发送消息
const sendMessage = async () => {
  if (!messageInput.value.trim() || store.isLoading) return
  
  const message = messageInput.value
  messageInput.value = ''
  
  try {
    await store.sendMessageToAI(message)
  } catch (err) {
    // 错误已在store中处理
  } finally {
    scrollToBottom()
  }
}

// 连接到远程服务器
const connectToRemote = async () => {
  try {
    await store.connectToRemote()
  } catch (err) {
    // 错误已在store中处理
  }
}

// 断开远程连接
const disconnectFromRemote = () => {
  store.disconnectFromRemote()
}

// 刷新命令列表
const refreshCommands = async () => {
  try {
    await remoteStore.refreshCommands()
  } catch (err) {
    console.error('刷新命令列表失败:', err)
  }
}

// 发送命令
const sendCommand = async (commandName: string, parameters: Record<string, any> = {}) => {
  if (isSendingCommand.value) return
  
  isSendingCommand.value = true
  try {
    const response = await remoteStore.sendCommand(commandName, parameters)
    
    // 添加命令消息到聊天
    const commandDisplay = `执行命令: ${commandName}${Object.keys(parameters).length > 0 ? ` (参数: ${JSON.stringify(parameters)})` : ''}`
    store.addMessage(commandDisplay, true)
    
    // 添加响应消息
    store.addMessage(response, false)
    
    // 滚动到底部
    scrollToBottom()
  } catch (err: any) {
    console.error('发送命令失败:', err)
    // 添加错误消息
    store.addMessage(`执行命令 ${commandName} 失败: ${err.message}`, false)
  } finally {
    isSendingCommand.value = false
  }
}

// 快速发送命令（无参数）
const quickSendCommand = (commandName: string) => {
  sendCommand(commandName)
}

// 获取命令图标
const getCommandIcon = (commandName: string) => {
  const iconMap: Record<string, any> = {
    'run': Play,
    'execute': Terminal,
    'code': Code,
    'read': DocumentText,
    'query': ArchiveOutline,
    'connect': GlobeOutline,
    'config': CogOutline,
    'start': Rocket,
    'stop': StopCircle,
    'get': ArchiveOutline,
    'list': DocumentText,
    'create': Rocket,
    'update': Refresh,
    'delete': Trash
  }
  
  for (const [key, icon] of Object.entries(iconMap)) {
    if (commandName.toLowerCase().includes(key)) {
      return icon
    }
  }
  
  return TerminalOutline
}

// 获取命令颜色
const getCommandColor = (commandName: string): 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error' => {
  const colorMap: Record<string, 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
    'run': 'success',
    'execute': 'success',
    'code': 'info',
    'read': 'info',
    'query': 'info',
    'connect': 'warning',
    'config': 'warning',
    'start': 'success',
    'stop': 'error',
    'get': 'info',
    'list': 'info',
    'create': 'success',
    'update': 'warning',
    'delete': 'error'
  }
  
  for (const [key, color] of Object.entries(colorMap)) {
    if (commandName.toLowerCase().includes(key)) {
      return color
    }
  }
  
  return 'default'
}

// 保存远程配置
const saveRemoteConfig = () => {
  store.updateRemoteConfig(remoteHost.value, remotePort.value)
  store.updateRemoteRequestConfig({
    max_tokens: maxTokens.value,
    ask_before_tool_execution: askBeforeToolExecution.value
  })
  store.updateRemoteUseTools(useTools.value)
  showRemoteConfig.value = false
  
  // 如果已连接，重新连接
  if (store.isRemoteConnected) {
    disconnectFromRemote()
    setTimeout(() => {
      connectToRemote()
    }, 500)
  }
}

// 打开配置面板
const openRemoteConfig = () => {
  // 使用默认值，实际应用中应该从store获取
  showRemoteConfig.value = true
}

// 停止生成
const stopGenerating = () => {
  // 在实际应用中，这里会取消API请求
  store.isLoading = false
  store.loadingProgress = 0
}

// 重试上一条消息
const retryLastMessage = async () => {
  try {
    await store.retryLastMessage()
  } catch (err) {
    // 错误已在store中处理
  } finally {
    scrollToBottom()
  }
}

// 复制消息内容
const copyMessage = async (content: string, id: string) => {
  try {
    await navigator.clipboard.writeText(content)
    copiedMessageId.value = id
    setTimeout(() => {
      copiedMessageId.value = null
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

// 清空消息
const clearMessages = () => {
  store.clearMessages()
}

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight
  }
}

// 监听消息变化，自动滚动到底部
watch(() => store.messages.length, () => {
  scrollToBottom()
})

// 监听加载状态变化，自动滚动到底部
watch(() => store.isLoading, (newVal) => {
  if (newVal) {
    scrollToBottom()
  }
})

// 组件挂载后滚动到底部
onMounted(() => {
  scrollToBottom()
})

// 计算最后一条消息是否为用户消息
const lastMessageIsUser = computed(() => {
  if (store.messages.length === 0) return false
  return store.messages[store.messages.length - 1].isUser
})

// 远程连接状态标签
const remoteStatusTag = computed(() => {
  if (!store.isRemoteConnected) {
    return {
      type: 'error' as const,
      text: '未连接',
      icon: CloseCircleOutline
    }
  }
  return {
    type: 'success' as const,
    text: store.remoteStatusText,
    icon: CheckmarkCircleOutline
  }
})

// 命令相关计算属性
const hasCommands = computed(() => remoteStore.hasCommands)
const commandsCount = computed(() => remoteStore.commandsCount)
const isLoadingCommands = computed(() => remoteStore.isLoadingCommands)
const commandsError = computed(() => remoteStore.commandsError)
const commandsLastUpdated = computed(() => remoteStore.commandsLastUpdated)

// 命令分组（按名称前缀）
const groupedCommands = computed(() => {
  const groups: Record<string, any[]> = {}
  
  remoteStore.commands.forEach(command => {
    // 根据命令名称的第一个单词分组
    const firstWord = command.name.split('_')[0] || 'other'
    if (!groups[firstWord]) {
      groups[firstWord] = []
    }
    groups[firstWord].push(command)
  })
  
  return Object.entries(groups).map(([groupName, commands]) => ({
    name: groupName,
    commands,
    icon: getCommandIcon(groupName)
  }))
})

// 热门命令（前6个）
const popularCommands = computed(() => {
  return remoteStore.commands.slice(0, 6)
})
</script>

<template>
  <div class="chat-container">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 class="app-title">AI 助手</h2>
      </div>
      <div class="toolbar-right">
        <div class="remote-status">
          <!-- 命令按钮 -->
          <NTooltip v-if="store.isRemoteConnected && hasCommands" trigger="hover">
            <template #trigger>
              <NButton 
                size="tiny" 
                @click="showCommandsPanel = !showCommandsPanel"
                :type="showCommandsPanel ? 'primary' : 'default'"
                :loading="isLoadingCommands"
              >
                <template #icon>
                  <NIcon :component="TerminalOutline" size="14" />
                </template>
                命令 ({{ commandsCount }})
              </NButton>
            </template>
            显示可用命令
          </NTooltip>
          
          <NTag :type="remoteStatusTag.type" size="small" round>
            <template #icon>
              <NIcon :component="remoteStatusTag.icon" size="14" />
            </template>
            {{ remoteStatusTag.text }}
          </NTag>
          <NButton 
            size="tiny" 
            @click="store.isRemoteConnected ? disconnectFromRemote() : connectToRemote()"
            :type="store.isRemoteConnected ? 'warning' : 'primary'"
            :loading="store.isLoading"
          >
            <template #icon>
              <NIcon :component="store.isRemoteConnected ? CloseCircleOutline : CheckmarkCircleOutline" size="14" />
            </template>
            {{ store.isRemoteConnected ? '断开连接' : '连接' }}
          </NButton>
          <NButton size="tiny" @click="openRemoteConfig">
            <template #icon>
              <NIcon :component="Settings" size="14" />
            </template>
            配置
          </NButton>
        </div>
      </div>
    </div>
    
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
        <NAlert type="error" :title="commandsError" closable @close="remoteStore.commandsError = ''">
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
              @click="quickSendCommand(command.name)"
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
                @click="quickSendCommand(command.name)"
              >
                <div class="command-item-icon">
                  <NIcon :component="getCommandIcon(command.name)" size="16" />
                </div>
                <div class="command-item-info">
                  <div class="command-item-name">{{ command.name }}</div>
                  <div class="command-item-desc">{{ command.description }}</div>
                </div>
                <div class="command-item-action">
                  <NButton text size="tiny" @click.stop="quickSendCommand(command.name)">
                    执行
                  </NButton>
                </div>
              </div>
            </div>
          </NCollapseItem>
        </NCollapse>
      </NScrollbar>
    </div>
    
    <!-- 消息列表 -->
    <div class="message-list" ref="messageContainer">
      <template v-if="store.messages.length === 0">
        <div class="empty-state">
          <div class="welcome-icon">
            <NAvatar round size="large" :style="{ backgroundColor: '#10a37f' }">
              <span style="color: white; font-weight: bold">AI</span>
            </NAvatar>
          </div>
          <h3>欢迎使用AI助手</h3>
          <p class="welcome-text">我可以帮助您解答问题、编写代码、分析问题等</p>
          <div class="example-prompts">
            <div class="prompt" @click="messageInput = '帮我写一个Python函数来计算斐波那契数列'">
              帮我写一个Python函数来计算斐波那契数列
            </div>
            <div class="prompt" @click="messageInput = '解释一下什么是机器学习'">
              解释一下什么是机器学习
            </div>
            <div class="prompt" @click="messageInput = '如何优化网页性能？'">
              如何优化网页性能？
            </div>
          </div>
        </div>
      </template>
      
      <div v-for="message in store.messages" :key="message.id" 
           :class="['message', message.isUser ? 'user-message' : 'ai-message', 
                   message.status === 'sending' ? 'sending' : '',
                   message.status === 'error' ? 'error' : '']">
        <div class="message-wrapper">
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
      </div>
      
      <!-- 加载状态 -->
      <div v-if="store.isLoading" class="loading-indicator">
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
      <div v-if="store.error" class="error-container">
        <NAlert type="error" :title="store.error" closable @close="store.resetError()">
          <template v-if="store.canRetry">
            <NButton size="small" @click="retryLastMessage" :loading="store.isRetrying" style="margin-top: 8px">
              重试
            </NButton>
          </template>
        </NAlert>
      </div>
      
      <!-- 命令发送状态 -->
      <div v-if="isSendingCommand" class="command-sending">
        <div class="sending-indicator">
          <NSpin size="small" />
          <span>正在执行命令...</span>
        </div>
      </div>
    </div>
    
    <!-- 远程配置模态框 -->
    <NModal v-model:show="showRemoteConfig" preset="card" title="远程服务器配置" style="width: 500px">
      <NForm label-placement="left" label-width="120px">
        <NGrid :cols="2" :x-gap="24">
          <NGi>
            <NFormItem label="服务器地址">
              <NInput v-model:value="remoteHost" placeholder="例如: 127.0.0.1" />
            </NFormItem>
          </NGi>
            <NGi>
            <NFormItem label="端口号">
              <NInputNumber v-model:value="remotePort" :min="1" :max="65535" />
            </NFormItem>
          </NGi>
        </NGrid>
        
        <NDivider />
        
        <NFormItem label="最大令牌数">
          <NInputNumber v-model:value="maxTokens" :min="100" :max="10000" :step="100">
            <template #suffix>
              令牌
            </template>
          </NInputNumber>
        </NFormItem>
        
        <NFormItem label="使用工具">
          <NSwitch v-model:value="useTools">
            <template #checked>
              启用
            </template>
            <template #unchecked>
              禁用
            </template>
          </NSwitch>
        </NFormItem>
        
        <NFormItem label="工具执行前询问">
          <NSwitch v-model:value="askBeforeToolExecution">
            <template #checked>
              是
            </template>
            <template #unchecked>
              否
            </template>
          </NSwitch>
        </NFormItem>
        
        <div class="form-actions">
          <NSpace justify="end">
            <NButton @click="showRemoteConfig = false">取消</NButton>
            <NButton type="primary" @click="saveRemoteConfig">保存并应用</NButton>
          </NSpace>
        </div>
      </NForm>
    </NModal>
    
    <!-- 输入区域 -->
    <div class="input-area">
      <div class="input-wrapper">
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
        <div class="input-actions">
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
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 768px;
  margin: 0 auto;
  padding: 0;
  box-sizing: border-box;
  background-color: #ffffff;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e5e5;
  position: sticky;
  top: 0;
  z-index: 100;
}

.toolbar-left .app-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #374151;
}

.remote-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e5e5e5;
}

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
  max-width: calc(100% - 52px);
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
}

.ai-message .message-content {
  background-color: #f7f7f8;
  color: #374151;
  border-top-left-radius: 4px;
}

.user-message .message-content {
  background-color: #10a37f;
  color: white;
  border-top-right-radius: 4px;
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

.input-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
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

@keyframes fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .chat-container {
    padding: 0;
  }
  
  .toolbar {
    padding: 8px 12px;
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .toolbar-left, .toolbar-right {
    width: 100%;
  }
  
  .toolbar-left .app-title {
    text-align: center;
    margin-bottom: 8px;
  }
  
  .remote-status {
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .message-list {
    padding: 12px;
    gap: 16px;
  }
  
  .message-wrapper {
    gap: 8px;
  }
  
  .message-content-wrapper {
    max-width: calc(100% - 44px);
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
  
  .input-area {
    padding: 12px;
  }
  
  .input-wrapper {
    gap: 8px;
  }
  
  .input-actions {
    gap: 6px;
  }
  
  .message-content :deep(pre) {
    padding: 12px;
    font-size: 13px;
  }
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
