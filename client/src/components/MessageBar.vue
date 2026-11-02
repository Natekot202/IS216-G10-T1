<script setup>
// Slim message bar for the result of an action (withdraw, cancel, decline, confirm).
// type 'success' uses the theme colours, 'error' is red. The ✕ tells the page to hide it.
defineProps({
  type: { type: String, default: 'success' } // 'success' or 'error'
})

defineEmits(['close'])
</script>

<template>
  <div class="msg-bar" :class="`msg-bar--${type}`" :role="type === 'error' ? 'alert' : 'status'">
    <span class="msg-bar__icon" aria-hidden="true">{{ type === 'error' ? '!' : '✓' }}</span>
    <span class="msg-bar__text"><slot></slot></span>
    <button type="button" class="msg-bar__close" aria-label="Dismiss message" @click="$emit('close')">✕</button>
  </div>
</template>

<style scoped>
.msg-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--tint-soft);
  color: #2b2420;
  font-size: 0.92rem;
  font-weight: 600;
}
.msg-bar--error {
  border-color: #f1b8b4;
  background: #fdecea;
  color: #8c1d18;
}
.msg-bar__icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: var(--accent-deep);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
}
.msg-bar--error .msg-bar__icon {
  background: #b3261e;
}
.msg-bar__text {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}
.msg-bar__close {
  flex: 0 0 auto;
  padding: 0 0.25rem;
  border: 0;
  background: none;
  color: inherit;
  opacity: 0.7;
}
.msg-bar__close:hover {
  opacity: 1;
}
</style>
