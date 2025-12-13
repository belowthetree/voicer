import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
// 由于我们目前不需要实际调用Tauri功能，暂时注释掉这个导入
// import { invoke } from '@tauri-apps/api'

export const useAppStore = defineStore('app', () => {
  // 错误类型枚举
  enum ErrorType {
    NETWORK = 'network',
    SERVER = 'server',
    TIMEOUT = 'timeout',
    AUTH = 'auth',
    UNKNOWN = 'unknown'
  }

  // 状态
  const messages = ref<Array<{
    id: string,
    content: string,
    isUser: boolean,
    timestamp: number,
    status?: 'sending' | 'sent' | 'error'
  }>>([]);
  const isLoading = ref(false)
  const loadingProgress = ref(0)
  const error = ref('')
  const errorType = ref<ErrorType | null>(null)
  const apiUrl = ref('https://api.example.com/ai') // 替换为实际的AI API地址
  const retryCount = ref(0)
  const maxRetries = 3
  const isRetrying = ref(false)

  // 计算属性
  const hasError = computed(() => error.value !== '')
  const canRetry = computed(() => retryCount.value < maxRetries && errorType.value !== ErrorType.AUTH)

  // 添加消息
  function addMessage(content: string, isUser: boolean, status: 'sending' | 'sent' | 'error' = 'sent') {
    const id = Date.now().toString()
    messages.value.push({
      id,
      content,
      isUser,
      timestamp: Date.now(),
      status
    })
    return id
  }

  // 更新消息状态
  function updateMessageStatus(id: string, status: 'sending' | 'sent' | 'error') {
    const message = messages.value.find(m => m.id === id)
    if (message) {
      message.status = status
    }
  }

  // 处理错误
  function handleError(err: any) {
    // 确定错误类型
    if (err.message?.includes('network') || err.message?.includes('连接')) {
      errorType.value = ErrorType.NETWORK
      error.value = '网络连接错误，请检查您的网络连接'
    } else if (err.message?.includes('timeout') || err.message?.includes('超时')) {
      errorType.value = ErrorType.TIMEOUT
      error.value = '请求超时，服务器响应时间过长'
    } else if (err.status === 401 || err.message?.includes('unauthorized') || err.message?.includes('认证')) {
      errorType.value = ErrorType.AUTH
      error.value = 'API密钥无效或认证失败'
    } else if (err.status >= 500 || err.message?.includes('server')) {
      errorType.value = ErrorType.SERVER
      error.value = '服务器错误，请稍后再试'
    } else {
      errorType.value = ErrorType.UNKNOWN
      error.value = typeof err === 'string' ? err : (err.message || '发送消息失败')
    }
    console.error('发送消息失败:', err)
  }

  // 重置错误状态
  function resetError() {
    error.value = ''
    errorType.value = null
    retryCount.value = 0
    isRetrying.value = false
    loadingProgress.value = 0
  }

  // 重试发送消息
  async function retryLastMessage() {
    if (!canRetry.value || messages.value.length === 0) return
    
    // 找到最后一条用户消息
    const lastUserMessage = [...messages.value].reverse().find(m => m.isUser)
    if (!lastUserMessage) return
    
    isRetrying.value = true
    retryCount.value++
    
    try {
      await sendMessageToAI(lastUserMessage.content, true)
      isRetrying.value = false
    } catch (err) {
      isRetrying.value = false
      // 错误已在sendMessageToAI中处理
    }
  }

  // 发送消息到AI
  async function sendMessageToAI(content: string, isRetry = false) {
    if (!isRetry) {
      resetError()
    }
    
    try {
      isLoading.value = true
      
      // 添加用户消息（如果不是重试）
      let messageId = ''
      if (!isRetry) {
        messageId = addMessage(content, true, 'sending')
      }
      
      // 模拟进度
      const progressInterval = setInterval(() => {
        if (loadingProgress.value < 90) {
          loadingProgress.value += Math.random() * 10
        }
      }, 300)
      
      // 模拟API调用
      // 在实际应用中，这里会调用真实的API
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // 模拟错误（用于测试）
      // 如果消息包含"error"，"timeout"，"network"或"server"，则模拟相应的错误
      if (content.toLowerCase().includes('error')) {
        throw new Error('发生了一个未知错误')
      } else if (content.toLowerCase().includes('timeout')) {
        const timeoutError = new Error('请求超时')
        timeoutError.message = 'timeout'
        throw timeoutError
      } else if (content.toLowerCase().includes('network')) {
        const networkError = new Error('网络连接错误')
        networkError.message = 'network'
        throw networkError
      } else if (content.toLowerCase().includes('server')) {
        const serverError = new Error('服务器错误')
        serverError.message = 'server'
        throw serverError
      }
      
      // 模拟响应
      const response = {
        reply: `这是对"${content}"的AI回复。我是一个模拟的AI助手，目前只能返回这个预设的回复。`
      }
      
      clearInterval(progressInterval)
      loadingProgress.value = 100
      
      // 更新消息状态（如果不是重试）
      if (!isRetry && messageId) {
        updateMessageStatus(messageId, 'sent')
      }
      
      // 添加AI回复
      addMessage(response.reply, false)
      
      // 重置重试计数
      if (isRetry) {
        retryCount.value = 0
      }
      
      return response
    } catch (err: any) {
      // 如果不是重试，将最后一条消息标记为错误
      if (!isRetry && messages.value.length > 0) {
        const lastMessage = messages.value[messages.value.length - 1]
        if (lastMessage.isUser) {
          updateMessageStatus(lastMessage.id, 'error')
        }
      }
      
      handleError(err)
      throw err
    } finally {
      isLoading.value = false
      setTimeout(() => {
        loadingProgress.value = 0
      }, 500)
    }
  }

  // 清空消息
  function clearMessages() {
    messages.value = []
    resetError()
  }

  // 设置API URL
  function setApiUrl(url: string) {
    apiUrl.value = url
    resetError()
  }

  return {
    messages,
    isLoading,
    loadingProgress,
    error,
    errorType,
    apiUrl,
    hasError,
    canRetry,
    isRetrying,
    addMessage,
    sendMessageToAI,
    clearMessages,
    setApiUrl,
    retryLastMessage,
    resetError
  }
})