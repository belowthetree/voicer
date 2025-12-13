<script setup lang="ts">
import SettingsPanel from '../components/SettingsPanel.vue'
</script>

<template>
  <div class="about">
    <h1>设置</h1>
    <SettingsPanel />
  </div>
</template>

<style>
.about {
  min-height: 100vh;
  padding: 16px;
}

@media (min-width: 1024px) {
  .about {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  h1 {
    margin-bottom: 24px;
  }
}
</style>
