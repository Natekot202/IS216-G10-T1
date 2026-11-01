<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { confirmState, answerConfirm } from '../utils/useConfirm.js'

const cancelBtn = ref(null)
const dialogEl = ref(null)
let previousFocus = null

function onKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    answerConfirm(false)
    return
  }
  if (e.key === 'Tab' && dialogEl.value) {
    const items = [...dialogEl.value.querySelectorAll('button')]
    if (items.length === 0) {
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    if (!dialogEl.value.contains(document.activeElement)) {
      e.preventDefault()
      first.focus()
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

watch(() => confirmState.open, async (open) => {
  if (open) {
    previousFocus = document.activeElement
    document.body.style.overflow = 'hidden'             
    window.addEventListener('keydown', onKeydown)
    await nextTick()
    cancelBtn.value?.focus()                         
  } else {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onKeydown)
    previousFocus?.focus?.()                          
    previousFocus = null
  }
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="cd">
      <div v-if="confirmState.open" class="cd-backdrop" @click.self="answerConfirm(false)">
        <div ref="dialogEl" class="cd-card" role="alertdialog" aria-modal="true"
             aria-labelledby="cd-title" :aria-describedby="confirmState.message ? 'cd-message' : undefined">
          <h2 id="cd-title" class="cd-title">{{ confirmState.title }}</h2>
          <p v-if="confirmState.message" id="cd-message" class="cd-message">{{ confirmState.message }}</p>

          <div class="cd-actions">
            <button ref="cancelBtn" type="button" class="cd-btn cd-btn--cancel" @click="answerConfirm(false)">
              {{ confirmState.cancelText }}
            </button>
            <button type="button" class="cd-btn" :class="confirmState.danger ? 'cd-btn--danger' : 'cd-btn--primary'"
                    @click="answerConfirm(true)">
              {{ confirmState.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;                
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(43, 36, 32, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.cd-card {
  width: 100%;
  max-width: 420px;
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  padding: 1.5rem;
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid #e6d3c0;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(43, 36, 32, 0.35);
}
.cd-title {
  margin: 0 0 0.5rem;
  font-size: 1.3rem;
  font-weight: 700;
  color: #2b2420;
}
.cd-message {
  margin: 0;
  color: #5c524b;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.cd-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.5rem;
}
.cd-btn {
  padding: 0.55rem 1.2rem;
  border: 1px solid transparent;
  border-radius: 10px;
  font-weight: 700;
  transition: background 0.2s, border-color 0.2s;
}
.cd-btn--cancel {
  border-color: #d9c3ad;
  background: #fff;
  color: #2b2420;
}
.cd-btn--cancel:hover {
  background: #f8eee3;
}
.cd-btn--primary {
  background: #a85a38;
  color: #fff;
}
.cd-btn--primary:hover {
  background: #8f4a2c;
}
.cd-btn--danger {
  background: #b3261e;
  color: #fff;
}
.cd-btn--danger:hover {
  background: #96201a;
}
.cd-btn:focus-visible {
  outline: 2px solid #c44f1c;
  outline-offset: 2px;
}

@media (max-width: 575.98px) {
  .cd-card {
    padding: 1.25rem;
  }
  .cd-actions {
    flex-direction: column-reverse;
  }
  .cd-btn {
    width: 100%;
    padding: 0.7rem 1rem;
  }
}

.cd-enter-active,
.cd-leave-active {
  transition: opacity 0.18s ease;
}
.cd-enter-active .cd-card,
.cd-leave-active .cd-card {
  transition: transform 0.18s ease;
}
.cd-enter-from,
.cd-leave-to {
  opacity: 0;
}
.cd-enter-from .cd-card,
.cd-leave-to .cd-card {
  transform: translateY(10px) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .cd-enter-active,
  .cd-leave-active,
  .cd-enter-active .cd-card,
  .cd-leave-active .cd-card {
    transition: none;
  }
}
</style>