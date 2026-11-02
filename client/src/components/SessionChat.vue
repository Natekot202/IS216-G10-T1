<script setup>
// The chat between a booking's owner and sitter: an icon with an unread count, which opens a small window
// (a large sheet on phones). The card stays on the page while hidden, so messages keep being checked.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { messageApi } from '../services/messageApi.js'

const props = defineProps({
  bookingId: { type: String, required: true },
  isSitter: { type: Boolean, default: false },
  canSend: { type: Boolean, default: true }, // false once the booking is over: old messages can still be read
  active: { type: Boolean, default: true }   // false while another session is showing
})
const emit = defineEmits(['unread'])

// How often an open chat checks for new messages
const CHECK_EVERY_MS = 3000
// How often a closed chat checks, so the unread count shows without a refresh
const CHECK_CLOSED_EVERY_MS = 10000

// This browser remembers the time of the last message read. A booking has one owner and one sitter,
// so the booking and the role are enough to keep the two people apart on a shared computer.
const READ_KEY = `chat-read-${props.bookingId}-${props.isSitter ? 'sitter' : 'owner'}`
const lastRead = ref(localStorage.getItem(READ_KEY) || '')

const open = ref(false)
const messages = ref([])
const draft = ref('')
const sending = ref(false)
const error = ref('')
const listEl = ref(null)
let timer = null

const title = computed(() => (props.isSitter ? 'Chat with owner' : 'Chat with sitter'))

// Messages from the other person that came after the last one read (an open chat has none)
const unreadCount = computed(() => {
  if (open.value) return 0
  return messages.value.filter((m) => !m.mine && m.createdAt > lastRead.value).length
})
// tells the page, so the session list can show a dot on sessions that aren't showing
watch(unreadCount, (n) => emit('unread', n), { immediate: true })

// Counts everything loaded so far as read
function markRead() {
  const last = messages.value[messages.value.length - 1]
  if (!last || last.createdAt === lastRead.value) return
  lastRead.value = last.createdAt
  localStorage.setItem(READ_KEY, last.createdAt)
}

function scrollToBottom() {
  nextTick(() => {
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  })
}

// Adds only the messages we don't have yet (a message can arrive from both a check and our own send)
function addMessages(list) {
  const known = new Set(messages.value.map((m) => m._id))
  const fresh = list.filter((m) => !known.has(m._id))
  if (fresh.length) {
    messages.value.push(...fresh)
    scrollToBottom()
    if (open.value) markRead()
  }
}

// Asks the server for messages newer than the last one we have
async function load(quiet = false) {
  try {
    const last = messages.value[messages.value.length - 1]
    addMessages(await messageApi.getMessages(props.bookingId, last?.createdAt))
    error.value = ''
  } catch (err) {
    if (!quiet) error.value = err.response?.data?.message || 'Could not load the messages.'
  }
}

async function sendMessage(text) {
  if (!text || sending.value) return false
  sending.value = true
  try {
    addMessages([await messageApi.send(props.bookingId, text)])
    error.value = ''
    return true
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not send your message.'
    return false
  } finally {
    sending.value = false
  }
}

async function submit() {
  if (await sendMessage(draft.value.trim())) draft.value = ''
}

// "3:42 pm"
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })
}

// The chat checks every 3 seconds while it is open and every 10 seconds while it is closed (only when the tab is visible)
function startChecking() {
  clearInterval(timer)
  timer = setInterval(() => {
    if (!document.hidden) load(true)
  }, open.value ? CHECK_EVERY_MS : CHECK_CLOSED_EVERY_MS)
}

watch(open, (isOpen) => {
  startChecking()
  if (!isOpen) return
  markRead()
  load()
  scrollToBottom()
})

// switching to another session closes this one's chat
watch(() => props.active, (isActive) => {
  if (!isActive) open.value = false
})

// One check when the card appears, so the icon can show the unread count
onMounted(() => {
  load(true)
  startChecking()
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="chat" @keydown.esc="open = false">
    <button type="button" class="chat-btn" :aria-expanded="open"
            :aria-label="unreadCount ? `${title}, ${unreadCount} new` : title" @click="open = !open">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M4 5h16v11H9l-5 4V5z" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span v-if="unreadCount" class="chat-badge">{{ unreadCount }}</span>
    </button>

    <div v-if="open" class="chat-window" role="dialog" :aria-label="title">
      <div class="chat-head">
        <strong>{{ title }}</strong>
        <button type="button" class="btn-close" aria-label="Close chat" @click="open = false"></button>
      </div>

      <div v-if="error" class="alert alert-warning py-2 small mb-2">{{ error }}</div>

      <div ref="listEl" class="chat-list" aria-live="polite">
        <p v-if="!messages.length" class="text-muted small mb-0">
          No messages yet.<template v-if="canSend"> Say hi to {{ isSitter ? 'the owner' : 'your sitter' }}.</template>
        </p>

        <div v-for="m in messages" :key="m._id" class="chat-row" :class="m.mine ? 'chat-row--mine' : 'chat-row--theirs'">
          <div class="chat-bubble" :class="{ 'chat-bubble--mine': m.mine }">
            <span class="text-break">{{ m.text }}</span>
            <small class="chat-time">{{ m.mine ? '' : `${m.senderName}, ` }}{{ formatTime(m.createdAt) }}</small>
          </div>
        </div>
      </div>

      <form v-if="canSend" class="d-flex gap-2 mt-2" @submit.prevent="submit">
        <input v-model="draft" type="text" class="form-control" maxlength="500"
               placeholder="Write a message" aria-label="Message" />
        <button type="submit" class="btn btn-brand" :disabled="sending || !draft.trim()">Send</button>
      </form>
      <p v-else class="text-muted small mt-2 mb-0">This booking has ended, so messages can't be sent.</p>
    </div>
  </div>
</template>

<style scoped>
.chat-btn {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 10px;
  background: none;
  color: inherit;
}
.chat-badge {
  position: absolute;
  top: -0.45rem;
  right: -0.45rem;
  min-width: 1.3rem;
  padding: 0 0.3rem;
  border: 2px solid #fff;
  border-radius: 999px;
  background: var(--accent-deep);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.1rem;
}

/* a small window in the corner on computers */
.chat-window {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 1045;
  display: flex;
  width: 22rem;
  max-height: 30rem;
  flex-direction: column;
  padding: 0.9rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(43, 36, 32, 0.22);
  color: #2b2420;
}
.chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}
.chat-list {
  display: flex;
  min-height: 8rem;
  flex: 1;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  padding: 0.25rem;
}
.chat-row {
  display: flex;
}
.chat-row--mine {
  justify-content: flex-end;
}
.chat-bubble {
  display: flex;
  max-width: 80%;
  flex-direction: column;
  padding: 0.45rem 0.75rem;
  border-radius: 14px;
  background: #f1ece8;
  color: #2b2420;
}
.chat-bubble--mine {
  background: var(--accent-deep);
  color: #fff;
}
.chat-time {
  align-self: flex-end;
  margin-top: 0.15rem;
  font-size: 0.7rem;
  opacity: 0.75;
}

/* a shorter sheet that comes up from the bottom on phones (about 60% of the screen) */
@media (max-width: 767.98px) {
  .chat-window {
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
    width: auto;
    height: 60vh;
    max-height: none;
    border-radius: 16px 16px 0 0;
  }
}
</style>
