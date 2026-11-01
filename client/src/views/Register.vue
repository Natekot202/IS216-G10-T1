<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authApi } from '../services/api.js'
import { fetchUser } from "../services/auth.js";
import PasswordInput from '../components/PasswordInput.vue'
import PasswordRules from '../components/PasswordRules.vue'
import { passwordIsValid } from '../utils/passwordChecks.js'

const route = useRoute();
const router = useRouter();

const errors = ref([]);
const startRole = ["owner", "sitter"].includes(route.query.role) ? route.query.role : "owner";
const form = ref({ username: "", email: "", password: "", confirmPassword: "", role: startRole });

const passwordOk = computed(() => passwordIsValid(form.value.password))

async function submit() {
  errors.value = []
  if (form.value.password !== form.value.confirmPassword) {
    errors.value = ["The two passwords don't match."]
    return
  }
  try {
    await authApi.register(form.value)
    await fetchUser()
    router.push('/home')
  } catch (err) {
    if (err.response) {
      errors.value = err.response.data?.errors || [err.response.data?.message || 'Could not register.']
    } else {
      errors.value = ['Cannot reach the server. Is it running?']
    }
  }
}
</script>

<template>
  <div class="container" style="max-width: 420px">
    <div class="landing-bg" aria-hidden="true"></div>

    <h1 class="landing-title landing-title--form">Create account</h1>

    <div v-if="errors.length" class="alert alert-danger" role="alert">
      <ul class="mb-0">
        <li v-for="e in errors" :key="e">{{ e }}</li>
      </ul>
    </div>

    <form @submit.prevent="submit">
      <div class="mb-3">
        <label class="form-label" style="color:white;">I am a</label>
        <select v-model="form.role" class="form-select">
          <option value="owner">Pet owner</option>
          <option value="sitter">Pet sitter</option>
        </select>
      </div>
      <input v-model="form.username" class="form-control mb-3" placeholder="Username" required />
      <input v-model="form.email" type="email" class="form-control mb-3" placeholder="Email" required />
      <PasswordInput v-model="form.password" placeholder="Password" autocomplete="new-password" />
      <PasswordRules :password="form.password" light />
      <PasswordInput v-model="form.confirmPassword" placeholder="Confirm password" autocomplete="new-password" class="mb-3" />

      <!-- <p style="color:white; margin-bottom:0;">Password Requirements:</p>
      <ul style="color:white; margin-bottom:5px;">
        <li>At least 8 characters</li>
        <li>At least 1 uppercase letter</li>
        <li>At least 1 special character (!@#$%^&*)</li>
      </ul> -->

      <button class="btn w-100 mb-3 text-white" style="background-color:#a85a38;" :disabled="!passwordOk">Sign up</button>
    </form>

    <span style="color:white;"> Already have an account? </span>
    <router-link class="link-underline-opacity-100-hover" style="color:white;" to="/login">Log In</router-link>

  </div>
</template>