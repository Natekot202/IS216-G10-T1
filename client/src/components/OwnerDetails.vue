<script setup>
import { nextTick, reactive, ref, watch, computed } from 'vue'
import { petsApi, usersApi } from '../services/api'
import PetCard from '../components/PetCard.vue'
import { usePhotoPicker } from '../utils/usePhotoPicker.js'
import StatsBand from './StatsBand.vue'
import InfoCard from './InfoCard.vue'
import PillList from './PillList.vue'

const pets = ref([])
const loading = ref(true)
const error = ref('')
const submitting = ref(false)
const pet_types = ["Dog", "Cat", "Bird", "Rabbit", "Hamster", "Other"];

const props = defineProps({
  ownerId: { type: String, default: '' },
  ownerName: { type: String, default: '' },
  editable: { type: Boolean, default: false },
  profile: { type: Object, default: null } 
})

const {
  file: photoFile,
  preview: photoPreview,
  error: photoError,
  input: fileInput,
  onPick,
  clear: resetPhoto
} = usePhotoPicker()

const emptyForm = () => ({
  name: '', species: '', otherSpecies: '', breed: '', ageYears: '', ageMonths: '', description: ''
})
const form = reactive(emptyForm())

const showForm = ref(false)
const editingId = ref(null)            // null means adding a new pet
const existingPhotoUrl = ref('')       // the saved photo of the pet being edited
const removeExistingPhoto = ref(false)
const nameInput = ref(null)
const formEl = ref(null)

const shownPhoto = computed(
  () => photoPreview.value || (removeExistingPhoto.value ? '' : existingPhotoUrl.value)
)

async function loadPets() {
  if (!props.ownerId) {
    return
  }
  loading.value = true
  error.value = ''
  try {
    pets.value = props.editable
      ? await petsApi.getAll()
      : await usersApi.getPets(props.ownerId)
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load pets.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

watch([() => props.ownerId, () => props.editable], loadPets, { immediate: true })

function resetForm() {
  Object.assign(form, emptyForm())
  resetPhoto()
  editingId.value = null
  existingPhotoUrl.value = ''
  removeExistingPhoto.value = false
  error.value = ''
}

function closeForm() {
  resetForm()
  showForm.value = false
}

async function focusForm() {
  await nextTick()
  formEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  nameInput.value?.focus({ preventScroll: true })
}

function openAdd() {
  resetForm()
  showForm.value = true
  focusForm()
}

// fill form with current details
function startEdit(pet) {
  resetForm()
  editingId.value = pet._id
  form.name = pet.name || ''

  const known = pet_types.find((t) => t.toLowerCase() === String(pet.species || '').toLowerCase())
  if (known && known !== 'Other') {
    form.species = known
  } else {
    form.species = 'Other'
    form.otherSpecies = pet.species || ''
  }

  form.breed = pet.breed || ''
  if (pet.ageMonths != null) {
    form.ageYears = String(Math.floor(pet.ageMonths / 12))
    form.ageMonths = String(pet.ageMonths % 12)
  }
  form.description = pet.description || ''
  existingPhotoUrl.value = pet.photo?.url || ''

  showForm.value = true
  focusForm()
}

function clearPhotoTile() {
  if (photoPreview.value) {
    resetPhoto()
  } else {
    removeExistingPhoto.value = true
  }
}

async function submitPet() {
  const species = form.species === 'Other' ? form.otherSpecies.trim() : form.species.trim()
  if (!props.editable || !form.name.trim() || !species) {
    return
  }
  error.value = ''
  submitting.value = true
  try {
    const editing = editingId.value !== null
    const years = Number(form.ageYears || 0)
    const months = Number(form.ageMonths || 0)
    const hasAge = form.ageYears !== '' || form.ageMonths !== ''

    const fields = {
      name: form.name.trim(),
      species,
      breed: form.breed.trim(),
      description: form.description.trim(),
      ageMonths: hasAge ? years * 12 + months : ''
    }

    const data = new FormData()
    Object.entries(fields).forEach(([key, value]) => {
      // when editing, empty values are sent too, so a field can be cleared
      if (editing || value !== '') {
        data.append(key, value)
      }
    })
    if (photoFile.value) {
      data.append('photo', photoFile.value)
    } else if (editing && removeExistingPhoto.value) {
      data.append('removePhoto', '1')
    }

    if (editing) {
      const updated = await petsApi.update(editingId.value, data)
      const i = pets.value.findIndex((p) => p._id === updated._id)
      if (i !== -1) {
        pets.value.splice(i, 1, updated)
      }
    } else {
      const created = await petsApi.create(data)
      pets.value.unshift(created)
    }
    closeForm()
  } catch (err) {
    error.value = err.response?.data?.message || (editingId.value ? 'Could not update pet.' : 'Could not add pet.')
    console.error(err)
  } finally {
    submitting.value = false
  }
}

async function deletePet(id) {
  if (!props.editable || !confirm('Remove this pet?')) {
    return
  }
  error.value = ''
  const index = pets.value.findIndex((p) => p._id === id)
  if (index === -1) {
    return
  }
  const [removed] = pets.value.splice(index, 1)
  if (editingId.value === id) {
    closeForm()
  }
  try {
    await petsApi.remove(id)
  } catch (err) {
    pets.value.splice(index, 0, removed)
    error.value = err.response?.data?.message || 'Could not remove pet.'
    console.error(err)
  }
}

// stats cards
const stats = ref(null)

watch(() => props.ownerId, async (id) => {
  stats.value = null
  if (!id) {
    return
  }
  try {
    stats.value = await usersApi.getOwnerStats(id)
  } catch (err) {
    console.warn('Could not load owner stats', err)
  }
}, { immediate: true })

const memberSince = computed(() => {
  const d = props.profile?.createdAt ? new Date(props.profile.createdAt) : null
  if (!d || Number.isNaN(d.getTime())) {
    return ''
  }
  return d.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })
})

