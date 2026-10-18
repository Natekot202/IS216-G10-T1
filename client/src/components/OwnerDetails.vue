<script setup>
import { onMounted, reactive, ref } from 'vue'
import { petsApi } from '../services/api'
import PetCard from '../components/PetCard.vue'
import { usePhotoPicker } from '../utils/usePhotoPicker.js'

const pets = ref([])
const error = ref('')
const submitting = ref(false)
const pet_types = ["Dog", "Cat", "Bird", "Rabbit", "Hamster"];

const { file: photoFile, preview: photoPreview, error: photoError, input: fileInput, onPick, clear: resetPhoto } = usePhotoPicker()

const form = reactive({ name: '', species: '', breed: '', ageYears: '', ageMonths: '', description: '' })

async function loadPets() {
  error.value = ''
  try {
    pets.value = await petsApi.getAll()
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load pet.'
    console.error(err)
  } 
}

async function addPet() {
  if (!form.name || !form.species) {
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
    species: form.species.trim(),
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
    Object.assign(form, { name: '', species: '', breed: '', ageYears: '', ageMonths: '', description: '' })
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

onMounted(loadPets)
</script>

<template>
  <h3 class="mb-4">My Pets</h3>

  <div v-if="!pets.length" class="text-muted">
    No pets yet &mdash; add the first one above.
  </div>
  <div v-else class="row g-3">
    <PetCard
      v-for="pet in pets"
      :key="pet._id"
      :pet="pet"
      @delete="deletePet"/>
  </div>

  <h4 class="mt-4 mb-4">Add a pet</h4>

  <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <form class="row g-2 mb-4" @submit.prevent="addPet">
      <div class="col-6">
        <label class="form-label">Name</label>
        <input v-model="form.name" type="text" class="form-control" required />
      </div>
      <div class="col-6">
        <label for="species" class="form-label">Species</label>
        <select id="species" class="form-select" v-model="form.species" required>
          <option value="" disabled>Select a species</option>
          <option v-for="s in pet_types" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>
      <div class="col-12">
        <label class="form-label">Breed</label>
        <input v-model="form.breed" type="text" class="form-control" />
      </div>
      <div class="col-12 col-md-6">
        <label class="form-label">Age</label>
        <div class="input-group">
        <input v-model="form.ageYears" type="number" min="0" max="40" class="form-control" placeholder="0" />
        <span class="input-group-text">yrs</span> &nbsp;
        <input v-model="form.ageMonths" type="number" min="0" max="11" class="form-control" placeholder="0" />
        <span class="input-group-text">mths</span>
      </div>
      </div>
      <div class="col-12">
        <label class="form-label">Description</label>
        <input v-model="form.description" type="text" class="form-control" />
      </div>
      <div class="col-12 col-sm-9 col-md-6">
        <label for="petPhoto" class="form-label">Photo (optional)</label>
        <input id="petPhoto" ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp"
              class="form-control" @change="onPick" />
        <div v-if="photoError" class="alert alert-warning py-1 mt-2">{{ photoError }}</div>
        <img v-if="photoPreview" :src="photoPreview" alt="Preview" class="rounded mt-2"
            style="width: 120px; height: 120px; object-fit: cover;" />
      </div>
      <div class="col-12">
        <button type="submit" class="btn text-white w-100" style="background-color:#c47756;" :disabled="submitting">
          <span v-if="submitting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
          {{ submitting ? 'Adding…' : 'Add pet' }}
        </button>
      </div>
    </form>

</template>
