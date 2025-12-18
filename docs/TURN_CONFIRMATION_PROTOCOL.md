# 对话轮次确认协议实现文档

## 概述

本文档描述了在 Voicer 项目中实现的对话轮次确认协议。该协议允许 AI Agent 在需要重置对话轮次时请求用户确认，确保用户对对话状态的完全控制。

## Rust 协议格式

```rust
TurnConfirmationResponse {
    /// 是否确认重置对话轮次
    confirmed: bool,
    /// 可选的确认原因
    reason: Option<String>,
}
```

## TypeScript 类型定义

### 1. 远程协议类型 (`src/types/remote-protocol.ts`)

```typescript
// 对话轮次确认响应接口
export interface TurnConfirmationResponse {
  confirmed: boolean;
  reason?: string;
}

// 事件类型扩展
export enum RemoteEventType {
  // ... 现有事件
  TURN_CONFIRMATION_REQUEST = 'turn_confirmation_request',
  TURN_CONFIRMATION_RESPONSE = 'turn_confirmation_response'
}

// 响应内容类型扩展
export type ResponseContent = 
  // ... 现有类型
  | { TurnConfirmationRequest: { requestId: string; message: string; description?: string } }
  | { TurnConfirmationResponse: TurnConfirmationResponse };
```

### 2. 远程客户端服务 (`src/services/remote-client.ts`)

```typescript
// 发送对话轮次确认响应
async sendTurnConfirmationResponse(
  requestId: string,
  confirmed: boolean,
  reason?: string
): Promise<void> {
  const response: TurnConfirmationResponse = {
    confirmed,
    reason
  };

  await this.sendResponse(requestId, response);
}

// 在消息处理中添加对话轮次确认请求的处理
private handleMessage(data: any): void {
  // ... 现有处理逻辑
  
  if (data.response?.TurnConfirmationRequest) {
    const { requestId, message, description } = data.response.TurnConfirmationRequest;
    
    this.emit(RemoteEventType.TURN_CONFIRMATION_REQUEST, {
      data: { requestId, message, description }
    });
  }
}
```

### 3. 状态管理 Store (`src/stores/remote-store.ts`)

```typescript
// 对话轮次确认相关状态
const pendingTurnConfirmations = ref<Array<{
  requestId: string;
  message: string;
  description?: string;
  timestamp: number;
}>>([])

const turnConfirmationError = ref('')

// 发送对话轮次确认响应
async function sendTurnConfirmationResponse(
  requestId: string,
  confirmed: boolean,
  reason?: string
): Promise<void> {
  if (!client.value || !isConnected.value) {
    throw new Error('未连接到远程服务器')
  }
  
  turnConfirmationError.value = ''
  
  try {
    await client.value.sendTurnConfirmationResponse(
      requestId,
      confirmed,
      reason
    )
    
    // 从待确认列表中移除
    const index = pendingTurnConfirmations.value.findIndex(
      item => item.requestId === requestId
    )
    
    if (index !== -1) {
      pendingTurnConfirmations.value.splice(index, 1)
    }
    
    // 更新消息状态
    appStore.updateTurnConfirmationStatus(requestId, confirmed ? 'confirmed' : 'rejected')
    
    console.log(`已发送对话轮次确认响应: ${confirmed ? '已确认' : '已拒绝'}`)
  } catch (err: any) {
    turnConfirmationError.value = err.message || '发送对话轮次确认响应失败'
    throw err
  }
}

// 确认对话轮次
async function confirmTurn(
  requestId: string,
  reason?: string
): Promise<void> {
  return sendTurnConfirmationResponse(requestId, true, reason)
}

// 拒绝对话轮次
async function rejectTurn(
  requestId: string,
  reason?: string
): Promise<void> {
  return sendTurnConfirmationResponse(requestId, false, reason)
}
```

### 4. 应用状态管理 (`src/stores/index.ts`)

```typescript
// 对话轮次确认消息类型
export interface TurnConfirmationMessage {
  id: string;
  type: 'turn-confirmation';
  requestId: string;
  message: string;
  description?: string;
  status: 'pending' | 'confirmed' | 'rejected';
  timestamp: number;
}

// 添加对话轮次确认消息
addTurnConfirmationMessage(
  requestId: string,
  message: string,
  description?: string
): string {
  const id = `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const turnMessage: TurnConfirmationMessage = {
    id,
    type: 'turn-confirmation',
    requestId,
    message,
    description,
    status: 'pending',
    timestamp: Date.now()
  };
  
  this.messages.push(turnMessage);
  return id;
}

