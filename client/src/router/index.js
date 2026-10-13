import { createRouter, createWebHistory } from 'vue-router'
import { currentUser, fetchUser } from '../services/auth.js'
import Home from '../views/Home.vue'
import Pets from '../views/Pets.vue'
import LoginView from "../views/Login.vue";
import RegisterView from "../views/Register.vue";
import ProfileView from "../views/Profile.vue";
import OwnerHome from '../components/OwnerHome.vue'
import RolePicker from '../components/RolePicker.vue'

const routes = [
{ path: "/login", component: LoginView, meta : { hideElem: true } },
{ path: "/register", component: RegisterView, meta : { hideElem: true } },
{ path: '/', name: 'welcome', component: RolePicker, meta: { hideLinks: true } }, // landing page 
{ path: '/home', name: 'home', component: Home }, // logged in users
{ path: '/browse', component: OwnerHome }, // logged out users
{ path: '/pets', name: 'pets', component: Pets, meta: { role: 'owner' } },
{ path: '/profile', name: 'profile', component: ProfileView}
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  if (to.path === '/') {
    if (!currentUser.value) await fetchUser() 
    if (currentUser.value) return '/home'
  }
})

export default router
