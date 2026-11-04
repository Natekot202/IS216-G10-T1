<script setup>

import NavBar from './components/NavBar.vue';
import { onMounted, watch } from "vue";
import { fetchUser, currentUser } from "./services/auth.js";
import { useRoute } from 'vue-router';
import ConfirmDialog from './components/ConfirmDialog.vue';
import { answerConfirm } from './utils/useConfirm.js';
import { resumeTracking, stopTracking } from './utils/sessionTracker.js';
import ToastHost from './components/ToastHost.vue'

const route = useRoute()

watch(() => route.fullPath, () => answerConfirm(false))
onMounted(fetchUser);
watch(() => currentUser.value?.role, (role) => {
  if (role) {
    document.documentElement.dataset.role = role
  } else {
    delete document.documentElement.dataset.role
  }
  // location tracking carries on across pages, so it belongs here. It only runs during a sitter's session.
  if (role === 'sitter') resumeTracking()
  else stopTracking()
}, { immediate: true })
</script>

<template>
    <NavBar />
      <!-- main view  -->
    <main class="container-fluid py-4">
      <router-view />
    </main>
    <ConfirmDialog />
    <ToastHost />

</template>
