import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRemoteStore } from './remote-store'

export const useAppStore = defineStore('app', () => {
  // 错误类型枚举
  enum ErrorType {
    NETWORK = 'network',
    SERVER = 'server',
    TIMEOUT = 'timeout',
    AUTH = 'auth',
    UNKNOWN = 'unknown'
  }

  // 远程通信 store
  const remoteStore = useRemoteStore()

  // 消息类型定义
  interface BaseMessage {
    id: string;
    timestamp: number;
  }

  interface TextMessage extends BaseMessage {
    type: 'text';
    content: string;
    isUser: boolean;
    status?: 'sending' | 'sent' | 'error' | 'streaming';
    isStreaming?: boolean;
    streamId?: string; // 用于关联流式响应的唯一ID
  }

  interface ToolConfirmationMessage extends BaseMessage {
    type: 'tool-confirmation';
    requestId: string;
    name: string;
    arguments: Record<string, any>;
    description?: string;
    status: 'pending' | 'approved' | 'rejected';
  }

  type Message = TextMessage | ToolConfirmationMessage;

  // 状态
  const messages = ref<Message[]>([]);
  const isLoading = ref(false)
  const loadingProgress = ref(0)
  const error = ref('')
  const errorType = ref<ErrorType | null>(null)
  const apiUrl = ref('https://api.example.com/ai') // 保留，用于向后兼容
  const retryCount = ref(0)
  const maxRetries = 3
  const isRetrying = ref(false)

  // 计算属性
  const hasError = computed(() => error.value !== '')
  const canRetry = computed(() => retryCount.value < maxRetries && errorType.value !== ErrorType.AUTH)
  
  // 远程连接状态计算属性
  const isRemoteConnected = computed(() => remoteStore.isConnected)
  const remoteStatusText = computed(() => remoteStore.statusText)
  const remoteStatusColor = computed(() => remoteStore.statusColor)

  // 添加文本消息
  function addTextMessage(content: string, isUser: boolean, status: 'sending' | 'sent' | 'error' = 'sent') {
    const id = Date.now().toString()
    const message: TextMessage = {
      type: 'text',
      id,
      content,
      isUser,
      timestamp: Date.now(),
      status
    }
    messages.value.push(message)
    return id
  }

  // 添加工具确认消息
  function addToolConfirmationMessage(
    requestId: string,
    name: string,
    arguments_: Record<string, any>,
    description?: string
  ) {
    console.log('appStore.addToolConfirmationMessage被调用:', {
      requestId,
      name,
      arguments: arguments_,
      description
    })
    
    const id = Date.now().toString()
    const message: ToolConfirmationMessage = {
      type: 'tool-confirmation',
      id,
      requestId,
      name,
      arguments: arguments_,
      description,
      timestamp: Date.now(),
      status: 'pending'
    }
    
    console.log('创建的消息对象:', message)
    console.log('添加前消息数量:', messages.value.length)
    
    messages.value.push(message)
    
    console.log('添加后消息数量:', messages.value.length)
    console.log('最后一条消息:', messages.value[messages.value.length - 1])
    
    return id
  }

  // 更新工具确认消息状态
  function updateToolConfirmationStatus(requestId: string, status: 'approved' | 'rejected') {
    const message = messages.value.find(m => 
      m.type === 'tool-confirmation' && m.requestId === requestId
    ) as ToolConfirmationMessage | undefined
    
    if (message) {
      message.status = status
    }
  }

  // 向后兼容的addMessage函数
  function addMessage(content: string, isUser: boolean, status: 'sending' | 'sent' | 'error' = 'sent') {
    return addTextMessage(content, isUser, status)
  }

  // 更新消息状态
  function updateMessageStatus(id: string, status: 'sending' | 'sent' | 'error' | 'streaming') {
    const message = messages.value.find(m => m.id === id)
    if (message) {
      message.status = status
    }
  }

  // 处理错误
  function handleError(err: any) {
    // 确定错误类型
    if (err.message?.includes('network') || err.message?.includes('连接') || err.message?.includes('未连接')) {
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
    const lastUserMessage = [...messages.value].reverse().find(m => 
      m.type === 'text' && m.isUser
    ) as TextMessage | undefined
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
      let userMessageId = ''
      if (!isRetry) {
        userMessageId = addMessage(content, true, 'sending')
      }
      
      // 模拟进度
      const progressInterval = setInterval(() => {
        if (loadingProgress.value < 90) {
          loadingProgress.value += Math.random() * 10
        }
      }, 300)
      
      // 使用远程通信模块发送消息
      let aiResponse = ''
      
      try {
        // 首先确保已连接到远程服务器
        if (!remoteStore.isConnected) {
          await remoteStore.connect()
        }
        
        // 创建AI回复消息（流式消息）
        const aiMessageId = Date.now().toString() + '_stream'
        const aiMessage: TextMessage = {
          type: 'text',
          id: aiMessageId,
          content: '',
          isUser: false,
          timestamp: Date.now(),
          status: 'streaming',
          isStreaming: true,
          streamId: aiMessageId
        }
        messages.value.push(aiMessage)
        
        // 创建流式处理器
        const streamHandler = {
          onChunk: (chunk: string) => {
            console.log('收到流式块:', chunk)
            // 更新AI消息内容
            const messageIndex = messages.value.findIndex(m => m.id === aiMessageId)
            if (messageIndex !== -1) {
              const message = messages.value[messageIndex] as TextMessage
              message.content += chunk
              // 触发响应式更新
              messages.value = [...messages.value]
            }
          },
          onComplete: (fullText: string) => {
            console.log('流式响应完成:', fullText)
            // 更新AI消息状态
            const messageIndex = messages.value.findIndex(m => m.id === aiMessageId)
            if (messageIndex !== -1) {
              const message = messages.value[messageIndex] as TextMessage
              message.status = 'sent'
              message.isStreaming = false
              aiResponse = fullText
              // 触发响应式更新
              messages.value = [...messages.value]
            }
          },
          onError: (error: Error) => {
            console.error('流式响应错误:', error)
            // 更新AI消息状态为错误
            const messageIndex = messages.value.findIndex(m => m.id === aiMessageId)
            if (messageIndex !== -1) {
              const message = messages.value[messageIndex] as TextMessage
              message.status = 'error'
              message.isStreaming = false
              // 触发响应式更新
              messages.value = [...messages.value]
            }
            handleError(error)
          }
        }
        
        // 发送消息到远程服务器（使用流式处理）
        aiResponse = await remoteStore.sendText(content, streamHandler)
        
        clearInterval(progressInterval)
        loadingProgress.value = 100
        
        // 更新用户消息状态（如果不是重试）
        if (!isRetry && userMessageId) {
          updateMessageStatus(userMessageId, 'sent')
        }
        
        // 重置重试计数
        if (isRetry) {
          retryCount.value = 0
        }
        
        return { reply: aiResponse }
      } catch (remoteError: any) {
        // 如果远程通信失败，回退到模拟响应
        console.warn('远程通信失败，使用模拟响应:', remoteError)
        
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // 模拟响应
        const response = {
          reply: `这是对"${content}"的AI回复。远程通信失败，使用模拟模式。`
        }
        
        clearInterval(progressInterval)
        loadingProgress.value = 100
        
        // 更新用户消息状态（如果不是重试）
        if (!isRetry && userMessageId) {
          updateMessageStatus(userMessageId, 'sent')
        }
        
        // 添加AI回复（非流式）
        addMessage(response.reply, false)
        
        // 重置重试计数
        if (isRetry) {
          retryCount.value = 0
        }
        
        return response
      }
    } catch (err: any) {
      // 如果不是重试，将最后一条用户消息标记为错误
      if (!isRetry && messages.value.length > 0) {
        const lastMessage = messages.value[messages.value.length - 1]
        if (lastMessage.type === 'text' && lastMessage.isUser) {
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
  
  // 连接到远程服务器
  async function connectToRemote() {
    try {
      await remoteStore.connect()
      return true
    } catch (err: any) {
      handleError(err)
      return false
    }
  }
  
  // 断开远程连接
  function disconnectFromRemote() {
    remoteStore.disconnect()
  }
  
  // 更新远程服务器配置
  function updateRemoteConfig(host: string, port: number) {
    remoteStore.updateConfig({ host, port })
  }
  
  // 更新远程请求配置
  function updateRemoteRequestConfig(config: any) {
    remoteStore.updateRequestConfig(config)
  }
  
  // 更新是否使用工具
  function updateRemoteUseTools(useTools: boolean) {
    remoteStore.updateUseTools(useTools)
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
    isRemoteConnected,
    remoteStatusText,
    remoteStatusColor,
    addMessage,
    addTextMessage,
    addToolConfirmationMessage,
    updateToolConfirmationStatus,
    sendMessageToAI,
    clearMessages,
    setApiUrl,
    retryLastMessage,
    resetError,
    connectToRemote,
    disconnectFromRemote,
    updateRemoteConfig,
    updateRemoteRequestConfig,
    updateRemoteUseTools
  }
})
