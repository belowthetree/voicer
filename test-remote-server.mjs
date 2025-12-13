/**
 * 测试远程服务器 (ES模块版本)
 * 用于测试远程连接和命令获取功能
 */

import { WebSocketServer } from 'ws';

// 创建WebSocket服务器
const wss = new WebSocketServer({ port: 8080 });

console.log('测试远程服务器启动在 ws://localhost:8080');

// 模拟的命令列表
const mockCommands = [
  {
    name: 'run_code',
    description: '运行代码片段',
    parameters: {
      language: { type: 'string', description: '编程语言', required: true },
      code: { type: 'string', description: '要运行的代码', required: true }
    }
  },
  {
    name: 'read_file',
    description: '读取文件内容',
    parameters: {
      path: { type: 'string', description: '文件路径', required: true }
    }
  },
  {
    name: 'write_file',
    description: '写入文件',
    parameters: {
      path: { type: 'string', description: '文件路径', required: true },
      content: { type: 'string', description: '文件内容', required: true }
    }
  },
  {
    name: 'execute_command',
    description: '执行系统命令',
    parameters: {
      command: { type: 'string', description: '要执行的命令', required: true },
      args: { type: 'array', description: '命令参数', required: false }
    }
  },
  {
    name: 'list_files',
    description: '列出目录中的文件',
    parameters: {
      path: { type: 'string', description: '目录路径', required: false }
    }
  },
  {
    name: 'get_system_info',
    description: '获取系统信息',
    parameters: {}
  },
  {
    name: 'connect_to_database',
    description: '连接到数据库',
    parameters: {
      type: { type: 'string', description: '数据库类型', required: true },
      host: { type: 'string', description: '主机地址', required: true },
      port: { type: 'number', description: '端口号', required: true },
      database: { type: 'string', description: '数据库名', required: true }
    }
  },
  {
    name: 'query_database',
    description: '查询数据库',
    parameters: {
      query: { type: 'string', description: 'SQL查询语句', required: true }
    }
  },
  {
    name: 'start_server',
    description: '启动服务器',
    parameters: {
      type: { type: 'string', description: '服务器类型', required: true },
      port: { type: 'number', description: '端口号', required: true }
    }
  },
  {
    name: 'stop_server',
    description: '停止服务器',
    parameters: {
      server_id: { type: 'string', description: '服务器ID', required: true }
    }
  }
];

// 处理连接
wss.on('connection', (ws) => {
  console.log('客户端已连接');
  
  ws.on('message', (message) => {
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
        // 处理文本消息
        const response = {
          request_id: request.request_id,
          response: {
            Text: `已收到您的消息: "${request.input.Text}"`
          },
          error: null
        };
        
        console.log('发送文本响应');
        ws.send(JSON.stringify(response));
      } else if ('Instruction' in request.input) {
        // 处理指令
        const instruction = request.input.Instruction;
        const response = {
          request_id: request.request_id,
          response: {
            Text: `已执行命令: ${instruction.command}，参数: ${JSON.stringify(instruction.parameters)}`
          },
          error: null
        };
        
        console.log('发送指令响应');
        ws.send(JSON.stringify(response));
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

console.log('服务器已启动，等待连接...');
console.log('按 Ctrl+C 停止服务器');
