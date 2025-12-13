<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../stores'
import { NInput, NButton, NForm, NFormItem, NCard, NSpace, NSwitch, NInputNumber, NSelect } from 'naive-ui'

const store = useAppStore()

// 设置表单
const apiUrl = ref(store.apiUrl)
const saveSettings = () => {
  store.setApiUrl(apiUrl.value)
}

// 语音设置
const voiceSettings = ref({
  enabled: true,
  autoSend: true,
  language: 'zh-CN'
})

// 语言选项
const languageOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: '英语', value: 'en-US' },
  { label: '日语', value: 'ja-JP' }
]
</script>

<template>
  <div class="settings-container">
    <NCard title="应用设置" class="settings-card">
      <NForm>
        <NFormItem label="AI API 地址">
          <NInput v-model:value="apiUrl" placeholder="输入API地址" />
        </NFormItem>
        
        <NFormItem label="语音识别">
          <NSwitch v-model:value="voiceSettings.enabled" />
        </NFormItem>
        
        <NFormItem label="语音自动发送">
          <NSwitch v-model:value="voiceSettings.autoSend" :disabled="!voiceSettings.enabled" />
        </NFormItem>
        
        <NFormItem label="语音识别语言">
          <NSelect v-model:value="voiceSettings.language" :options="languageOptions" 
                  :disabled="!voiceSettings.enabled" />
        </NFormItem>
        
        <NSpace justify="end">
          <NButton type="primary" @click="saveSettings">保存设置</NButton>
        </NSpace>
      </NForm>
    </NCard>
    
    <NCard title="关于" class="about-card">
      <p>Voicer - 语音AI助手</p>
      <p>版本: 0.1.0</p>
      <p>使用Tauri和Vue构建</p>
    </NCard>
  </div>
</template>

<style scoped>
.settings-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}

.settings-card,
.about-card {
  margin-bottom: 16px;
  transition: all 0.3s ease;
}

.settings-card:hover,
.about-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .settings-container {
    padding: 8px;
  }
  
  :deep(.n-form-item-label) {
    padding-bottom: 4px;
  }
  
  :deep(.n-form-item) {
    margin-bottom: 12px;
  }
  
  :deep(.n-card-header) {
    padding: 12px 16px;
  }
  
  :deep(.n-card__content) {
    padding: 12px 16px;
  }
}
</style>