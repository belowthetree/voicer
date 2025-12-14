/**
 * 远程通信 Store
 * 管理与远程 AI Agent 服务器的连接和通信
 */

import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import { RemoteClient } from '../services/remote-client'
import type { 
  RemoteClientConfig, 
  RequestConfig, 
  StreamHandler,
  CommandDefinition,
  CommandListResponse,
  ToolConfirmationResponse 
} from '../types/remote-protocol'
import { ConnectionStatus, RemoteEventType } from '../types/remote-protocol'
import { useAppStore } from './index'

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
    ask_before_tool_execution: true
  })
  
  // 是否使用工具
  const useTools = ref(true)
  
  // 错误信息
  const error = ref('')
  const lastError = ref('')
  
  // 命令相关状态
  const commands = ref<CommandDefinition[]>([])
  const isLoadingCommands = ref(false)
  const commandsError = ref('')
  const lastCommandsUpdate = ref<number | null>(null)
  
  // 连接统计
  const connectionAttempts = ref(0)
  const successfulConnections = ref(0)
  const failedConnections = ref(0)
  const messagesSent = ref(0)
  const messagesReceived = ref(0)
  
  // 命令统计
  const commandsSent = ref(0)
  
  // 工具确认相关状态
  const pendingToolConfirmations = ref<Array<{
    requestId: string;
    name: string;
    arguments: Record<string, any>;
    description?: string;
    timestamp: number;
  }>>([])
  
  const toolConfirmationError = ref('')
  
  // 应用存储实例
  const appStore = useAppStore()
  
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
      
      // 连接成功后自动获取命令列表
      if (isConnected.value) {
        fetchCommands().catch(err => {
          console.warn('连接后获取命令列表失败:', err)
        })
      }
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
    
    // 监听工具确认请求
    client.value.on(RemoteEventType.TOOL_CONFIRMATION_REQUEST, (eventData) => {
      console.log('远程存储收到TOOL_CONFIRMATION_REQUEST事件:', eventData)
      const { requestId, name, arguments: args, description } = eventData.data
      
      console.log(`处理工具确认请求: ${name}`, {
        requestId,
        name,
        args,
        description
      })
      
      // 添加到待确认列表
      pendingToolConfirmations.value.push({
        requestId,
        name,
        arguments: args,
        description,
        timestamp: Date.now()
      })
      
      console.log('添加到待确认列表后，当前数量:', pendingToolConfirmations.value.length)
      
      // 添加到消息列表
      console.log('调用appStore.addToolConfirmationMessage...')
      appStore.addToolConfirmationMessage(requestId, name, args, description)
      
      console.log(`收到工具确认请求: ${name}`, args)
    })
    
    // 监听工具确认响应
    client.value.on(RemoteEventType.TOOL_CONFIRMATION_RESPONSE, (eventData) => {
      const { requestId, name, approved, reason } = eventData.data
      
      // 从待确认列表中移除
      const index = pendingToolConfirmations.value.findIndex(
        item => item.requestId === requestId && item.name === name
      )
      
      if (index !== -1) {
        pendingToolConfirmations.value.splice(index, 1)
      }
      
      console.log(`工具确认响应: ${name} - ${approved ? '已批准' : '已拒绝'}`, reason)
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
        useTools.value,
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
  
  // 发送命令
  async function sendCommand(
    commandName: string,
    parameters: Record<string, any> = {},
    stream = false,
    streamHandler?: StreamHandler
  ): Promise<string> {
    if (!client.value || !isConnected.value) {
      throw new Error('未连接到远程服务器')
    }
    
    try {
      // 注意：sendInstruction 方法不支持 streamHandler 参数
      // 如果需要流式处理，需要使用 sendText 方法
      const response = await client.value.sendInstruction(
        commandName,
        parameters,
        requestConfig,
        stream,
        useTools.value
      )
      
      commandsSent.value++
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
      error.value = err.message || '发送命令失败'
      throw err
    }
  }

  // 发送中断请求
  async function sendInterrupt(): Promise<void> {
    if (!client.value || !isConnected.value) {
      throw new Error('未连接到远程服务器')
    }
    
    try {
      await client.value.sendInterrupt(requestConfig)
      messagesSent.value++
    } catch (err: any) {
      lastError.value = error.value
      error.value = err.message || '发送中断请求失败'
      throw err
    }
  }

  // 发送重新生成请求
  async function sendRegenerate(): Promise<void> {
    if (!client.value || !isConnected.value) {
      throw new Error('未连接到远程服务器')
    }
    
    try {
      await client.value.sendRegenerate(requestConfig)
      messagesSent.value++
    } catch (err: any) {
      lastError.value = error.value
      error.value = err.message || '发送重新生成请求失败'
      throw err
    }
  }
  
  // 发送工具确认响应
  async function sendToolConfirmationResponse(
    requestId: string,
    name: string,
    arguments_: Record<string, any>,
    approved: boolean,
    reason?: string
  ): Promise<void> {
    if (!client.value || !isConnected.value) {
      throw new Error('未连接到远程服务器')
    }
    
    toolConfirmationError.value = ''
    
    try {
      await client.value.sendToolConfirmationResponse(
        requestId,
        name,
        arguments_,
        approved,
        reason
      )
      
      // 从待确认列表中移除
      const index = pendingToolConfirmations.value.findIndex(
        item => item.requestId === requestId && item.name === name
      )
      
      if (index !== -1) {
        pendingToolConfirmations.value.splice(index, 1)
      }
      
      // 更新消息状态
      appStore.updateToolConfirmationStatus(requestId, approved ? 'approved' : 'rejected')
      
      console.log(`已发送工具确认响应: ${name} - ${approved ? '已批准' : '已拒绝'}`)
    } catch (err: any) {
      toolConfirmationError.value = err.message || '发送工具确认响应失败'
      throw err
    }
  }
  
  // 批准工具调用
  async function approveToolCall(
    requestId: string,
    name: string,
    arguments_: Record<string, any>,
    reason?: string
  ): Promise<void> {
    return sendToolConfirmationResponse(requestId, name, arguments_, true, reason)
  }
  
  // 拒绝工具调用
  async function rejectToolCall(
    requestId: string,
    name: string,
    arguments_: Record<string, any>,
    reason?: string
  ): Promise<void> {
    return sendToolConfirmationResponse(requestId, name, arguments_, false, reason)
  }
  
  // 获取待确认的工具请求
  function getPendingToolConfirmations() {
    return pendingToolConfirmations.value
  }
  
  // 清空待确认的工具请求
  function clearPendingToolConfirmations(): void {
    pendingToolConfirmations.value = []
  }
  
  // 检查是否有待确认的工具请求
  const hasPendingToolConfirmations = computed(() => 
    pendingToolConfirmations.value.length > 0
  )
  
  // 获取待确认工具请求数量
  const pendingToolConfirmationsCount = computed(() => 
    pendingToolConfirmations.value.length
  )

  // 获取命令列表
  async function fetchCommands(): Promise<CommandDefinition[]> {
    if (!client.value || !isConnected.value) {
      throw new Error('未连接到远程服务器')
    }
    
    isLoadingCommands.value = true
    commandsError.value = ''
    
    try {
      const response = await client.value.getCommands()
      commands.value = response.commands
      lastCommandsUpdate.value = response.timestamp || Date.now()
      return response.commands
    } catch (err: any) {
      commandsError.value = err.message || '获取命令列表失败'
      throw err
    } finally {
      isLoadingCommands.value = false
    }
  }
  
  // 刷新命令列表
  async function refreshCommands(): Promise<CommandDefinition[]> {
    return fetchCommands()
  }
  
  // 清空命令列表
  function clearCommands(): void {
    commands.value = []
    lastCommandsUpdate.value = null
    commandsError.value = ''
  }
  
  // 根据名称查找命令
  function findCommandByName(name: string): CommandDefinition | undefined {
    return commands.value.find(cmd => cmd.name === name)
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
  
  // 更新是否使用工具
  function updateUseTools(value: boolean): void {
    useTools.value = value
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
  
  // 命令相关计算属性
  const hasCommands = computed(() => commands.value.length > 0)
  const commandsCount = computed(() => commands.value.length)
  const commandsLastUpdated = computed(() => {
    if (!lastCommandsUpdate.value) return null
    return new Date(lastCommandsUpdate.value).toLocaleString()
  })
  const commandsByCategory = computed(() => {
    // 这里可以根据需要按类别分组命令
    // 暂时返回所有命令
    return {
      all: commands.value
    }
  })
  
  // 工具确认相关计算属性
  const toolConfirmationsByRequestId = computed(() => {
    const result: Record<string, typeof pendingToolConfirmations.value[0]> = {}
    pendingToolConfirmations.value.forEach(item => {
      result[item.requestId] = item
    })
    return result
  })
  
  // 初始化
  initializeClient()
  
  return {
    // 状态
    config,
    requestConfig,
    useTools,
    connectionStatus,
    isConnecting,
    isConnected,
    isError,
    error,
    lastError,
    
    // 命令状态
    commands,
    isLoadingCommands,
    commandsError,
    lastCommandsUpdate,
    
    // 工具确认状态
    pendingToolConfirmations,
    toolConfirmationError,
    
    // 统计
    connectionAttempts,
    successfulConnections,
    failedConnections,
    messagesSent,
    messagesReceived,
    commandsSent,
    
    // 计算属性
    statusText,
    statusColor,
    hasCommands,
    commandsCount,
    commandsLastUpdated,
    commandsByCategory,
    
    // 工具确认计算属性
    hasPendingToolConfirmations,
    pendingToolConfirmationsCount,
    toolConfirmationsByRequestId,
    
    // 方法
    connect,
    disconnect,
    sendText,
    sendCommand,
    sendInterrupt,
    sendRegenerate,
    fetchCommands,
    refreshCommands,
    clearCommands,
    findCommandByName,
    updateConfig,
    updateRequestConfig,
    updateUseTools,
    resetError,
    initializeClient,
    
    // 工具确认方法
    sendToolConfirmationResponse,
    approveToolCall,
    rejectToolCall,
    getPendingToolConfirmations,
    clearPendingToolConfirmations
  }
})
