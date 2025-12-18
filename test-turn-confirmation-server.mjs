/**
 * 对话轮次确认协议测试服务器
 * 模拟支持对话轮次确认的远程 AI Agent 服务器
 */

import { createServer } from 'http'

const PORT = 8080

// 模拟的对话轮次确认请求
const pendingTurnConfirmations = new Map()

const server = createServer((req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })

    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        console.log('收到请求:', data)

        // 处理文本消息
        if (data.type === 'text' && data.content) {
          // 检查是否需要对话轮次确认
          if (data.content.includes('重置对话') || data.content.includes('开始新对话') || data.content.includes('clear')) {
            const requestId = `turn_${Date.now()}`
            
            // 存储确认请求
            pendingTurnConfirmations.set(requestId, {
              message: '是否确认重置对话轮次？',
              description: '此操作将清空当前对话上下文，开始新的对话轮次',
              timestamp: Date.now()
            })

            // 返回对话轮次确认请求
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              id: requestId,
              response: {
                TurnConfirmationRequest: {
                  requestId,
                  message: '是否确认重置对话轮次？',
                  description: '此操作将清空当前对话上下文，开始新的对话轮次'
                }
              }
            }))
            return
          }

          // 普通文本响应
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            id: `msg_${Date.now()}`,
            response: {
              Text: `收到您的消息: "${data.content}"\n\n这是一个模拟的 AI 响应。如果您的消息包含"重置对话"、"开始新对话"或"clear"，将会触发对话轮次确认。`
            }
          }))
        }

        // 处理对话轮次确认响应
        else if (data.type === 'turn_confirmation_response') {
          const { requestId, confirmed, reason } = data
          
          if (pendingTurnConfirmations.has(requestId)) {
            pendingTurnConfirmations.delete(requestId)
            
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              id: requestId,
              response: {
                Text: confirmed 
                  ? `对话轮次已确认重置。原因: ${reason || '用户确认'}\n\n现在可以开始新的对话轮次。`
                  : `对话轮次重置已取消。原因: ${reason || '用户拒绝'}\n\n对话将继续保持当前状态。`
              }
            }))
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: '未找到对应的确认请求' }))
          }
        }

        // 处理工具确认响应（保持兼容性）
        else if (data.type === 'tool_confirmation_response') {
          const { requestId, name, approved, reason } = data
          
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            id: requestId,
            response: {
              Text: `工具确认响应已收到: ${name}\n批准: ${approved}\n原因: ${reason || '无'}`
            }
          }))
        }

        // 其他请求类型
        else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '不支持的请求类型' }))
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'JSON 解析错误' }))
      }
    })
  }

  // 获取命令列表
  else if (req.method === 'GET' && req.url === '/api/commands') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      commands: [
        {
          name: 'help',
          description: '显示帮助信息',
          parameters: {}
        },
        {
          name: 'clear',
          description: '清空对话历史',
          parameters: {}
        }
      ],
      timestamp: Date.now()
    }))
  }

  // 心跳检查
  else if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', pendingConfirmations: pendingTurnConfirmations.size }))
  }

  else {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: '未找到的路由' }))
  }
})

server.listen(PORT, () => {
  console.log(`🧪 对话轮次确认测试服务器运行在 http://localhost:${PORT}`)
  console.log('支持的端点:')
  console.log('  POST /api/chat - 发送消息和确认响应')
  console.log('  GET  /api/commands - 获取命令列表')
  console.log('  GET  /api/health - 健康检查')
  console.log('')
  console.log('测试场景:')
  console.log('  1. 发送包含"重置对话"的消息触发确认')
  console.log('  2. 发送 type: "turn_confirmation_response" 进行确认/拒绝')
  console.log('  3. 发送普通文本消息获取响应')
})

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 服务器正在关闭...')
  server.close(() => {
    console.log('✅ 服务器已关闭')
    process.exit(0)
  })
})
