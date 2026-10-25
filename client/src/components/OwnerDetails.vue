<script setup>
import { nextTick, reactive, ref, watch } from 'vue'
import { petsApi, usersApi } from '../services/api'
import PetCard from '../components/PetCard.vue'
import { usePhotoPicker } from '../utils/usePhotoPicker.js'

const pets = ref([])
const loading = ref(true)
const error = ref('')
const submitting = ref(false)
const pet_types = ["Dog", "Cat", "Bird", "Rabbit", "Hamster", "Other"];

const props = defineProps({
  ownerId: { type: String, default: '' },
  ownerName: { type: String, default: '' },
  editable: { type: Boolean, default: false }
})

const { file: photoFile, preview: photoPreview, error: photoError, input: fileInput, onPick, clear: resetPhoto } = usePhotoPicker()

const form = reactive({ name: '', species: '', otherSpecies: '', breed: '', ageYears: '', ageMonths: '', description: '' })

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

async function addPet() {
  const species = form.species === 'Other' ? form.otherSpecies.trim() : form.species.trim()
  if (!props.editable || !form.name.trim() || !species) {
    return
  }
  error.value = ''
  submitting.value = true
  try {
    const years = Number(form.ageYears || 0)
    const months = Number(form.ageMonths || 0)
    const hasAge = form.ageYears !== '' || form.ageMonths !== ''

    const payload = {
    name: form.name.trim(),
    species,
    breed: form.breed,
    description: form.description,
    ageMonths: hasAge ? years * 12 + months : undefined
    }

    const data = new FormData()
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        data.append(key, value) 
      }
    })
    if (photoFile.value) {
      data.append('photo', photoFile.value)   
    }      

    const created = await petsApi.create(data)   

    pets.value.unshift(created)
    Object.assign(form, { name: '', species: '', otherSpecies: '', breed: '', ageYears: '', ageMonths: '', description: '' })
    resetPhoto()
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not add pet.'
    console.error(err)
  } finally {
    submitting.value = false
  }
}

async function deletePet(id) {
  if (!confirm('Remove this pet?')) {
    return
  }
  error.value = ''
  const index = pets.value.findIndex((p) => p._id === id)
  if (index === -1) {
    return
  }
  const [removed] = pets.value.splice(index, 1) 
  try {
    await petsApi.remove(id)
  } catch (err) {
    pets.value.splice(index, 0, removed)    
    error.value = err.response?.data?.message || 'Could not remove pet.'
    console.error(err)
  }
}

const showForm = ref(false)
const nameInput = ref(null)

watch(showForm, async (open) => {
  if (open) {
    await nextTick()
    nameInput.value?.focus()
  }
})

function closeForm() {
  Object.assign(form, { name: '', species: '', otherSpecies: '', breed: '', ageYears: '', ageMonths: '', description: '' })
  resetPhoto()
  error.value = ''
  showForm.value = false
}

watch(() => [props.ownerId, props.editable], loadPets, { immediate: true })

</script>

<template>
  <div>
    <div class="od-head">
      <h4 class="od-heading">
        {{ editable ? 'My Pets' : `${ownerName}'s pets` }}<span v-if="!loading"> ({{ pets.length }})</span>
      </h4>
      <button v-if="editable && !showForm" type="button" class="btn btn-sm od-add" @click="showForm = true">
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
      <button v-if="editable && !showForm" type="button" class="btn btn-sm od-add" @click="showForm = true">
        Add your first pet
      </button>
    </div>

    <div v-else class="pet-strip">
      <div v-for="pet in pets" :key="pet._id" class="pet-strip__item">
        <PetCard :pet="pet" :editable="editable" @delete="deletePet" />
      </div>
    </div>

    <form v-if="editable && showForm" class="od-form" @submit.prevent="addPet">
      <h5 class="od-form__title">Add a pet</h5>

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
            <img v-if="photoPreview" :src="photoPreview" alt="Preview of the chosen photo" class="od-photo__img" />
            <template v-else>
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <span>Add a photo</span>
              <small>JPG, PNG or WebP, up to 2 MB</small>
            </template>
            <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp"
                   class="visually-hidden" @change="onPick" />
            <button v-if="photoPreview" type="button" class="btn-close od-photo__remove bg-white p-1"
                    aria-label="Remove photo" @click.prevent="resetPhoto()"></button>
          </label>
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
          {{ submitting ? 'Adding…' : 'Add pet' }}
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
  margin-bottom: 1rem;
}
.od-heading {
  margin: 0;
  font-family: 'Trirong', Georgia, serif;
  font-size: 1.35rem;
  font-weight: 700;
  color: #2b2420;
}
.od-add {
  padding: 0.4rem 0.95rem;
  border: 0;
  border-radius: 999px;
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
  border: 1px solid #e6d3c0;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
}
.od-form__title {
  margin: 0 0 1rem;
  font-family: 'Fraunces', Georgia, serif;
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