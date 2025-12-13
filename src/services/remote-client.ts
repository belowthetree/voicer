/**
 * Remote AI Agent 客户端
 * 实现与远程 AI Agent 服务器的通信
 */

import type {
  RemoteClientConfig,
  RemoteRequest,
  RemoteResponse,
  InputType,
  RequestConfig,
  RemoteEventData,
  StreamHandler,
  ToolCallHandler
} from '../types/remote-protocol';
import {
  ConnectionStatus,
  RemoteEventType
} from '../types/remote-protocol';

export class RemoteClient {
  private config: RemoteClientConfig;
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private eventListeners: Map<RemoteEventType, ((data: any) => void)[]> = new Map();
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private pendingRequests: Map<string, {
    resolve: (value: RemoteResponse) => void;
    reject: (reason: any) => void;
    streamHandler?: StreamHandler;
  }> = new Map();

  constructor(config: RemoteClientConfig) {
    this.config = {
      timeout: 30000,
      reconnectAttempts: 5,
      reconnectDelay: 3000,
      ...config
    };
  }

  /**
   * 连接到远程服务器
   */
  async connect(): Promise<void> {
    if (this.status === ConnectionStatus.CONNECTED || this.status === ConnectionStatus.CONNECTING) {
      return;
    }

    this.setStatus(ConnectionStatus.CONNECTING);

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `ws://${this.config.host}:${this.config.port}`;
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.setStatus(ConnectionStatus.CONNECTED);
          this.reconnectAttempts = 0;
          this.emitEvent(RemoteEventType.CONNECT, { host: this.config.host, port: this.config.port });
          resolve();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onerror = (error) => {
          this.setStatus(ConnectionStatus.ERROR);
          this.emitEvent(RemoteEventType.ERROR, error);
          reject(new Error(`连接错误: ${error}`));
        };

        this.socket.onclose = (event) => {
          this.setStatus(ConnectionStatus.DISCONNECTED);
          this.emitEvent(RemoteEventType.DISCONNECT, { code: event.code, reason: event.reason });
          
          // 尝试重连
          if (this.reconnectAttempts < (this.config.reconnectAttempts || 5)) {
            this.scheduleReconnect();
          }
        };

        // 设置超时
        setTimeout(() => {
          if (this.status !== ConnectionStatus.CONNECTED) {
            this.socket?.close();
            reject(new Error('连接超时'));
          }
        }, this.config.timeout || 30000);

      } catch (error) {
        this.setStatus(ConnectionStatus.ERROR);
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.setStatus(ConnectionStatus.DISCONNECTED);
    this.pendingRequests.clear();
  }

