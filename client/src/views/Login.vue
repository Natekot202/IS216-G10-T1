<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { API } from "../services/api.js";
import { currentUser } from "../services/auth.js";
import { fetchUser } from "../services/auth.js";

const router = useRouter();
const form = ref({emailOrUser: "", password: ""});
const message = ref('');

async function submit() {
  message.value = "";
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form.value)
    });
    const data = await res.json();
    if (!res.ok) {
      message.value = data.message;
      return;
    }
    currentUser.value = data;
    await fetchUser();  
    router.push("/");
  } catch (err) {
    console.error(err); 
    message.value = "Cannot reach the server.";
  }
}
</script>

<template>
  <div class="container" style="max-width: 420px">
    <h1 class="h3 mt-4">Log In</h1>
    <p>We're excited to have you back.</p>

    <div v-if="message" class="alert alert-danger">
      <div> {{ message }} </div>
    </div>

    <form @submit.prevent="submit">
      <input v-model="form.emailOrUser" type="emailOrUser" class="form-control mb-3" placeholder="Email/Username" required />
      <input v-model="form.password" type="password" class="form-control mb-3" placeholder="Password" required />
      <button class="btn w-100 mb-3 text-white" style="background-color:#c47756;">Log In</button>
    </form>

    <span> Don't have an account? </span>
    <router-link class="link-primary link-underline-opacity-100-hover" to="/register">Create One</router-link>


  </div>
</template>