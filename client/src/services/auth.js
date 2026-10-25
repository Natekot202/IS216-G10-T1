import { ref } from "vue";
import { authApi } from './api.js'

export const currentUser = ref(null); 

export async function fetchUser() {
  try {
    currentUser.value = await authApi.me()
  } catch {
    currentUser.value = null          // a 401 means nobody is logged in
  }
}

export async function logout() {
  try {
    await authApi.logout()
  } finally {
    currentUser.value = null
  }
}