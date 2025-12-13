<script setup lang="ts">
import { NModal, NCard, NText, NButton, NSpace, NIcon } from 'naive-ui'
import { InformationCircleOutline, LogoGithub, DocumentTextOutline } from '@vicons/ionicons5'

// 定义props
const props = defineProps<{
  show: boolean
}>()

// 定义事件
const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

// 关闭模态框
const closeModal = () => {
  emit('update:show', false)
}

// 打开外部链接
const openGithub = () => {
  window.open('https://github.com', '_blank')
}

const openDocs = () => {
  window.open('https://example.com/docs', '_blank')
}
</script>

<template>
  <NModal
    v-model:show="props.show"
    preset="card"
    title="关于 Voicer AI"
    style="width: 500px; max-width: 90vw;"
    :bordered="false"
    size="huge"
    @close="closeModal"
  >
    <NCard :bordered="false">
      <div class="about-content">
        <!-- 应用信息 -->
        <div class="app-info">
          <div class="app-header">
            <NIcon size="48" color="#4f46e5">
              <InformationCircleOutline />
            </NIcon>
            <div class="app-title">
              <h2>Voicer AI 助手</h2>
              <NText type="info" depth="3">版本 1.0.0</NText>
            </div>
          </div>
          
          <div class="app-description">
            <p>
              Voicer AI 是一个基于语音和文本的智能助手应用，支持与远程AI服务器连接，
              提供丰富的命令功能和实时交互体验。
            </p>
          </div>
        </div>

        <!-- 功能特性 -->
        <div class="features-section">
          <h3>主要功能</h3>
          <ul class="features-list">
            <li>语音识别与合成</li>
            <li>远程AI服务器连接</li>
            <li>丰富的命令系统</li>
            <li>实时消息交互</li>
            <li>可配置的服务器设置</li>
            <li>响应式界面设计</li>
          </ul>
        </div>

        <!-- 技术栈 -->
        <div class="tech-stack">
          <h3>技术栈</h3>
          <div class="tech-tags">
            <span class="tech-tag">Vue 3</span>
            <span class="tech-tag">TypeScript</span>
            <span class="tech-tag">Tauri</span>
            <span class="tech-tag">Naive UI</span>
            <span class="tech-tag">Pinia</span>
            <span class="tech-tag">Vite</span>
          </div>
        </div>

        <!-- 链接 -->
        <div class="links-section">
          <h3>相关链接</h3>
          <NSpace>
            <NButton
              type="primary"
              ghost
              @click="openGithub"
            >
              <template #icon>
                <NIcon><LogoGithub /></NIcon>
              </template>
              GitHub 仓库
            </NButton>
            <NButton
              type="info"
              ghost
              @click="openDocs"
            >
              <template #icon>
                <NIcon><DocumentTextOutline /></NIcon>
              </template>
              使用文档
            </NButton>
          </NSpace>
        </div>

        <!-- 版权信息 -->
        <div class="copyright">
          <NText type="info" depth="3">
            © 2024 Voicer AI. 保留所有权利。
          </NText>
        </div>
      </div>
    </NCard>
  </NModal>
</template>

<style scoped>
.about-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.app-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-title h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
}

.app-description p {
  margin: 0;
  line-height: 1.6;
  color: #4b5563;
}

.features-section h3,
.tech-stack h3,
.links-section h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.features-list {
  margin: 0;
  padding-left: 20px;
  color: #4b5563;
}

.features-list li {
  margin-bottom: 8px;
  line-height: 1.5;
}

.tech-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tech-tag {
  padding: 4px 12px;
  background-color: #f3f4f6;
  border-radius: 16px;
  font-size: 14px;
  color: #4b5563;
  border: 1px solid #e5e7eb;
}

.copyright {
  text-align: center;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
  margin-top: 8px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .app-header {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
  
  .tech-tags {
    justify-content: center;
  }
  
  .links-section :deep(.n-space) {
    justify-content: center;
  }
}
</style>
