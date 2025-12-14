import { ref, computed } from 'vue'
import { useRemoteStore } from '../stores/remote-store'
import { 
  Play, Terminal, Code, DocumentText, ArchiveOutline, GlobeOutline, CogOutline, Rocket,
  StopCircle, Trash, Refresh, TerminalOutline, FlashOutline,
  PauseCircle, RefreshCircle
} from '@vicons/ionicons5'

export function useChatCommands() {
  const remoteStore = useRemoteStore()
  
  // 命令相关状态
  const showCommandsPanel = ref(false)
  const selectedCommand = ref<string | null>(null)
  const commandParameters = ref<Record<string, any>>({})
  const isSendingCommand = ref(false)

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
      return response
    } catch (err: any) {
      console.error('发送命令失败:', err)
      throw err
    } finally {
      isSendingCommand.value = false
    }
  }

  // 快速发送命令（无参数）
  const quickSendCommand = (commandName: string) => {
    return sendCommand(commandName)
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
      'delete': Trash,
      'interrupt': PauseCircle,
      'regenerate': RefreshCircle
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
      'delete': 'error',
      'interrupt': 'warning',
      'regenerate': 'info'
    }
    
    for (const [key, color] of Object.entries(colorMap)) {
      if (commandName.toLowerCase().includes(key)) {
        return color
      }
    }
    
    return 'default'
  }

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

  return {
    // 状态
    showCommandsPanel,
    selectedCommand,
    commandParameters,
    isSendingCommand,
    
    // 方法
    refreshCommands,
    sendCommand,
    quickSendCommand,
    getCommandIcon,
    getCommandColor,
    
    // 计算属性
    hasCommands,
    commandsCount,
    isLoadingCommands,
    commandsError,
    commandsLastUpdated,
    groupedCommands,
    popularCommands
  }
}
