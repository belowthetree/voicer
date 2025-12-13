<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAppStore } from '../stores'
import { useRemoteStore } from '../stores/remote-store'
import { 
  NModal, NForm, NFormItem, NInput, NInputNumber, NSwitch, NDivider, 
  NGrid, NGi, NSpace, NButton
} from 'naive-ui'

const store = useAppStore()
const remoteStore = useRemoteStore()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

// 远程连接配置
const remoteHost = ref('127.0.0.1')
const remotePort = ref(8080)
const useTools = ref(true)
const maxTokens = ref(2000)
const askBeforeToolExecution = ref(true)

// 监听props变化，更新本地状态
watch(() => props.show, (newVal) => {
  if (newVal) {
    // 从store加载当前配置
    remoteHost.value = remoteStore.config.host
    remotePort.value = remoteStore.config.port
    useTools.value = remoteStore.useTools
    maxTokens.value = remoteStore.requestConfig.max_tokens || 2000
    askBeforeToolExecution.value = remoteStore.requestConfig.ask_before_tool_execution ?? true
  }
})

// 保存远程配置
const saveRemoteConfig = () => {
  // 更新store配置
  remoteStore.updateConfig({
    host: remoteHost.value,
    port: remotePort.value
  })
  remoteStore.updateRequestConfig({
    max_tokens: maxTokens.value,
    ask_before_tool_execution: askBeforeToolExecution.value
  })
  remoteStore.updateUseTools(useTools.value)
  
  // 关闭模态框
  emit('update:show', false)
  
  // 如果已连接，重新连接
  if (store.isRemoteConnected) {
    store.disconnectFromRemote()
    setTimeout(() => {
      store.connectToRemote()
    }, 500)
  }
}

// 关闭模态框
const closeModal = () => {
  emit('update:show', false)
}
</script>

<template>
  <NModal 
    v-model:show="props.show" 
    preset="card" 
    title="远程服务器配置" 
    style="width: 500px"
    @update:show="closeModal"
  >
    <NForm label-placement="left" label-width="120px">
      <NGrid :cols="2" :x-gap="24">
        <NGi>
          <NFormItem label="服务器地址">
            <NInput v-model:value="remoteHost" placeholder="例如: 127.0.0.1" />
          </NFormItem>
        </NGi>
        <NGi>
          <NFormItem label="端口号">
            <NInputNumber v-model:value="remotePort" :min="1" :max="65535" />
          </NFormItem>
        </NGi>
      </NGrid>
      
      <NDivider />
      
      <NFormItem label="最大令牌数">
        <NInputNumber v-model:value="maxTokens" :min="100" :max="10000" :step="100">
          <template #suffix>
            令牌
          </template>
        </NInputNumber>
      </NFormItem>
      
      <NFormItem label="使用工具">
        <NSwitch v-model:value="useTools">
          <template #checked>
            启用
          </template>
          <template #unchecked>
            禁用
          </template>
        </NSwitch>
      </NFormItem>
      
      <NFormItem label="工具执行前询问">
        <NSwitch v-model:value="askBeforeToolExecution">
          <template #checked>
            是
          </template>
          <template #unchecked>
            否
          </template>
        </NSwitch>
      </NFormItem>
      
      <div class="form-actions">
        <NSpace justify="end">
          <NButton @click="closeModal">取消</NButton>
          <NButton type="primary" @click="saveRemoteConfig">保存并应用</NButton>
        </NSpace>
      </div>
    </NForm>
  </NModal>
</template>

<style scoped>
.form-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e5e5e5;
}
</style>
