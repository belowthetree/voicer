import { ref, onMounted, nextTick, watch, computed } from 'vue'
import { useAppStore } from '../stores'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

export function useChatMessages() {
  const store = useAppStore()
  const messageContainer = ref<HTMLElement | null>(null)
  const messageInput = ref('')
  const copiedMessageId = ref<string | null>(null)

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
      // 尝试使用现代 Clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content)
      } else {
        // 回退方案：使用 textarea 和 execCommand
        const textArea = document.createElement('textarea')
        textArea.value = content
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        const successful = document.execCommand('copy')
        if (!successful) {
          throw new Error('复制失败')
        }
        
        document.body.removeChild(textArea)
      }
      
      copiedMessageId.value = id
      setTimeout(() => {
        copiedMessageId.value = null
      }, 2000)
    } catch (err) {
      console.error('复制失败:', err)
      // 可以在这里添加用户友好的错误提示
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

  // 停止生成
  const stopGenerating = () => {
    // 在实际应用中，这里会取消API请求
    store.isLoading = false
    store.loadingProgress = 0
  }

  return {
    // 引用
    messageContainer,
    
    // 状态
    messageInput,
    copiedMessageId,
    
    // 方法
    sendMessage,
    retryLastMessage,
    copyMessage,
    clearMessages,
    scrollToBottom,
    stopGenerating,
    
    // 计算属性
    lastMessageIsUser,
    
    // 工具函数
    marked
  }
}
