<script setup>
// TEMP until booking integration: lets a sitter start a test walk by pasting a route ID.
// Later, walks will be started from the walk task in a booking's visit instead.
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { walkApi } from '../services/walkApi.js'

const router = useRouter()
const routeId = ref('')
const creating = ref(false)
const createError = ref('')

async function createWalk() {
  const id = routeId.value.trim()
  if (!id) {
    createError.value = 'Paste a route ID.'
    return
  }

  creating.value = true
  createError.value = ''
  try {
    const walk = await walkApi.create({ routeId: id })
    router.push({ name: 'sitter-walk', params: { id: walk._id } })
  } catch (err) {
    createError.value = err.response?.data?.message ?? 'Could not create the walk. Please try again.'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="p-3 d-flex flex-column gap-3 start-page">
    <header>
      <h1 class="page-title mb-1">Start a test walk</h1>
      <p class="text-body-secondary mb-0">
        Temporary page for testing until walks are linked to bookings.
      </p>
    </header>

    <form class="info-card" @submit.prevent="createWalk">
      <label class="section-label form-label" for="route-id">Route ID</label>
      <input id="route-id" v-model="routeId" class="form-control mb-2" placeholder="e.g. 671c2f…" autocomplete="off" />
      <p class="small text-body-secondary mb-2">
        To find one: log in as the owner, open the browser console and run
        <code>(await (await fetch('/api/walk-routes')).json()).map(r =&gt; [r.name, r._id])</code>
      </p>
      <div v-if="createError" class="alert alert-danger py-2">{{ createError }}</div>
      <button type="submit" class="btn btn-primary" :disabled="creating">{{ creating ? 'Creating…' : 'Create walk' }}</button>
    </form>
  </div>
</template>

<style scoped>
/* PetSociety design system */
.start-page {
  max-width: 640px;
}
.page-title {
  font-size: 32px;
  font-weight: 700;
}
.info-card {
  background: #fff;
  border: 1px solid #ede3d8;
  border-radius: 10px;
  padding: 12px 16px;
}
.section-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--bs-secondary-color);
}
</style>
