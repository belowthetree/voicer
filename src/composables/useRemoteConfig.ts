import { ref, computed } from 'vue'
import { useAppStore } from '../stores'
import { CloseCircleOutline, CheckmarkCircleOutline } from '@vicons/ionicons5'

export function useRemoteConfig() {
  const store = useAppStore()
  
  // 远程连接配置
  const showRemoteConfig = ref(false)
  const remoteHost = ref('127.0.0.1')
  const remotePort = ref(8080)
  const useTools = ref(true)
  const maxTokens = ref(2000)
  const askBeforeToolExecution = ref(true)

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

  return {
    // 状态
    showRemoteConfig,
    remoteHost,
    remotePort,
    useTools,
    maxTokens,
    askBeforeToolExecution,
    
    // 方法
    connectToRemote,
    disconnectFromRemote,
    saveRemoteConfig,
    openRemoteConfig,
    
    // 计算属性
    remoteStatusTag
  }
}
