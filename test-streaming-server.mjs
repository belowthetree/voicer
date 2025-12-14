/**
 * 测试流式响应服务器 (ES模块版本)
 * 用于测试远程连接的流式响应功能
 */

import { WebSocketServer } from 'ws';

// 创建WebSocket服务器
const wss = new WebSocketServer({ port: 8081 });

console.log('测试流式响应服务器启动在 ws://localhost:8081');

// 模拟的命令列表
const mockCommands = [
  {
    name: 'test_stream',
    description: '测试流式响应',
    parameters: {
      message: { type: 'string', description: '要流式返回的消息', required: true },
      delay: { type: 'number', description: '每个块之间的延迟(毫秒)', required: false, default: 100 }
    }
  },
  {
    name: 'echo',
    description: '回声测试',
    parameters: {
      text: { type: 'string', description: '要回声的文本', required: true }
    }
  }
];

// 处理连接
wss.on('connection', (ws) => {
  console.log('客户端已连接');
  
  ws.on('message', async (message) => {
    try {
      const request = JSON.parse(message);
      console.log('收到请求:', request.request_id, request.input);
      
      // 处理不同类型的请求
      if ('GetCommands' in request.input) {
        // 返回命令列表
        const response = {
          request_id: request.request_id,
          response: {
            Text: JSON.stringify({
              commands: mockCommands,
              timestamp: Date.now()
            })
          },
          error: null
        };
        
        console.log('发送命令列表响应');
        ws.send(JSON.stringify(response));
      } else if ('Text' in request.input) {
        const text = request.input.Text;
        
        // 检查是否请求流式响应
        if (request.stream === true) {
          console.log('发送流式响应');
          
          // 模拟流式响应 - 将文本分成多个块
          const chunks = splitTextIntoChunks(text, 5);
          
          // 发送流式块
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const streamResponse = {
              request_id: request.request_id,
              response: {
                Stream: [chunk]
              },
              error: null
            };
            
            console.log(`发送流式块 ${i + 1}/${chunks.length}: "${chunk}"`);
            ws.send(JSON.stringify(streamResponse));
            
            // 模拟处理延迟
            await sleep(100);
          }
          
          // 发送流式完成
          const completeResponse = {
            request_id: request.request_id,
            response: {
              StreamComplete: {
                token_usage: {
                  prompt_tokens: 10,
                  completion_tokens: text.length,
                  total_tokens: 10 + text.length
                },
                interrupted: false
              }
            },
            error: null
          };
          
          console.log('发送流式完成响应');
          ws.send(JSON.stringify(completeResponse));
        } else {
          // 普通文本响应
          const response = {
            request_id: request.request_id,
            response: {
              Text: `已收到您的消息: "${text}"`
            },
            error: null
          };
          
          console.log('发送文本响应');
          ws.send(JSON.stringify(response));
        }
      } else if ('Instruction' in request.input) {
        // 处理指令
        const instruction = request.input.Instruction;
        
        if (instruction.command === 'test_stream') {
          const message = instruction.parameters.message || '这是一个测试流式响应';
          const delay = instruction.parameters.delay || 100;
          
          console.log(`开始测试流式响应: "${message}"`);
          
          // 模拟流式响应
          const chunks = splitTextIntoChunks(message, 5);
          
          // 发送流式块
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const streamResponse = {
              request_id: request.request_id,
              response: {
                Stream: [chunk]
              },
              error: null
            };
            
            console.log(`发送流式块 ${i + 1}/${chunks.length}: "${chunk}"`);
            ws.send(JSON.stringify(streamResponse));
            
            // 使用指定的延迟
            await sleep(delay);
          }
          
          // 发送流式完成
          const completeResponse = {
            request_id: request.request_id,
            response: {
              StreamComplete: {
                token_usage: {
                  prompt_tokens: 15,
                  completion_tokens: message.length,
                  total_tokens: 15 + message.length
                },
                interrupted: false
              }
            },
            error: null
          };
          
          console.log('发送流式完成响应');
          ws.send(JSON.stringify(completeResponse));
        } else {
          // 普通指令响应
          const response = {
            request_id: request.request_id,
            response: {
              Text: `已执行命令: ${instruction.command}，参数: ${JSON.stringify(instruction.parameters)}`
            },
            error: null
          };
          
          console.log('发送指令响应');
          ws.send(JSON.stringify(response));
        }
      } else {
        // 未知输入类型
        const response = {
          request_id: request.request_id,
          response: {
            Text: '未知输入类型'
          },
          error: 'unsupported_input_type'
        };
        
        ws.send(JSON.stringify(response));
      }
    } catch (error) {
      console.error('处理消息时出错:', error);
      
      const response = {
        request_id: 'unknown',
        response: {
          Text: '服务器内部错误'
        },
        error: 'internal_error'
      };
      
      ws.send(JSON.stringify(response));
    }
  });
  
  ws.on('close', () => {
    console.log('客户端已断开连接');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket错误:', error);
  });
});

// 辅助函数：将文本分成多个块
function splitTextIntoChunks(text, chunkCount) {
  const chunkSize = Math.ceil(text.length / chunkCount);
  const chunks = [];
  
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, text.length);
    if (start < text.length) {
      chunks.push(text.substring(start, end));
    }
  }
  
  return chunks;
}

// 辅助函数：睡眠
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('服务器已启动，等待连接...');
console.log('按 Ctrl+C 停止服务器');
