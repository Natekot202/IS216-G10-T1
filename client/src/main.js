import { createApp } from 'vue'

// Bootstrap CSS + JS first, so our own styles (main.css and each component's <style>) load AFTER it and win
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './assets/main.css'

import App from './App.vue'
import router from './router'

createApp(App).use(router).mount('#app')