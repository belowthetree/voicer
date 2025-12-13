/**
 * Remote AI Agent 通信协议类型定义
 * 基于 agent-cli 的远程协议规范
 */

// 输入类型
export type InputType =
  | { Text: string }
  | { Image: { data: string; mime_type?: string } }
  | { Instruction: { command: string; parameters: Record<string, any> } }
  | { File: { filename: string; content_type: string; data: string } }
  | { Multi: InputType[] };

// 请求配置
export interface RequestConfig {
  max_tool_try?: number;
  max_context_num?: number;
  max_tokens?: number;
  ask_before_tool_execution?: boolean;
  prompt?: string;
}

// 远程请求
export interface RemoteRequest {
  request_id: string;
  input: InputType;
  config?: RequestConfig;
  stream?: boolean;
  use_tools?: boolean;
}

// 响应内容
export type ResponseContent =
  | { Text: string }
  | { Stream: string[] }
  | { ToolCall: { name: string; arguments: Record<string, any> } }
  | { ToolResult: { name: string; result: Record<string, any> } }
  | { Multi: ResponseContent[] };

// Token 使用统计
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// 远程响应
export interface RemoteResponse {
  request_id: string;
  response: ResponseContent;
  error?: string;
  token_usage?: TokenUsage;
}

// 客户端配置
export interface RemoteClientConfig {
  host: string;
  port: number;
  timeout?: number;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

// 连接状态
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

// 事件类型
export enum RemoteEventType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  MESSAGE = 'message',
  ERROR = 'error',
  STREAM_CHUNK = 'stream_chunk',
  TOOL_CALL = 'tool_call',
  TOOL_RESULT = 'tool_result'
}

// 事件数据
export interface RemoteEventData {
  type: RemoteEventType;
  data: any;
  timestamp: number;
}

// 流式响应处理器
export interface StreamHandler {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

// 工具调用处理器
export interface ToolCallHandler {
  onToolCall?: (toolName: string, args: Record<string, any>) => Promise<any>;
  onToolResult?: (toolName: string, result: any) => void;
}
