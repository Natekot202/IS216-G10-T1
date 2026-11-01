import { reactive } from 'vue'

export const confirmState = reactive({
  open: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  danger: false
})

let resolver = null

export function confirmDialog(options = {}) {
  if (resolver) {
    resolver(false)                   
  }
  confirmState.title = options.title ?? 'Are you sure?'
  confirmState.message = options.message ?? ''
  confirmState.confirmText = options.confirmText ?? 'Confirm'
  confirmState.cancelText = options.cancelText ?? 'Cancel'
  confirmState.danger = options.danger ?? false
  confirmState.open = true
  return new Promise((resolve) => {
    resolver = resolve
  })
}

export function answerConfirm(result) {
  confirmState.open = false
  if (resolver) {
    resolver(result)
    resolver = null
  }
}