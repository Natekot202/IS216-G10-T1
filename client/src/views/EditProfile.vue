<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { currentUser } from '../services/auth.js'
import { usersApi } from '../services/api.js'

const router = useRouter()

const pet_types = ["Dog", "Cat", "Bird", "Rabbit", "Hamster"];
const services = ["Feeding", "Dog walking", "Cat walking", "Feeding Medication"]

const isOwner = computed(() => currentUser.value?.role === 'owner')
const isSitter = computed(() => currentUser.value?.role === 'sitter')

const me = currentUser.value
const sp = me?.sitterProfile || {}
const addr = me?.ownerProfile?.address || {}

const form = ref({
  username: me?.username || '',
  bio: me?.bio || '',
  address: { line1: addr.line1 || '', postalCode: addr.postalCode || '' },
  sitterProfile: {
    petsittingRates: sp.petsittingRates ?? '',
    experienceStart: sp.experienceStart ? sp.experienceStart.slice(0, 7) : '', 
    serviceArea: sp.serviceArea?.label || '',
    petTypes: [...(sp.petTypes || [])],
    services: [...(sp.services || [])]
  }
})

const error = ref('')
const saving = ref(false)

async function save() {
  error.value = ''
  saving.value = true
  try {
    // send only what belongs to this user's role
    const payload = { username: form.value.username, bio: form.value.bio }
    if (isOwner.value) {
        payload.address = { ...form.value.address }
    }
    if (isSitter.value) {
        payload.sitterProfile = form.value.sitterProfile
    }
    const updated = await usersApi.updateMe(payload)
    currentUser.value = updated
    router.push('/profile')
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not save changes.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="container mt-4 mb-5" style="max-width: 560px">
    <h3 class="border-bottom pb-2 mb-3">Edit Details</h3>

    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <form @submit.prevent="save">
      <!-- both roles -->
      <label class="form-label">Username</label>
      <input v-model="form.username" class="form-control mb-3" required />

      <label class="form-label">Bio</label>
      <textarea v-model="form.bio" class="form-control" rows="4" maxlength="500"
                placeholder="Tell us more about yourself!"></textarea>
      <div class="text-muted small text-end mb-3">{{ form.bio.length }}/500</div>

      <!-- owners only -->
      <template v-if="isOwner">
        <label class="form-label">Address</label>
        <input v-model="form.address.line1" class="form-control mb-2" placeholder="Block, street, unit" />

        <label class="form-label">Postal code</label>
        <input v-model="form.address.postalCode" class="form-control mb-1"
                inputmode="numeric" maxlength="6" pattern="\d{6}" placeholder="6 digits" />
        <div class="form-text mb-3">Private. It isn't shown on your public profile.</div>
      </template>

      <!-- sitters only -->
      <template v-if="isSitter">
        <h5 class="border-bottom pb-1 mt-4 mb-3">Sitter details</h5>

        <label class="form-label">Rate (per hour)</label>
        <div class="input-group mb-3">
          <span class="input-group-text">S$</span>
          <input v-model="form.sitterProfile.petsittingRates" type="number" min="0" step="0.5" class="form-control" />
        </div>

        <label class="form-label">Sitting since</label>
        <input v-model="form.sitterProfile.experienceStart" type="month" class="form-control mb-1" />
        <div class="form-text mb-3">Your years of experience are worked out from this.</div>

        <label class="form-label">Service area</label>
        <input v-model="form.sitterProfile.serviceArea" class="form-control mb-3" placeholder="e.g. Tampines" />

        <div class="mb-3">
          <div class="form-label">I look after</div>
          <div v-for="t in pet_types" :key="t" class="form-check form-check-inline">
            <input class="form-check-input" type="checkbox" :id="`pt-${t}`"
                   :value="t" v-model="form.sitterProfile.petTypes" />
            <label class="form-check-label" :for="`pt-${t}`">{{ t }}</label>
          </div>
        </div>

        <div class="mb-4">
          <div class="form-label">Services</div>
          <div v-for="s in services" :key="s" class="form-check">
            <input class="form-check-input" type="checkbox" :id="`sv-${s}`"
                   :value="s" v-model="form.sitterProfile.services" />
            <label class="form-check-label" :for="`sv-${s}`">{{ s }}</label>
          </div>
        </div>
      </template>

      <button type="submit" class="btn text-white" style="background-color:#c47756;" :disabled="saving">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
      <router-link class="btn btn-link" to="/profile">Cancel</router-link>
    </form>
  </div>
</template>