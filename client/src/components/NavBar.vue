<script setup>

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter  } from 'vue-router'
import { currentUser, logout } from "../services/auth.js";
import { unreadCount, startCheckingUnread, stopCheckingUnread } from '../utils/useNotificationBadge.js'
import NotificationIcon from './NotificationIcon.vue';

const route = useRoute()
const router = useRouter()

const hideElem = computed(() => route.meta.hideElem === true)
const searchLink = computed(() => (currentUser.value ? '/home' : '/browse'))
// icon and text are split so every icon sits in the same fixed-width column
const searchIcon = computed(() => (currentUser.value?.role === 'sitter' ? '🏠︎' : '🔍︎'))
const searchLabel = computed(() => (currentUser.value?.role === 'sitter' ? 'Home' : 'Search Sitters'))

// open = page menu from the left button (off-canvas below lg, dropdown at lg and up)
const open = ref(false);
// accountOpen = the small dropdown beside the avatar that holds Log out
const accountOpen = ref(false)

const menuEl = ref(null)
const menuBtnEl = ref(null)
const accountEl = ref(null)

watch(() => route.fullPath, () => {
  open.value = false;
  accountOpen.value = false
});

// Only the off-canvas locks page scroll; the desktop dropdown doesn't
watch(open, (isOpen) => {
  document.body.style.overflow = isOpen && window.innerWidth < 992 ? 'hidden' : ''
})

function toggleMenu() {
  open.value = !open.value
  accountOpen.value = false
}

function toggleAccount() {
  accountOpen.value = !accountOpen.value
  open.value = false
}

function onKey(e) {
  if (e.key === 'Escape') {
    open.value = false
    accountOpen.value = false
  }
}

// clicking anywhere outside a dropdown closes it
function onDocClick(e) {
  if (open.value && !menuEl.value?.contains(e.target) && !menuBtnEl.value?.contains(e.target)) {
    open.value = false
  }
  if (accountOpen.value && !accountEl.value?.contains(e.target)) {
    accountOpen.value = false
  }
}

// Crossing the lg breakpoint switches between off-canvas and dropdown, so close whichever was open
let wasDesktop = window.innerWidth >= 992
function onResize() {
  const isDesktop = window.innerWidth >= 992
  if (isDesktop !== wasDesktop) open.value = false
  wasDesktop = isDesktop
}

// Unread notifications badge: every logged-in user, checked every 10 seconds
watch(() => currentUser.value?.role, (role) => {
  if (role) startCheckingUnread()
  else stopCheckingUnread()
}, { immediate: true })


onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', onResize)
  document.addEventListener('click', onDocClick)
})


onBeforeUnmount(() => {
  stopCheckingUnread()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('click', onDocClick)
  document.body.style.overflow = ''
})

async function handleLogout() {
  open.value = false
  accountOpen.value = false
  await logout();
  router.push("/");
}

</script>

<template>
  <nav class="topbar navbar navbar-dark">
    <div class="container-fluid">
      <!-- page links open from this button on the left, at every width -->
      <button v-if="!hideElem" ref="menuBtnEl" class="nav-menu-btn" type="button" aria-label="Open menu"
              aria-haspopup="true" :aria-expanded="open" @click="toggleMenu">
        <span aria-hidden="true">☰</span>
        <span class="d-none d-sm-inline">Menu</span>
      </button>

      <router-link class="navbar-brand" to="/">
        PetSociety
      </router-link>
      <template v-if="!hideElem">
        <div v-if="open" class="nav-backdrop" @click="open = false">
        </div>

        <!-- below lg: off-canvas. lg and up: dropdown under the menu button -->
        <div ref="menuEl" class="nav-menu" :class="{ 'nav-menu--open': open }">
          <button type="button" class="btn-close btn-close-white d-lg-none ms-auto mb-3"
                  aria-label="Close menu" @click="open = false">
          </button>
          <ul class="navbar-nav">
            <li class="nav-item">
              <router-link class="nav-link" :to="searchLink">
                <span class="nav-icon" aria-hidden="true">{{ searchIcon }}</span>{{ searchLabel }}
              </router-link>
            </li>
            <li v-if="currentUser?.role === 'owner'" class="nav-item">
              <router-link class="nav-link" to="/owner/bookings"><span class="nav-icon" aria-hidden="true">🗒</span>My Bookings</router-link>
            </li>
            <li v-if="currentUser" class="nav-item">
              <router-link class="nav-link" to="/session"><span class="nav-icon" aria-hidden="true">𓃠</span>Session</router-link>
            </li>
            <li v-if="currentUser?.role === 'owner'" class="nav-item">
              <router-link class="nav-link" to="/owner/routes"><span class="nav-icon" aria-hidden="true">🏞</span>My Routes</router-link>
            </li>
            <!-- <li v-if="currentUser?.role === 'owner' && !hideElem" class="nav-item">
              <router-link class="nav-link d-flex align-items-center gap-1" to="/notifications"
                           :aria-label="unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'">
                🕭 Notifications
                <span v-if="unreadCount" class="badge rounded-pill bg-danger">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
              </router-link>
            </li> -->
            <li v-if="currentUser?.role === 'sitter' && !hideElem" class="nav-item">
              <router-link class="nav-link" to="/sitter/calendar"><span class="nav-icon" aria-hidden="true">𝄜</span>Calendar</router-link>
            </li>
            <li v-if="currentUser?.role === 'sitter'" class="nav-item">
              <router-link class="nav-link" to="/sitter/requests"><span class="nav-icon" aria-hidden="true">✉︎</span>Booking Requests</router-link>
            </li>
            <li v-if="currentUser?.role === 'sitter'" class="nav-item">
              <router-link class="nav-link" to="/sitter/transactions"><span class="nav-icon" aria-hidden="true">⛁</span>Transactions</router-link>
            </li>
          </ul>
        </div>

        <div class="nav-action">
          <!-- Bell: visible at every width -->
          <NotificationIcon v-if="currentUser" :count="unreadCount" />

          <!-- one button (avatar + name + caret) opens a dropdown with Profile and Log out -->
          <div v-if="currentUser" ref="accountEl" class="nav-account">
            <button type="button" class="nav-user nav-user--toggle" aria-label="Account menu" aria-haspopup="true"
                    :aria-expanded="accountOpen" @click="toggleAccount">
              <span class="nav-user__avatar" aria-hidden="true">
                <img v-if="currentUser.profilePicture?.url" :src="currentUser.profilePicture.url" alt="" />
                <template v-else>{{ currentUser.username.charAt(0).toUpperCase() }}</template>
              </span>
              <!-- hidden under 560px, cut short up to 899px, in full from 900px (main.css) -->
              <span class="nav-user__name">{{ currentUser.username }}</span>
              <span class="nav-user__caret" aria-hidden="true">▾</span>
            </button>
            <div v-if="accountOpen" class="nav-account-menu">
              <!-- phones only: the name, since the button shows just the avatar there -->
              <div class="nav-account-menu__name">{{ currentUser.username }}</div>
              <router-link to="/profile" class="nav-link">
                <span class="nav-icon" aria-hidden="true">☺︎</span>Profile
              </router-link>
              <button type="button" class="nav-link" @click="handleLogout">
                <span class="nav-icon" aria-hidden="true">↪</span>Log out
              </button>
            </div>
          </div>

          <router-link v-if="!currentUser" class="btn nav-btn" to="/login">Log in</router-link>
        </div>
      </template>
    </div>
  </nav>

</template>
