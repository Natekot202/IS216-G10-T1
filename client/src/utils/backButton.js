import { useRouter } from 'vue-router'
import { currentUser } from '../services/auth.js'

export function useGoBack(fallback) {
  const router = useRouter()

  function goBack() {
    if (window.history.state?.back) {
      router.back()
      return
    }
    if (fallback) {
      router.push(fallback)
    } else {
      router.push(currentUser.value ? '/home' : '/browse')
    }
  }

  return { goBack }
}