const lookingFor = computed(() => props.profile?.ownerProfile?.servicesNeeded ?? [])

const ownerStats = computed(() => [
  { key: 'since', value: memberSince.value || '–', label: 'member since' },
  {
    key: 'done',
    value: stats.value ? stats.value.completedBookings : '–',
    label: stats.value?.completedBookings === 1 ? 'completed booking' : 'completed bookings'
  },
  {
    key: 'sitters',
    value: stats.value ? stats.value.sittersBooked : '–',
    label: stats.value?.sittersBooked === 1 ? 'sitter booked' : 'sitters booked'
  }
])

</script>

<template>
  <div>
    <StatsBand :stats="ownerStats" />

    <InfoCard v-if="lookingFor.length || editable"
          :title="editable ? 'Services I\'m looking for' : 'Services needed'">
      <PillList v-if="lookingFor.length" :items="lookingFor" />
      <p v-else class="mb-0 text-muted">
        Tell sitters what you need.
        <router-link to="/editProfile">Add services</router-link>
      </p>
    </InfoCard>
    
    <div class="od-head">
      <h4 class="od-heading">
        {{ editable ? 'My Pets' : `Pets` }}<span v-if="!loading"> ({{ pets.length }})</span>
      </h4>
      <button v-if="editable && !showForm" type="button" class="btn btn-sm od-add" @click="openAdd">
        + Add a pet
      </button>
    </div>

    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <div v-if="loading" class="d-flex align-items-center text-muted">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      Loading pets…
    </div>

    <div v-else-if="!pets.length" class="od-empty">
      <p class="mb-2">
        {{ editable ? 'No pets yet. Add one so sitters know who they will be looking after.' : 'No pets listed yet.' }}
      </p>
      <button v-if="editable && !showForm" type="button" class="btn btn-sm od-add" @click="openAdd">
        Add your first pet
      </button>
    </div>

    <div v-else class="pet-strip">
      <div v-for="pet in pets" :key="pet._id" class="pet-strip__item">
        <PetCard :pet="pet" :editable="editable" :editing="editingId === pet._id"
                 @edit="startEdit" @delete="deletePet" />
      </div>
    </div>

    <form v-if="editable && showForm" ref="formEl" class="od-form" @submit.prevent="submitPet">
      <h5 class="od-form__title">{{ editingId ? 'Edit pet' : 'Add a pet' }}</h5>

      <div class="row g-3">
        <div class="col-12 col-md-7">
          <div class="row g-3">
            <div class="col-12 col-sm-6">
              <label for="petName" class="form-label">Name</label>
              <input id="petName" ref="nameInput" v-model="form.name" type="text" class="form-control" required />
            </div>
            <div class="col-12 col-sm-6">
              <label for="species" class="form-label">Species</label>
              <select id="species" v-model="form.species" class="form-select" required>
                <option value="" disabled>Select a species</option>
                <option v-for="s in pet_types" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div v-if="form.species === 'Other'" class="col-12">
              <label for="otherSpecies" class="form-label">Please specify</label>
              <input id="otherSpecies" v-model="form.otherSpecies" type="text" class="form-control"
                     maxlength="40" placeholder="e.g. Guinea pig" required />
            </div>
            <div class="col-12">
              <label for="petBreed" class="form-label">Breed</label>
              <input id="petBreed" v-model="form.breed" type="text" class="form-control" />
            </div>
            <div class="col-12">
              <label class="form-label">Age</label>
              <div class="input-group">
                <input v-model="form.ageYears" type="number" min="0" max="40" class="form-control" placeholder="0" />
                <span class="input-group-text">yrs</span>
                <input v-model="form.ageMonths" type="number" min="0" max="11" class="form-control" placeholder="0" />
                <span class="input-group-text">mths</span>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-5">
          <span class="form-label d-block">Photo (optional)</span>
          <label class="od-photo">
            <img v-if="shownPhoto" :src="shownPhoto" alt="Pet photo" class="od-photo__img" />
            <template v-else>
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <span>Add a photo</span>
              <small>JPG, PNG or WebP, up to 2 MB</small>
            </template>
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp"
                   class="visually-hidden" @change="onPick" />
            <button v-if="shownPhoto" type="button" class="btn-close od-photo__remove bg-white p-1"
                    aria-label="Remove photo" @click.prevent="clearPhotoTile"></button>
          </label>
          <p v-if="editingId && shownPhoto" class="form-text mb-0">Click the photo to change it.</p>
          <div v-if="photoError" class="alert alert-warning py-1 mt-2">{{ photoError }}</div>
        </div>

        <div class="col-12">
          <label for="petDesc" class="form-label">Description</label>
          <input id="petDesc" v-model="form.description" type="text" class="form-control"
                 placeholder="Habits, likes, anything a sitter should know" />
        </div>
      </div>

      <div class="od-actions">
        <button type="button" class="btn btn-outline-secondary" @click="closeForm">Cancel</button>
        <button type="submit" class="btn od-submit" :disabled="submitting">
          <span v-if="submitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
          {{ submitting ? (editingId ? 'Saving…' : 'Adding…') : (editingId ? 'Update pet' : 'Add pet') }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.od-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 1.5rem 0 1rem;

}
.od-heading {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #2b2420;
  letter-spacing: -0.01em;
}
.od-add {
  padding: 0.4rem 0.95rem;
  border: 0;
  background: #a85a38;
  color: #fff;
  font-weight: 600;
}
.od-add:hover {
  background: #8f4a2c;
  color: #fff;
}

