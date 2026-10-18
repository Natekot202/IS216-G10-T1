<script setup>
import { formatAge } from '../utils/formatAge.js'

defineProps({
  pet: {
    type: Object,
    required: true
  }
})


defineEmits(['delete'])
</script>

<template>
  <div class="col-sm-6 col-lg-4">
    <div class="card h-100 shadow-sm">
      <div class="card-body">
        <img v-if="pet.photo?.url" :src="pet.photo.url" :alt="pet.name"
            class="card-img-top" style="aspect-ratio: 1; object-fit: cover;" />
        <div v-else class="d-flex align-items-center justify-content-center bg-light fs-1"
            style="aspect-ratio: 1;">🐾</div>
        <h5 class="card-title mb-1">{{ pet.name }}</h5>
        <h6 class="card-subtitle mb-2 text-muted">
          {{ pet.species }}<span v-if="pet.breed"> · {{ pet.breed }}</span>
        </h6>
        <p v-if="pet.ageMonths != null" class="text-muted mb-1">
          {{ formatAge(pet.ageMonths) }}
        </p>
        <p class="card-text">{{ pet.description }}</p>
      </div>
      <div class="card-footer bg-transparent border-top-0 text-end">
        <button
          class="btn btn-sm btn-outline-danger"
          @click="$emit('delete', pet._id)"
        >
          Remove
        </button>
      </div>
    </div>
  </div>
</template>
