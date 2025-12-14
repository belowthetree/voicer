/**
 * 工具确认测试服务器
 * 用于测试工具确认协议功能
 */

import { WebSocketServer } from 'ws';

// 创建WebSocket服务器
const wss = new WebSocketServer({ port: 8081 });

console.log('工具确认测试服务器启动在 ws://localhost:8081');
console.log('此服务器将发送工具确认请求来测试UI功能\n');

// 处理连接
wss.on('connection', (ws) => {
  console.log('客户端已连接');
  
  // 发送欢迎消息
  const welcomeResponse = {
    request_id: 'welcome-001',
    response: {
      Text: '工具确认测试服务器已连接。将在5秒后发送工具确认请求...'
    },
    error: null,
    token_usage: null
  };
  
  ws.send(JSON.stringify(welcomeResponse));
  
  // 5秒后发送工具确认请求
  setTimeout(() => {
    console.log('发送工具确认请求...');
    
    const toolConfirmationRequest = {
      request_id: 'tool-confirm-001',
      response: {
        ToolConfirmationRequest: {
          name: 'execute_command',
          arguments: {
            command: 'npm run build',
            requires_approval: true
          },
          description: '构建项目'
        }
      },
      error: null,
      token_usage: null
    };
    
    ws.send(JSON.stringify(toolConfirmationRequest));
    console.log('工具确认请求已发送');
    
    // 10秒后发送另一个工具确认请求
    setTimeout(() => {
      console.log('发送第二个工具确认请求...');
      
      const secondToolConfirmationRequest = {
        request_id: 'tool-confirm-002',
        response: {
          ToolConfirmationRequest: {
            name: 'read_file',
            arguments: {
              path: 'src/main.ts'
            },
            description: '读取主文件内容'
          }
        },
        error: null,
        token_usage: null
      };
      
      ws.send(JSON.stringify(secondToolConfirmationRequest));
      console.log('第二个工具确认请求已发送');
    }, 10000);
  }, 5000);
  
  ws.on('message', (message) => {
    try {
      const request = JSON.parse(message);
      console.log('收到客户端消息:', request.request_id);
      
      // 检查是否是工具确认响应
      if (request.input && request.input.ToolConfirmationResponse) {
        const response = request.input.ToolConfirmationResponse;
        console.log('收到工具确认响应:');
        console.log(`  工具名称: ${response.name}`);
        console.log(`  是否批准: ${response.approved}`);
        console.log(`  原因: ${response.reason || '无'}`);
        console.log(`  参数: ${JSON.stringify(response.arguments)}`);
        
        // 发送确认响应
        const confirmationResponse = {
          request_id: request.request_id,
          response: {
            Text: `工具调用已${response.approved ? '批准' : '拒绝'}: ${response.name}`
          },
          error: null,
          token_usage: null
        };
        
        ws.send(JSON.stringify(confirmationResponse));
      } else if ('Text' in request.input) {
        console.log(`收到文本消息: "${request.input.Text}"`);
        
        // 回复文本消息
        const textResponse = {
          request_id: request.request_id,
          response: {
            Text: `已收到您的消息: "${request.input.Text}"`
          },
          error: null,
          token_usage: null
        };
        
        ws.send(JSON.stringify(textResponse));
      }
    } catch (error) {
      console.error('处理消息时出错:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('客户端已断开连接');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

console.log('服务器已启动，等待连接...');
console.log('按 Ctrl+C 停止服务器');
console.log('\n测试步骤:');
console.log('1. 在浏览器中打开 http://localhost:5174/');
console.log('2. 点击"连接"按钮');
console.log('3. 在配置中设置服务器地址为 ws://localhost:8081');
console.log('4. 连接后，服务器将自动发送工具确认请求');
console.log('5. 在消息列表中查看工具确认消息并测试批准/拒绝按钮');