.od-empty {
  padding: 1.5rem 1.25rem;
  border: 1px dashed #c47756;
  border-radius: 16px;
  background: rgba(196, 119, 86, 0.08);
  color: #2b2420;
}

.od-form {
  margin-top: 1.25rem;
  padding: 1.25rem;
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid #e6d3c0;    
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 6px 16px rgba(120, 70, 40, 0.1);
}
.od-form__title {
  margin: 0 0 1rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: #2b2420;
}

.od-photo {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 100%;
  max-width: 260px;
  aspect-ratio: 1;
  overflow: hidden;
  border: 2px dashed #c9a98f;
  border-radius: 14px;
  background: #f8eee3;
  color: #5c524b;
  font-size: 0.9rem;
  text-align: center;
  cursor: pointer;
}
.od-photo:hover {
  border-color: #c47756;
  background: #f4e4d3;
}
.od-photo:focus-within {
  outline: 2px solid #c44f1c;
  outline-offset: 2px;
}
.od-photo small {
  font-size: 0.75rem;
  opacity: 0.8;
}
.od-photo__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.od-photo__remove {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
}

.od-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}
.od-submit {
  padding: 0.5rem 1.4rem;
  border: 0;
  background: #a85a38;
  color: #fff;
  font-weight: 600;
}
.od-submit:hover:not(:disabled) {
  background: #8f4a2c;
  color: #fff;
}
</style>