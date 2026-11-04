<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authApi } from '../services/api.js'
import { fetchUser } from "../services/auth.js";
import PasswordInput from '../components/PasswordInput.vue'
import { showToast } from '../utils/useToast.js'

const route = useRoute();
const router = useRouter();
const form = ref({emailOrUser: "", password: ""});
const message = ref('');

async function submit() {
  message.value = ''
  try {
    await authApi.login(form.value)
    await fetchUser()             
    showToast('Logged in successfully')
    // go back to the page they were trying to open (only paths inside our app)
    const redirect = route.query.redirect
    const goodRedirect = typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    router.push(goodRedirect ? redirect : '/home')
  } catch (err) {
    message.value = err.response
      ? (err.response.data?.message || 'Could not log in.')
      : 'Cannot reach the server.'
  }
}
</script>

<template>
  <div class="container" style="max-width: 420px">
  <div class="landing-bg" aria-hidden="true"></div>

    <h1 class="landing-title landing-title--form">Log In</h1>
    <p style="color:white;">We're excited to have you back.</p>

    <div v-if="message" class="alert alert-danger">
      <div> {{ message }} </div>
    </div>

    <form @submit.prevent="submit">
      <input v-model="form.emailOrUser" type="emailOrUser" class="form-control mb-3" placeholder="Email/Username" required />
      <PasswordInput v-model="form.password" placeholder="Password" autocomplete="current-password" class="mb-3" />
      <button class="btn w-100 mb-3 text-white" style="background-color:var(--accent-main);">Log In</button>
    </form>

    <span style="color:white;"> Don't have an account? </span>
    <router-link class="link-underline-opacity-100-hover" style="color:white;" to="/register">Create One</router-link>


  </div>
</template>