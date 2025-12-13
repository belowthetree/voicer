import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'

// 导入Naive UI
import naive from 'naive-ui'

const app = createApp(App)
const pinia = createPinia()

app.use(router)
app.use(pinia)
app.use(naive)

app.mount('#app')
