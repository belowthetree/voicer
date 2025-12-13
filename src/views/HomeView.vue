<script setup lang="ts">
import ChatInterface from '../components/ChatInterface.vue'
</script>

<template>
  <main class="home-container">
    <ChatInterface />
  </main>
</template>

<style scoped>
.home-container {
  height: 100vh;
  padding: 0;
  display: flex;
  flex-direction: column;
}
</style>
