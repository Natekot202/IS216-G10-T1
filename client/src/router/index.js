import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Pets from '../views/Pets.vue'
import GroupBookings from '../views/GroupBookings.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/pets', name: 'pets', component: Pets },
  { path: '/owner/bookings', name: 'bookings', component: GroupBookings},

]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
