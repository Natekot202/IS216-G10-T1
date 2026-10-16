<script setup>
import { onMounted, reactive, ref } from 'vue'
import { petsApi } from '../services/api'
import PetCard from '../components/PetCard.vue'

const pets = ref([])
const error = ref('')
const submitting = ref(false)

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
    const created = await petsApi.create(payload)
    pets.value.unshift(created)
    Object.assign(form, { name: '', species: '', breed: '', ageYears: '', ageMonths: '', description: '' })
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not add pet.'
    console.error(err)
  } finally {
    submitting.value = false
  }
}

async function deletePet(id) {
  try {
    error.value = ''
    await petsApi.remove(id)
    pets.value = pets.value.filter((p) => p._id !== id)
  } catch (err) {
    error.value = 'Could not remove pet.'
    console.error(err)
  }
}

onMounted(loadPets)
</script>

<template>
  <h3 class="mb-4">My Pets</h3>

  <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <form class="row g-2 mb-4" @submit.prevent="addPet">
    <div class="col-6">
        <label class="form-label">Name</label>
        <input v-model="form.name" type="text" class="form-control" required />
    </div>
    <div class="col-6">
        <label class="form-label">Species</label>
        <input v-model="form.species" type="text" class="form-control" required />
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
        <label class="form-label">Photo (optional)</label>
        <input type="file" accept="image/*" class="form-control" disabled />
    </div>
    <div class="col-12">
        <button type="submit" class="btn text-white w-100" style="background-color:#c47756;" :disabled="submitting">
        Add pet
        </button>
    </div>
    </form>

  <div v-if="!pets.length" class="text-muted">
    No pets yet &mdash; add the first one above.
  </div>
  <div v-else class="row g-3">
    <PetCard
      v-for="pet in pets"
      :key="pet._id"
      :pet="pet"
      @delete="deletePet"
    />
  </div>
</template>
