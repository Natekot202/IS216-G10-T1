import { createRouter, createWebHistory } from 'vue-router'
import LoginView from "../views/Login.vue";
import RegisterView from "../views/Register.vue";
import Home from '../views/Home.vue'
import ProfileView from "../views/Profile.vue";
import Pets from '../views/Pets.vue';
import MyBookings from '../views/MyBookings.vue'
import GroupBookings from '../views/GroupBookings.vue';


const routes = [
{ path: "/login", component: LoginView, meta : { hideElem: true } },
{ path: "/register", component: RegisterView, meta : { hideElem: true } },
{ path: '/', name: 'home', component: Home },
{ path: '/pets', name: 'pets', component: Pets, meta: { role: 'owner' } },
{ path: '/profile', name: 'profile', component: ProfileView},
{ path: '/owner/bookings', component: MyBookings },
{ path: '/owner/bookings/group/:groupId', component: GroupBookings },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
