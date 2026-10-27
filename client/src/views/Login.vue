<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { authApi } from '../services/api.js'
import { currentUser } from "../services/auth.js";
import { fetchUser } from "../services/auth.js";

const router = useRouter();
const form = ref({emailOrUser: "", password: ""});
const message = ref('');

async function submit() {
  message.value = ''
  try {
    await authApi.login(form.value)
    await fetchUser()             
    router.push('/home')
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
      <input v-model="form.password" type="password" class="form-control mb-3" placeholder="Password" required />
      <button class="btn w-100 mb-3 text-white" style="background-color:#c47756;">Log In</button>
    </form>

    <span style="color:white;"> Don't have an account? </span>
    <router-link class="link-underline-opacity-100-hover" style="color:white;" to="/register">Create One</router-link>


  </div>
</template>