  /**
   * 发送请求
   */
  async sendRequest(
    input: InputType,
    config?: RequestConfig,
    stream = false,
    useTools = true,
    streamHandler?: StreamHandler
  ): Promise<RemoteResponse> {
    if (this.status !== ConnectionStatus.CONNECTED) {
      throw new Error('未连接到服务器');
    }

    const requestId = this.generateRequestId();
    const request: RemoteRequest = {
      request_id: requestId,
      input,
      config,
      stream,
      use_tools: useTools
    };

    return new Promise((resolve, reject) => {
      // 设置请求超时
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('请求超时'));
      }, this.config.timeout || 30000);

      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        streamHandler
      });

      try {
        this.socket?.send(JSON.stringify(request));
      } catch (error) {
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * 发送文本消息
   */
  async sendText(
    text: string,
    config?: RequestConfig,
    stream = false,
    useTools = true,
    streamHandler?: StreamHandler
  ): Promise<RemoteResponse> {
    return this.sendRequest({ Text: text }, config, stream, useTools, streamHandler);
  }

  /**
   * 发送图像
   */
  async sendImage(
    data: string,
    mimeType?: string,
    config?: RequestConfig,
    stream = false,
    useTools = true
  ): Promise<RemoteResponse> {
    return this.sendRequest({ Image: { data, mime_type: mimeType } }, config, stream, useTools);
  }

  /**
   * 发送指令
   */
  async sendInstruction(
    command: string,
    parameters: Record<string, any>,
    config?: RequestConfig,
    stream = false,
    useTools = true
  ): Promise<RemoteResponse> {
    return this.sendRequest({ Instruction: { command, parameters } }, config, stream, useTools);
  }

  /**
   * 发送文件
   */
  async sendFile(
    filename: string,
    contentType: string,
    data: string,
    config?: RequestConfig,
    stream = false,
    useTools = true
  ): Promise<RemoteResponse> {
    return this.sendRequest({ File: { filename, content_type: contentType, data } }, config, stream, useTools);
  }

  /**
   * 获取连接状态
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 添加事件监听器
   */
  on(event: RemoteEventType, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * 移除事件监听器
   */
  off(event: RemoteEventType, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 设置工具调用处理器
   */
  setToolCallHandler(handler: ToolCallHandler): void {
    this.on(RemoteEventType.TOOL_CALL, async (data) => {
      if (handler.onToolCall) {
        try {
          const result = await handler.onToolCall(data.name, data.arguments);
          // 发送工具执行结果
          if (this.socket && this.status === ConnectionStatus.CONNECTED) {
            const toolResult = {
              request_id: data.request_id,
              response: {
                ToolResult: {
                  name: data.name,
                  result
                }
              }
            };
            this.socket.send(JSON.stringify(toolResult));
          }
          handler.onToolResult?.(data.name, result);
        } catch (error) {
          console.error('工具调用失败:', error);
        }
      }
    });
  }

  // 私有方法

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleMessage(data: string): void {
    try {
      const response: RemoteResponse = JSON.parse(data);
      const requestId = response.request_id;

      // 查找对应的请求处理器
      const requestHandler = this.pendingRequests.get(requestId);
      if (requestHandler) {
        // 处理流式响应
        if ('Stream' in response.response && requestHandler.streamHandler) {
          const streamChunks = response.response.Stream;
          streamChunks.forEach(chunk => {
            requestHandler.streamHandler?.onChunk?.(chunk);
            this.emitEvent(RemoteEventType.STREAM_CHUNK, { requestId, chunk });
          });
          
          const fullText = streamChunks.join('');
          requestHandler.streamHandler?.onComplete?.(fullText);
          this.pendingRequests.delete(requestId);
          requestHandler.resolve(response);
        }
        // 处理工具调用
        else if ('ToolCall' in response.response) {
          this.emitEvent(RemoteEventType.TOOL_CALL, {
            requestId,
            ...response.response.ToolCall
          });
          // 工具调用不会立即完成，等待工具执行结果
        }
        // 处理普通响应
        else {
          this.pendingRequests.delete(requestId);
          requestHandler.resolve(response);
          this.emitEvent(RemoteEventType.MESSAGE, response);
        }
      } else {
        // 未找到对应的请求，可能是服务器主动推送的消息
        this.emitEvent(RemoteEventType.MESSAGE, response);
      }
    } catch (error) {
      console.error('解析消息失败:', error, data);
      this.emitEvent(RemoteEventType.ERROR, { error: '解析消息失败', data });
    }
  }

  private emitEvent(type: RemoteEventType, data: any): void {
    const eventData: RemoteEventData = {
      type,
      data,
      timestamp: Date.now()
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(eventData);
        } catch (error) {
          console.error('事件监听器执行失败:', error);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    this.setStatus(ConnectionStatus.RECONNECTING);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('重连失败:', error);
        if (this.reconnectAttempts < (this.config.reconnectAttempts || 5)) {
          this.scheduleReconnect();
        }
      });
    }, this.config.reconnectDelay || 3000);

    this.emitEvent(RemoteEventType.ERROR, {
      message: `连接断开，正在尝试重连 (${this.reconnectAttempts}/${this.config.reconnectAttempts})`
    });
  }
}
