<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { messageApi } from '../services/messageApi.js'

const props = defineProps({
  bookingId: { type: String, required: true },
  isSitter: { type: Boolean, default: false }
})

// How often an open chat checks for new messages
const CHECK_EVERY_MS = 3000

const open = ref(false)
const messages = ref([])
const draft = ref('')
const sending = ref(false)
const error = ref('')
const listEl = ref(null)
let timer = null

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

// The chat only checks every 3 seconds while it is open (and the tab is visible)
watch(open, (isOpen) => {
  clearInterval(timer)
  if (!isOpen) return
  load()
  scrollToBottom()
  timer = setInterval(() => {
    if (!document.hidden) load(true)
  }, CHECK_EVERY_MS)
})

// One check when the card appears, so the header can show how many messages there are
onMounted(() => load(true))
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <section class="sc-card">
    <button type="button" class="chat-toggle" :aria-expanded="open" @click="open = !open">
      <h4 class="sc-title mb-0">
        {{ isSitter ? 'Chat with owner' : 'Chat with sitter' }}
        <span v-if="messages.length" class="chat-count">{{ messages.length }}</span>
      </h4>
      <span aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </button>

    <div v-if="open" class="mt-3">
      <div v-if="error" class="alert alert-warning py-2 small">{{ error }}</div>

      <div ref="listEl" class="chat-list" aria-live="polite">
        <p v-if="!messages.length" class="text-muted small mb-0">
          No messages yet. Say hi to {{ isSitter ? 'the owner' : 'your sitter' }}.
        </p>

        <div v-for="m in messages" :key="m._id" class="chat-row" :class="m.mine ? 'chat-row--mine' : 'chat-row--theirs'">
          <div class="chat-bubble" :class="{ 'chat-bubble--mine': m.mine }">
            <span class="text-break">{{ m.text }}</span>
            <small class="chat-time">{{ m.mine ? '' : `${m.senderName}, ` }}{{ formatTime(m.createdAt) }}</small>
          </div>
        </div>
      </div>

      <form class="d-flex gap-2 mt-2" @submit.prevent="submit">
        <input v-model="draft" type="text" class="form-control" maxlength="500"
               placeholder="Write a message" aria-label="Message" />
        <button type="submit" class="btn btn-brand" :disabled="sending || !draft.trim()">Send</button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.chat-toggle {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  text-align: left;
}
.chat-count {
  margin-left: 0.4rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: #f1ece8;
  font-size: 0.75rem;
  font-weight: 600;
}

/* the message list scrolls inside the card */
.chat-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 18rem;
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
  background: #c44f1c;
  color: #fff;
}
.chat-time {
  align-self: flex-end;
  margin-top: 0.15rem;
  font-size: 0.7rem;
  opacity: 0.75;
}
</style>
