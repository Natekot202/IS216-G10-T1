<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { notificationApi } from '../services/notificationApi.js'
import { unreadCount, refreshUnreadCount } from '../utils/useNotificationBadge.js'

// How often the open page checks for new notifications
const CHECK_EVERY_MS = 10000

const notifications = ref([])
const loading = ref(true)
const loadError = ref('')
const actionError = ref('')
let timer = null

const hasUnread = computed(() => notifications.value.some((n) => !n.read))

// Short label and colour for each kind of notification
const TYPE_LABELS = {
  'walk-off-route': { text: 'Off route', badge: 'text-bg-danger' },
  'walk-back-on-route': { text: 'Back on route', badge: 'text-bg-success' },
  'walk-ended-early': { text: 'Ended early', badge: 'text-bg-warning' }
}
const typeLabel = (type) => TYPE_LABELS[type] ?? { text: 'Notice', badge: 'text-bg-secondary' }

// "3:42 pm" for today, otherwise "26 Oct, 3:42 pm"
function formatTime(iso) {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })
  const isToday = date.toDateString() === new Date().toDateString()
  return isToday ? time : `${date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}, ${time}`
}

async function loadNotifications() {
  try {
    notifications.value = await notificationApi.getMine()
    loadError.value = ''
  } catch (err) {
    loadError.value = err.response?.data?.message ?? 'Could not load your notifications.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadNotifications()
  timer = setInterval(loadNotifications, CHECK_EVERY_MS)   // new alerts appear while the page is open
})

onBeforeUnmount(() => clearInterval(timer))

// Clicking an unread notification marks it as read
async function markRead(notification) {
  if (notification.read) return
  actionError.value = ''
  try {
    await notificationApi.markRead(notification._id)
    notification.read = true
    refreshUnreadCount()   // update the navbar badge straight away
  } catch (err) {
    actionError.value = err.response?.data?.message ?? 'Could not mark it as read.'
  }
}

async function markAllRead() {
  actionError.value = ''
  try {
    await notificationApi.markAllRead()
    notifications.value.forEach((n) => { n.read = true })
    unreadCount.value = 0
  } catch (err) {
    actionError.value = err.response?.data?.message ?? 'Could not mark them as read.'
  }
}
</script>

<template>
  <div class="noti p-3 d-flex flex-column gap-3">
    <header class="d-flex flex-wrap align-items-end gap-2">
      <div>
        <h1 class="page-title mb-1">Notifications</h1>
        <p class="text-body-secondary mb-0">Alerts about your pets' walks. New ones appear automatically.</p>
      </div>
      <button class="btn btn-link text-secondary ms-auto p-0" :disabled="!hasUnread" @click="markAllRead">
        Mark all as read
      </button>
    </header>

    <p v-if="loading" class="text-body-secondary mb-0">Loading notifications…</p>
    <div v-else-if="loadError" class="alert alert-danger mb-0">{{ loadError }}</div>
    <div v-else-if="notifications.length === 0" class="info-card text-body-secondary">No notifications yet.</div>

    <template v-else>
      <div v-if="actionError" class="alert alert-danger py-2 mb-0">{{ actionError }}</div>

      <ul class="list-unstyled d-flex flex-column gap-2 mb-0">
        <li
          v-for="n in notifications"
          :key="n._id"
          class="info-card notification"
          :class="{ unread: !n.read }"
          @click="markRead(n)"
        >
          <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span class="badge rounded-pill" :class="typeLabel(n.type).badge">{{ typeLabel(n.type).text }}</span>
            <span class="small text-body-secondary ms-auto">{{ formatTime(n.createdAt) }}</span>
          </div>
          <p class="mb-0" :class="{ 'fw-semibold': !n.read }">{{ n.message }}</p>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
/* PetSociety design system */
/* .notifications-page {
  max-width: 760px;
} */
.page-title {
  font-size: 32px;
  font-weight: 700;
}
.info-card {
  background: #fff;
  border: 1px solid #ede3d8;
  border-radius: 10px;
  padding: 12px 16px;
}
.notification.unread {
  border-left: 4px solid #e8692c;   /* coral marker for unread */
  cursor: pointer;
}
</style>
