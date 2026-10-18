import { ref, onBeforeUnmount } from 'vue'

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 2 * 1024 * 1024

export function usePhotoPicker() {
  const file = ref(null)
  const preview = ref('')
  const error = ref('')
  const input = ref(null)   

  function onPick(e) {
    const picked = e.target.files[0]
    error.value = ''
    if (!picked) {
      return
    }
    if (!ALLOWED.includes(picked.type)) {
      error.value = 'Please choose a JPG, PNG or WebP image.'
      e.target.value = ''
      return
    }
    if (picked.size > MAX_BYTES) {
      error.value = 'Image must be under 2 MB.'
      e.target.value = ''
      return
    }
    file.value = picked
    if (preview.value) {
      URL.revokeObjectURL(preview.value)
    }
    preview.value = URL.createObjectURL(picked)
  }

  function clear() {
    if (preview.value) {
      URL.revokeObjectURL(preview.value)
    }
    file.value = null
    preview.value = ''
    error.value = ''
    if (input.value) {
      input.value.value = ''
    }
  }

  onBeforeUnmount(() => {
    if (preview.value) {
      URL.revokeObjectURL(preview.value)
    }
  })

  return { file, preview, error, input, onPick, clear }
}