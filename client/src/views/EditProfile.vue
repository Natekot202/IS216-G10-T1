<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { currentUser } from '../services/auth.js'
import { usersApi } from '../services/api.js'
import defaultAvatar from '../assets/img/tempProfile.jpg'
import { usePhotoPicker } from '../utils/usePhotoPicker.js'
import LocationQuery from '../components/LocationQuery.vue'
import { useLocationSearch } from '../utils/useLocationSearch.js'

const router = useRouter()

const pet_types = ["Dog", "Cat", "Bird", "Rabbit", "Hamster", "Other"];
const services = ["Feeding", "Dog walking", "Cat walking", "Feeding Medication"]

const isOwner = computed(() => currentUser.value?.role === 'owner')
const isSitter = computed(() => currentUser.value?.role === 'sitter')

const { file: picFile, preview, error: picError, input: fileInput, onPick, clear: clearSelection } = usePhotoPicker()
const uploading = ref(false)
const removing = ref(false)

async function uploadPicture() {
  if (!picFile.value) {
    return
  }
  uploading.value = true
  picError.value = ''
  try {
    const data = new FormData()
    data.append('photo', picFile.value)
    currentUser.value = await usersApi.updatePicture(data)
    clearSelection()
  } catch (err) {
    picError.value = err.response?.data?.message || 'Could not upload picture.'
  } finally {
    uploading.value = false
  }
}

async function removePicture() {
  if (!confirm('Remove your profile picture?')) {
    return
  }
  removing.value = true
  picError.value = ''
  try {
    currentUser.value = await usersApi.removePicture()
    clearSelection()
  } catch (err) {
    picError.value = err.response?.data?.message || 'Could not remove picture.'
  } finally {
    removing.value = false
  }
}

// location
const { locationQuery, locationSuggestions, selected: place, onLocationInput, selectLocation } =
  useLocationSearch({ addressesOnly: true })
const unit = ref('')

function toTitleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

// form
const form = ref({
  username: '',
  bio: '',
  sitterProfile: {
    petsittingRates: '',
    experienceStart: '',
    serviceArea: '',
    petTypes: [],
    services: []
  }
})

let filled = false
let hadAddress = false 

function fillForm(user) {
  const sp = user.sitterProfile || {}
  const addr = user.ownerProfile?.address || {}
  form.value = {
    username: user.username || '',
    bio: user.bio || '',
    sitterProfile: {
      petsittingRates: sp.petsittingRates ?? '',
      experienceStart: sp.experienceStart ? sp.experienceStart.slice(0, 7) : '',
      serviceArea: sp.serviceArea?.label || '',
      petTypes: [...(sp.petTypes || [])],
      services: [...(sp.services || [])]
    }
  }

  const saved = user.role === 'sitter' ? user.sitterProfile?.address : user.ownerProfile?.address
  const coords = saved?.location?.coordinates
  if (saved?.postalCode && coords?.length === 2) {
    place.value = {
      label: `${saved.line1} SINGAPORE ${saved.postalCode}`,
      line1: saved.line1,
      road: '',
      postalCode: saved.postalCode,
      lat: coords[1],
      lng: coords[0]
    }
    locationQuery.value = place.value.label
    hadAddress = true
  }
  unit.value = saved?.unit || ''
}


function onPlacePick(s) {
  selectLocation(s)
  const name = place.value?.road || place.value?.line1
  if (isSitter.value && name) {
    form.value.sitterProfile.serviceArea = toTitleCase(name)
  }
}

watch(currentUser, (user) => {
  if (user && !filled) {
    fillForm(user)
    filled = true
  }
}, { immediate: true })

const error = ref('')
const saving = ref(false)

