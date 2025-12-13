<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { NLayout, NLayoutHeader, NLayoutContent, NSpace, NButton, NIcon } from 'naive-ui'
import { ChatbubbleEllipses, Settings } from '@vicons/ionicons5'
</script>

<template>
  <NLayout class="layout">
    <NLayoutHeader class="header">
      <div class="logo">
        <img alt="Voicer logo" src="@/assets/logo.svg" width="32" height="32" />
        <h1>AI Assistant</h1>
      </div>
      
      <nav>
        <NSpace>
          <NButton quaternary circle>
            <template #icon>
              <NIcon>
                <RouterLink to="/" class="nav-icon">
                  <ChatbubbleEllipses />
                </RouterLink>
              </NIcon>
            </template>
          </NButton>
          
          <NButton quaternary circle>
            <template #icon>
              <NIcon>
                <RouterLink to="/about" class="nav-icon">
                  <Settings />
                </RouterLink>
              </NIcon>
            </template>
          </NButton>
        </NSpace>
      </nav>
    </NLayoutHeader>
    
    <NLayoutContent class="content">
      <RouterView />
    </NLayoutContent>
  </NLayout>
</template>

<style scoped>
.layout {
  height: 100vh;
  width: 100%;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  height: 60px;
  border-bottom: 1px solid #eee;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo h1 {
  font-size: 1.5rem;
  margin: 0;
}

.content {
  padding: 0;
  overflow: hidden;
  height: calc(100vh - 60px);
}

.nav-icon {
  display: flex;
  color: inherit;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .header {
    padding: 0 8px;
    height: 50px;
  }
  
  .logo h1 {
    font-size: 1.2rem;
  }
  
  .content {
    height: calc(100vh - 50px);
  }
}

</style>
