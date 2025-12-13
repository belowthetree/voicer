<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '../stores'
import { useRemoteStore } from '../stores/remote-store'
import { NModal } from 'naive-ui'

// 导入新创建的组件
import ChatToolbar from './ChatToolbar.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatInputArea from './ChatInputArea.vue'
import RemoteConfigModal from './RemoteConfigModal.vue'
import AboutModal from './AboutModal.vue'

// 导入组合式函数
import { useChatCommands } from '../composables/useChatCommands'
import { useChatMessages } from '../composables/useChatMessages'
import { useRemoteConfig } from '../composables/useRemoteConfig'

const store = useAppStore()
const remoteStore = useRemoteStore()

// 使用组合式函数
const {
  showCommandsPanel,
  selectedCommand,
  commandParameters,
  isSendingCommand,
  hasCommands,
  commandsCount,
  isLoadingCommands,
  commandsError,
  commandsLastUpdated,
  groupedCommands,
  popularCommands,
  getCommandIcon,
  getCommandColor,
  sendCommand,
  quickSendCommand,
  refreshCommands
} = useChatCommands()

const {
  messageInput,
  messageContainer,
  copiedMessageId,
  sendMessage,
  retryLastMessage,
  copyMessage,
  clearMessages,
  stopGenerating,
  scrollToBottom,
  lastMessageIsUser
} = useChatMessages()

const {
  showRemoteConfig,
  remoteHost,
  remotePort,
  useTools,
  maxTokens,
  askBeforeToolExecution,
  connectToRemote,
  disconnectFromRemote,
  saveRemoteConfig,
  openRemoteConfig,
  remoteStatusTag
} = useRemoteConfig()

// 关于模态框状态
const showAboutModal = ref(false)

// 打开关于模态框
const openAbout = () => {
  showAboutModal.value = true
}

// 计算属性
const isRemoteConnected = computed(() => store.isRemoteConnected)
const remoteStatusText = computed(() => store.remoteStatusText)
const remoteStatusColor = computed(() => store.remoteStatusColor)
</script>

<template>
  <div class="chat-container">
    <!-- 顶部工具栏组件 -->
    <ChatToolbar
      :is-remote-connected="isRemoteConnected"
      :remote-status-text="remoteStatusText"
      :remote-status-color="remoteStatusColor"
      :remote-status-tag="remoteStatusTag"
      @connect="connectToRemote"
      @disconnect="disconnectFromRemote"
      @open-config="openRemoteConfig"
      @open-about="openAbout"
    />

    <!-- 消息列表组件 -->
    <ChatMessageList
      ref="messageContainer"
      :messages="store.messages"
      :is-loading="store.isLoading"
      :error="store.error"
      :can-retry="store.canRetry"
      :copied-message-id="copiedMessageId"
      :is-sending-command="isSendingCommand"
      @retry="retryLastMessage"
      @copy="copyMessage"
      @stop="stopGenerating"
    />

    <!-- 远程配置模态框组件 -->
    <RemoteConfigModal
      v-model:show="showRemoteConfig"
      v-model:remote-host="remoteHost"
      v-model:remote-port="remotePort"
      v-model:use-tools="useTools"
      v-model:max-tokens="maxTokens"
      v-model:ask-before-tool-execution="askBeforeToolExecution"
      @save="saveRemoteConfig"
    />

    <!-- 关于模态框组件 -->
    <AboutModal v-model:show="showAboutModal" />

    <!-- 输入区域组件 -->
    <ChatInputArea
      v-model:message-input="messageInput"
      v-model:show-commands-panel="showCommandsPanel"
      :is-loading="store.isLoading"
      :is-remote-connected="isRemoteConnected"
      :has-commands="hasCommands"
      :commands-count="commandsCount"
      :is-loading-commands="isLoadingCommands"
      :commands-error="commandsError"
      :commands-last-updated="commandsLastUpdated"
      :grouped-commands="groupedCommands"
      :popular-commands="popularCommands"
      :get-command-icon="getCommandIcon"
      :get-command-color="getCommandColor"
      @send="sendMessage"
      @clear="clearMessages"
      @refresh-commands="refreshCommands"
      @quick-send-command="quickSendCommand"
    />
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

/* 移动端适配 */
@media (max-width: 768px) {
  .chat-container {
    padding: 0;
  }
}
</style>
