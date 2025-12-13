# Voicer 开发指南

## 开发环境设置

### 系统要求
- Node.js 20.19.0 或更高版本（推荐 22.12.0+）
- Rust 1.77.2 或更高版本
- npm 10.x 或更高版本
- Git

### 1. 安装 Node.js 和 npm
```bash
# 使用 nvm（推荐）
nvm install 20.19.0
nvm use 20.19.0

# 或从官网下载安装
# https://nodejs.org/
```

### 2. 安装 Rust
```bash
# Windows
# 下载并运行 rustup-init.exe
# https://rustup.rs/

# macOS/Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 验证安装
rustc --version
cargo --version
```

### 3. 安装 Tauri CLI
```bash
npm install -g @tauri-apps/cli
# 或使用 cargo
cargo install tauri-cli
```

### 4. 克隆项目
```bash
git clone <repository-url>
cd voicer
```

### 5. 安装依赖
```bash
# 安装前端依赖
npm install

# 安装 Rust 依赖（自动运行）
# 如果需要手动安装
cd src-tauri
cargo build
```

## 项目结构说明

### 前端结构 (`src/`)
```
src/
├── assets/           # 静态资源（图片、样式、字体）
├── components/       # 可复用 Vue 组件
├── stores/           # Pinia 状态管理
├── router/           # Vue Router 配置
├── views/            # 页面级组件
├── App.vue           # 根组件
└── main.ts           # 应用入口
```

### Tauri 后端结构 (`src-tauri/`)
```
src-tauri/
├── src/              # Rust 源代码
├── Cargo.toml        # Rust 依赖配置
├── tauri.conf.json   # Tauri 应用配置
└── icons/            # 应用图标
```

## 开发工作流

### 1. 启动开发服务器
```bash
# 启动前端开发服务器（Vite）
npm run dev

# 启动 Tauri 开发模式（包含前端）
npm run tauri dev
```

开发服务器将在以下地址运行：
- 前端: http://localhost:5173
- Tauri: 桌面应用窗口

### 2. 代码质量检查
```bash
# TypeScript 类型检查
npm run type-check

# 运行 ESLint
npm run lint

# 自动修复 ESLint 问题
npm run lint:fix
```

### 3. 构建项目
```bash
# 仅构建前端
npm run build

# 构建 Tauri 应用
npm run tauri build
```

构建产物位置：
- 前端: `dist/` 目录
- Tauri: `src-tauri/target/release/` 目录

## 代码规范

### TypeScript 规范
- 使用严格模式 (`strict: true`)
- 避免使用 `any` 类型
- 为函数参数和返回值添加类型注解
- 使用接口定义复杂对象结构

### Vue 组件规范
- 使用 Composition API (`<script setup>`)
- 组件名使用 PascalCase
- Props 使用 TypeScript 接口定义
- 事件使用 TypeScript 类型定义
- 样式使用 Scoped CSS

### 示例组件结构
```vue
<script setup lang="ts">
import { ref } from 'vue'

// Props 定义
interface Props {
  title: string
  count?: number
}

const props = defineProps<Props>()

// 事件定义
const emit = defineEmits<{
  (e: 'update', value: string): void
  (e: 'submit'): void
}>()

// 响应式状态
const message = ref('')

// 方法
function handleSubmit() {
  emit('submit')
  emit('update', message.value)
}
</script>

<template>
  <div class="component">
    <h2>{{ title }}</h2>
    <input v-model="message" />
    <button @click="handleSubmit">提交</button>
  </div>
</template>

<style scoped>
.component {
  padding: 1rem;
}
</style>
```

## 状态管理 (Pinia)

### Store 结构
```typescript
// src/stores/example.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useExampleStore = defineStore('example', () => {
  // State
  const count = ref(0)
  const name = ref('')
  
  // Getters
  const doubleCount = computed(() => count.value * 2)
  
  // Actions
  function increment() {
    count.value++
  }
  
  function reset() {
    count.value = 0
    name.value = ''
  }
  
  return {
    count,
    name,
    doubleCount,
    increment,
    reset
  }
})
```

