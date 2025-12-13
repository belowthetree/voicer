/**
 * 远程通信 Store
 * 管理与远程 AI Agent 服务器的连接和通信
 */

import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import { RemoteClient } from '../services/remote-client'
import type { RemoteClientConfig, RequestConfig, StreamHandler } from '../types/remote-protocol'
import { ConnectionStatus, RemoteEventType } from '../types/remote-protocol'

export const useRemoteStore = defineStore('remote', () => {
  // 远程客户端实例
  const client = ref<RemoteClient | null>(null)
  
  // 连接配置
  const config = reactive<RemoteClientConfig>({
    host: '127.0.0.1',
    port: 8080,
    timeout: 30000,
    reconnectAttempts: 5,
    reconnectDelay: 3000
  })
  
  // 连接状态
  const connectionStatus = ref<ConnectionStatus>(ConnectionStatus.DISCONNECTED)
  const isConnecting = computed(() => connectionStatus.value === ConnectionStatus.CONNECTING)
  const isConnected = computed(() => connectionStatus.value === ConnectionStatus.CONNECTED)
  const isError = computed(() => connectionStatus.value === ConnectionStatus.ERROR)
  
  // 请求配置
  const requestConfig = reactive<RequestConfig>({
    max_tokens: 2000,
    ask_before_tool_execution: true,
    use_tools: true
  })
  
  // 错误信息
  const error = ref('')
  const lastError = ref('')
  
  // 连接统计
  const connectionAttempts = ref(0)
  const successfulConnections = ref(0)
  const failedConnections = ref(0)
  const messagesSent = ref(0)
  const messagesReceived = ref(0)
  
  // 初始化客户端
  function initializeClient() {
    if (client.value) {
      client.value.disconnect()
    }
    
    client.value = new RemoteClient(config)
    
    // 设置事件监听器
    client.value.on(RemoteEventType.CONNECT, () => {
      connectionStatus.value = ConnectionStatus.CONNECTED
      successfulConnections.value++
      connectionAttempts.value++
      error.value = ''
    })
    
    client.value.on(RemoteEventType.DISCONNECT, () => {
      connectionStatus.value = ConnectionStatus.DISCONNECTED
    })
    
    client.value.on(RemoteEventType.ERROR, (eventData) => {
      connectionStatus.value = ConnectionStatus.ERROR
      lastError.value = error.value
      error.value = eventData.data?.message || '连接错误'
      failedConnections.value++
    })
    
    client.value.on(RemoteEventType.MESSAGE, () => {
      messagesReceived.value++
    })
  }
  
  // 连接到远程服务器
  async function connect(): Promise<void> {
    if (!client.value) {
      initializeClient()
    }
    
    if (isConnecting.value || isConnected.value) {
      return
    }
    
    connectionStatus.value = ConnectionStatus.CONNECTING
    
    try {
      await client.value!.connect()
    } catch (err: any) {
      connectionStatus.value = ConnectionStatus.ERROR
      lastError.value = error.value
      error.value = err.message || '连接失败'
      throw err
    }
  }
  
  // 断开连接
  function disconnect(): void {
    if (client.value) {
      client.value.disconnect()
      connectionStatus.value = ConnectionStatus.DISCONNECTED
    }
  }
  
  // 发送文本消息
  async function sendText(
    text: string,
    stream = false,
    streamHandler?: StreamHandler
  ): Promise<string> {
    if (!client.value || !isConnected.value) {
      throw new Error('未连接到远程服务器')
    }
    
    try {
      const response = await client.value.sendText(
        text,
        requestConfig,
        stream,
        requestConfig.use_tools,
        streamHandler
      )
      
      messagesSent.value++
      
      // 提取响应文本
      if ('Text' in response.response) {
        return response.response.Text
      } else if ('Stream' in response.response) {
        return response.response.Stream.join('')
      } else if ('Multi' in response.response) {
        // 处理复合响应
        const texts: string[] = []
        for (const item of response.response.Multi) {
          if ('Text' in item) {
            texts.push(item.Text)
          } else if ('Stream' in item) {
            texts.push(item.Stream.join(''))
          }
        }
        return texts.join('\n')
      } else {
        throw new Error('不支持的响应类型')
      }
    } catch (err: any) {
      lastError.value = error.value
      error.value = err.message || '发送消息失败'
      throw err
    }
  }
  
  // 更新配置
  function updateConfig(newConfig: Partial<RemoteClientConfig>): void {
    Object.assign(config, newConfig)
    
    // 如果客户端已存在且配置发生变化，重新初始化
    if (client.value && (newConfig.host !== undefined || newConfig.port !== undefined)) {
      disconnect()
      initializeClient()
    }
  }
  
  // 更新请求配置
  function updateRequestConfig(newConfig: Partial<RequestConfig>): void {
    Object.assign(requestConfig, newConfig)
  }
  
  // 重置错误
  function resetError(): void {
    error.value = ''
    lastError.value = ''
  }
  
  // 获取连接状态文本
  const statusText = computed(() => {
    switch (connectionStatus.value) {
      case ConnectionStatus.DISCONNECTED:
        return '未连接'
      case ConnectionStatus.CONNECTING:
        return '连接中...'
      case ConnectionStatus.CONNECTED:
        return '已连接'
      case ConnectionStatus.ERROR:
        return '连接错误'
      case ConnectionStatus.RECONNECTING:
        return '重新连接中...'
      default:
        return '未知状态'
    }
  })
  
  // 获取连接状态颜色
  const statusColor = computed(() => {
    switch (connectionStatus.value) {
      case ConnectionStatus.CONNECTED:
        return 'success'
      case ConnectionStatus.CONNECTING:
      case ConnectionStatus.RECONNECTING:
        return 'warning'
      case ConnectionStatus.ERROR:
        return 'error'
      default:
        return 'default'
    }
  })
  
  // 初始化
  initializeClient()
  
  return {
    // 状态
    config,
    requestConfig,
    connectionStatus,
    isConnecting,
    isConnected,
    isError,
    error,
    lastError,
    
    // 统计
    connectionAttempts,
    successfulConnections,
    failedConnections,
    messagesSent,
    messagesReceived,
    
    // 计算属性
    statusText,
    statusColor,
    
    // 方法
    connect,
    disconnect,
    sendText,
    updateConfig,
    updateRequestConfig,
    resetError,
    initializeClient
  }
})
