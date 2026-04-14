import './assets/main.css'
import 'vue-sonner/style.css'

import { createApp } from 'vue'
import type { Plugin } from 'vue'

import App from './App.vue'
import { convexPlugin } from './lib/convex'
import router from './router'

const app = createApp(App)

app.use(router)
app.use(convexPlugin as unknown as Plugin)

app.mount('#app')