// 更新对话轮次确认状态
updateTurnConfirmationStatus(
  requestId: string,
  status: 'confirmed' | 'rejected'
): void {
  const message = this.messages.find(
    msg => msg.type === 'turn-confirmation' && msg.requestId === requestId
  ) as TurnConfirmationMessage | undefined;
  
  if (message) {
    message.status = status;
  }
}
```

### 5. UI 组件 (`src/components/ChatMessageList.vue`)

```vue
<!-- 对话轮次确认消息模板 -->
<div v-else-if="message.type === 'turn-confirmation'" class="turn-confirmation-wrapper">
  <div class="message-avatar">
    <NAvatar round size="small" :style="{ backgroundColor: '#6f42c1' }">
      <NIcon size="16" :style="{ color: 'white' }">
        <InformationCircle />
      </NIcon>
    </NAvatar>
  </div>
  <div class="turn-confirmation-content">
    <NCard size="small" :bordered="false" :style="{ backgroundColor: '#f3e5ff', borderRadius: '12px' }">
      <div class="turn-confirmation-header">
        <div class="turn-confirmation-title">
          <span class="turn-message">{{ message.message }}</span>
          <NTag :type="getToolConfirmationStatusTag(message.status).type" size="small" round>
            {{ getToolConfirmationStatusTag(message.status).text }}
          </NTag>
        </div>
        <div class="turn-description" v-if="message.description">
          {{ message.description }}
        </div>
      </div>
      
      <div class="turn-confirmation-actions" v-if="message.status === 'pending'">
        <div class="action-buttons">
          <NButton 
            type="primary" 
            size="small" 
            @click="handleConfirmTurn(message.requestId)"
            :loading="remoteStore.turnConfirmationError !== ''"
          >
            <template #icon>
              <NIcon><CheckmarkCircle /></NIcon>
            </template>
            确认继续
          </NButton>
          <NButton 
            type="error" 
            size="small" 
            @click="handleRejectTurn(message.requestId)"
            :loading="remoteStore.turnConfirmationError !== ''"
          >
            <template #icon>
              <NIcon><CloseCircle /></NIcon>
            </template>
            拒绝
          </NButton>
        </div>
      </div>
      
      <div class="turn-confirmation-meta">
        <div class="turn-time">{{ new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</div>
      </div>
    </NCard>
    
    <!-- 错误提示 -->
    <div v-if="remoteStore.turnConfirmationError" class="turn-confirmation-error">
      <NAlert type="error" size="small" :title="remoteStore.turnConfirmationError" closable @close="remoteStore.turnConfirmationError = ''" />
    </div>
  </div>
</div>

<!-- 处理函数 -->
<script setup>
const handleConfirmTurn = (requestId: string) => {
  remoteStore.confirmTurn(requestId, '用户已确认继续对话')
}

const handleRejectTurn = (requestId: string) => {
  remoteStore.rejectTurn(requestId, '用户已拒绝继续对话')
}
</script>
```

## 工作流程

### 1. 触发对话轮次确认

```
用户发送消息 → 远程客户端 → 服务器检测到需要确认 → 返回 TurnConfirmationRequest
```

### 2. 显示确认请求

```
TurnConfirmationRequest → remote-store.ts → appStore.addTurnConfirmationMessage() → ChatMessageList.vue 显示 UI
```

### 3. 用户响应

```
用户点击"确认"或"拒绝" → remote-store.confirmTurn/rejectTurn → 远程客户端发送 TurnConfirmationResponse → 服务器处理
```

### 4. 状态更新

```
服务器响应 → remote-store.ts 更新状态 → appStore.updateTurnConfirmationStatus() → UI 更新显示
```

## 测试

### 1. 启动测试服务器

```bash
node test-turn-confirmation-server.mjs
```

### 2. 打开测试页面

在浏览器中打开 `test-turn-confirmation.html`

### 3. 测试场景

1. **触发确认**: 发送包含"重置对话"、"开始新对话"或"clear"的消息
2. **确认操作**: 点击"确认继续"按钮
3. **拒绝操作**: 点击"拒绝"按钮
4. **兼容性测试**: 测试工具确认功能

## 关键特性

### 1. 完整的类型安全
- TypeScript 接口定义
- Rust ↔ TypeScript 类型映射
- 编译时类型检查

### 2. 状态管理
- 待确认请求队列
- 错误处理机制
- 状态持久化

### 3. 用户体验
- 清晰的 UI 反馈
- 操作状态指示
- 错误提示

### 4. 兼容性
- 与现有工具确认协议并存
- 事件驱动架构
- 可扩展设计

## 集成指南

### 1. 在应用中使用

```typescript
// 在需要触发对话轮次确认的地方
const response = await remoteStore.sendText("重置对话")

// 系统会自动：
// 1. 显示确认 UI
// 2. 等待用户响应
// 3. 发送确认/拒绝
// 4. 继续或取消操作
```

### 2. 自定义触发条件

可以在服务器端修改触发逻辑：

```javascript
// 在 test-turn-confirmation-server.mjs 中
if (data.content.includes('自定义关键词')) {
  // 触发对话轮次确认
}
```

### 3. UI 自定义

可以在 `ChatMessageList.vue` 中修改样式和交互：

```css
.turn-confirmation-wrapper {
  /* 自定义样式 */
}

.turn-message {
  /* 自定义消息样式 */
}
```

## 扩展建议

### 1. 多轮确认
- 支持复杂的多步骤确认流程
- 添加确认超时机制

### 2. 确认历史
- 记录确认历史记录
- 支持撤销操作

### 3. 智能确认
- 基于用户行为的智能提示
- 自动化确认规则

### 4. 通知系统
- 桌面通知
- 声音提示
- 视觉反馈

## 总结

对话轮次确认协议的实现提供了完整的用户控制机制，确保在重要操作前获得用户明确同意。该实现具有良好的类型安全、状态管理和用户体验，可以轻松集成到现有系统中，并支持进一步的扩展和定制。
