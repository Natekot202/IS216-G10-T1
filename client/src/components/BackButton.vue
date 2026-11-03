<script setup>
import { useGoBack } from '../utils/backButton.js'

const props = defineProps({
  fallback: { type: [String, Object], default: undefined },
  label: { type: String, default: 'Back' }
})

const { goBack } = useGoBack(props.fallback)
</script>

<template>
  <button type="button" class="back-btn" @click="goBack">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    {{ label }}
  </button>
</template>

<style scoped>
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  padding: 0.25rem 0.75rem 0.25rem 0.4rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #5c524b;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.back-btn:hover {
  background: rgb(var(--accent-rgb) / 0.16);
  color: #2b2420;
}
.back-btn:focus-visible {
  outline: 2px solid var(--accent-deep);
  outline-offset: 2px;
}
</style>