async function save() {
  error.value = ''
  saving.value = true
  try {
    const payload = { username: form.value.username, bio: form.value.bio }
    if (place.value) {
      payload.address = {
        line1: place.value.line1,
        postalCode: place.value.postalCode,
        lat: place.value.lat,
        lng: place.value.lng,
        unit: isOwner.value ? unit.value : ''
      }
    } else if (hadAddress && locationQuery.value.trim() === '') {
      payload.address = null      
    }

    if (isSitter.value) {
      payload.sitterProfile = { ...form.value.sitterProfile }
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
  <div v-if="currentUser" class="mx-auto mt-4 mb-5 px-2" style="max-width: 1000px">
    <h3 class="border-bottom pb-2 mb-3">Edit Details</h3>

    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <form @submit.prevent="save">
      <div class="row g-4">
        <div class="col-12 col-md-6">
          <div class="mb-4">
            <img :src="preview || currentUser?.profilePicture?.url || defaultAvatar" alt="Profile picture"
                class="rounded mb-2" style="width: 220px; height: 220px; object-fit: cover;" />
            <div v-if="picError" class="alert alert-warning py-1">{{ picError }}</div>
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp"
            class="form-control mb-2" @change="onPick" />
            <button type="button" class="btn btn-sm text-white me-2" style="background-color:#c47756;"
                    :disabled="!picFile || uploading" @click="uploadPicture">
                    <span v-if="uploading" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                    {{ uploading ? 'Uploading…' : 'Upload picture' }}
            </button>
            <!-- to remove a chosen file -->
            <button v-if="picFile" type="button" class="btn btn-sm btn-outline-secondary me-2"
                    @click="clearSelection">
              Clear selection
            </button>
            <button v-if="currentUser?.profilePicture?.url && !picFile" type="button"
                    class="btn btn-sm btn-outline-danger" :disabled="removing" @click="removePicture">
                    <span v-if="removing" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
                    {{ removing ? 'Removing…' : 'Remove picture' }}
            </button>
            </div>
          <!-- <form @submit.prevent="save"> -->
            <!-- both roles -->
            <label class="form-label">Username</label>
            <input v-model="form.username" class="form-control mb-3" required />

            <label class="form-label">Bio</label>
            <textarea v-model="form.bio" class="form-control" rows="4" maxlength="500"
                      placeholder="Tell us more about yourself!"></textarea>
            <div class="text-muted small text-end mb-3">{{ form.bio.length }}/500</div>
          </div>

          <div class="col-12 col-md-6">
      <!-- owners only -->
            <template v-if="isOwner">
              <label class="form-label">Address</label>
              <LocationQuery
                label=""
                v-model:location-query="locationQuery"
                :location-suggestions="locationSuggestions"
                @enterLocation="onLocationInput"
                @selectLocation="onPlacePick" />
              <div v-if="locationQuery.trim() && locationQuery !== place?.label" class="form-text text-danger">
                Pick an address from the list.
              </div>

              <label class="form-label mt-3" for="unit">Unit number (optional)</label>
              <input id="unit" v-model="unit" class="form-control mb-1" placeholder="#05-123" maxlength="20" />
              <div class="form-text mb-3">Private. It isn't shown on your public profile.</div>
            </template>

            <!-- sitters only -->
            <template v-if="isSitter">
              <!-- <h5 class="border-bottom pb-1 mt-4 mb-3">Sitter details</h5> -->

              <label class="form-label">Rate (per hour)</label>
              <div class="input-group mb-3">
                <span class="input-group-text">S$</span>
                <input v-model="form.sitterProfile.petsittingRates" type="number" min="0" step="0.5" class="form-control" />
              </div>

              <label class="form-label">Sitting since</label>
              <input v-model="form.sitterProfile.experienceStart" type="month" class="form-control mb-1" />
              <div class="form-text mb-3">Your years of experience are worked out from this.</div>

              <label class="form-label">Find your area</label>
              <LocationQuery
                label=""
                v-model:location-query="locationQuery"
                :location-suggestions="locationSuggestions"
                @enterLocation="onLocationInput"
                @selectLocation="onPlacePick" />
              <div class="form-text mb-3">Search your address or postal code. Owners only see the street name, never your address.</div>

              <label class="form-label">Service area</label>
              <input v-model="form.sitterProfile.serviceArea" class="form-control mb-3" placeholder="e.g. Orchard Street 21" />

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
          </div>
        </div>

        <div class="mt-4">
          <button type="submit" class="btn text-white" style="background-color:#c47756;" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
          <router-link class="btn btn-link" to="/profile">Cancel</router-link>
        </div>
      </form>
  </div>
  <p v-else class="container mt-4">Loading…</p>
</template>