import { createApp } from 'vue'

// Bootstrap CSS + JS first, so our own styles (main.css and each component's <style>) load AFTER it and win
import 'bootstrap/dist/css/bootstrap.min.css'
// the same Bootstrap copy that SitterCalendar.vue imports Popover from. Loading the bundle as well gave the page
// two Bootstraps, so the phone filter sheet opened two dark backdrops and one stayed after closing
import 'bootstrap'
import './assets/main.css'

import App from './App.vue'
import router from './router'

createApp(App).use(router).mount('#app')