### 在组件中使用 Store
```vue
<script setup lang="ts">
import { useExampleStore } from '@/stores/example'

const store = useExampleStore()

// 直接访问 state
console.log(store.count)

// 调用 action
store.increment()

// 使用 getter
console.log(store.doubleCount)
</script>
```

## 路由配置 (Vue Router)

### 路由定义
```typescript
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue')
    }
  ]
})

export default router
```

### 路由守卫
```typescript
// 全局前置守卫
router.beforeEach((to, from, next) => {
  // 检查用户认证
  const isAuthenticated = localStorage.getItem('token')
  
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else {
    next()
  }
})
```

## Tauri 集成

### 调用 Rust 函数
```typescript
// 前端调用
import { invoke } from '@tauri-apps/api/core'

async function callRustFunction() {
  try {
    const result = await invoke('greet', { name: 'World' })
    console.log(result)
  } catch (error) {
    console.error('调用失败:', error)
  }
}
```

```rust
// Rust 后端
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

### 事件系统
```typescript
// 前端监听事件
import { listen } from '@tauri-apps/api/event'

listen('custom-event', (event) => {
  console.log('收到事件:', event.payload)
})
```

```rust
// Rust 发送事件
app.emit_all("custom-event", "Hello from Rust!").unwrap();
```

## 测试

### 单元测试
```bash
# 运行单元测试
npm run test:unit

# 运行测试并生成覆盖率报告
npm run test:coverage
```

### 端到端测试 (Playwright)
```bash
# 安装 Playwright 浏览器
npx playwright install

# 运行所有端到端测试
npm run test:e2e

# 在 UI 模式下运行测试
npm run test:e2e -- --ui

# 运行特定测试文件
npm run test:e2e -- e2e/chat.spec.ts
```

### 测试示例
```typescript
// e2e/chat.spec.ts
import { test, expect } from '@playwright/test'

test('聊天功能测试', async ({ page }) => {
  await page.goto('/')
  
  // 输入消息
  await page.fill('input[placeholder="输入消息..."]', 'Hello')
  await page.click('button:has-text("发送")')
  
  // 验证消息显示
  await expect(page.locator('.message-content')).toContainText('Hello')
})
```

## 调试技巧

### 浏览器开发者工具
- **Vue DevTools**: 安装 Vue DevTools 扩展
- **组件检查**: 查看组件层次结构和状态
- **性能分析**: 使用 Performance 面板分析渲染性能

### VSCode 调试配置
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "调试前端",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src"
    }
  ]
}
```

### Rust 调试
```bash
# 使用 cargo 调试
cargo build --verbose
cargo run --debug

# 使用 rust-gdb/rust-lldb
rust-gdb target/debug/app
```

## 性能优化

### 1. 代码分割
```typescript
// 路由懒加载
const AboutView = () => import('../views/AboutView.vue')
```

### 2. 图片优化
- 使用 WebP 格式
- 实现懒加载
- 使用响应式图片

### 3. 状态管理优化
- 避免不必要的响应式数据
- 使用 computed 缓存计算结果
- 批量更新状态

### 4. 渲染优化
- 使用 `v-once` 静态内容
- 使用 `v-memo` 记忆化
- 避免深层响应式对象

## 常见问题解决

### 1. 依赖安装失败
```bash
# 清理缓存并重试
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 2. TypeScript 类型错误
```bash
# 检查类型错误
npm run type-check

# 如果使用第三方库缺少类型定义
npm install -D @types/package-name
```

### 3. Tauri 构建失败
```bash
# 检查 Rust 工具链
rustup update
rustup component add rust-src

# 清理构建缓存
cd src-tauri
cargo clean
```

### 4. 端口冲突
```bash
# 修改开发服务器端口
# vite.config.ts
export default defineConfig({
  server: {
    port: 3000
  }
})
```

## 开发工具推荐

### 编辑器扩展
- **Volar** - Vue 语言支持
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **Rust Analyzer** - Rust 语言支持

### 命令行工具
- **pnpm** - 更快的包管理器
- **bun** - 快速的 JavaScript 运行时
- **just** - 命令行运行器

### 调试工具
- **Vue DevTools**
- **Rust Debugger**
- **Playwright Test Runner**

---

*最后更新: 2025-12-13*
