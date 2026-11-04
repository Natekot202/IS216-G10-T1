<script setup>
import { toasts, dismissToast } from '../utils/useToast.js'
</script>

<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-host" aria-live="polite">
      <div v-for="t in toasts" :key="t.id" class="toast-card" :class="`toast-card--${t.type}`"
           :role="t.type === 'error' ? 'alert' : 'status'">
        <span class="toast-icon" aria-hidden="true">
          <svg v-if="t.type === 'success'" viewBox="0 0 24 24" width="18" height="18">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4"
                  stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18">
            <path d="M12 7v6M12 17v.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
          </svg>
        </span>
        <span class="toast-text">{{ t.message }}</span>
        <button type="button" class="toast-close" aria-label="Dismiss" @click="dismissToast(t.id)">✕</button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 0.75rem;
  left: 50%;
  z-index: 3000;                   
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  max-width: calc(100vw - 2rem); 
  transform: translateX(-50%);
  pointer-events: none;                
}

.toast-card {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: max-content;   
  max-width: min(560px, calc(100vw - 2rem));
  padding: 0.7rem 0.8rem 0.7rem 0.9rem;
  border: 1px solid rgb(var(--accent-rgb) / 0.3);
  border-left: 5px solid var(--toast-color);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(43, 36, 32, 0.22);
  pointer-events: auto;
  --toast-color: #4f8a3a;
}
.toast-card--info {
  --toast-color: var(--accent);
}
.toast-card--error {
  --toast-color: #b3261e;
}

.toast-icon {
  flex: none;
  width: 1.7rem;
  height: 1.7rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--toast-color);
  color: #fff;
}
.toast-text {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: #2b2420;
  overflow-wrap: anywhere;
}
.toast-close {
  flex: none;
  padding: 0.2rem 0.4rem;
  border: 0;
  background: none;
  color: #5c524b;
  cursor: pointer;
}
.toast-close:hover {
  color: #2b2420;
}
.toast-close:focus-visible {
  outline: 2px solid var(--accent-deep);
  outline-offset: 2px;
  border-radius: 6px;
}

.toast-enter-active,
.toast-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-140%);
}
.toast-move {
  transition: transform 0.3s ease;   
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-move {
    transition: opacity 0.2s ease;
  }
  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}
</style>