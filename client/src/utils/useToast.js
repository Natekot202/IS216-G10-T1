import { reactive } from 'vue'

export const toasts = reactive([])
let nextId = 0

export function showToast(message, { type = 'success', duration = 3500 } = {}) {
  const id = nextId++
  toasts.push({ id, message, type })
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration)
  }
  return id
}

export function dismissToast(id) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i !== -1) {
    toasts.splice(i, 1)
  }
}