<script setup>
import {ref} from 'vue'
import StarRating from './StarRating.vue';

const pets = defineModel('pets', { type: Array, default: () => [] })
const other = defineModel('other', { type: String, default: '' })
const rating = defineModel('rating', { type: Number, default: 0 })

const open = ref(false)
</script>

<template>
  <div>
    <button class="btn btn-link" type="button"
            :aria-expanded="open" aria-controls="additionalFilters"
            @click="open = !open">
      Additional filters {{ open ? '▴' : '▾' }}
    </button>
    <div v-if="open" id="additionalFilters">
      <label class="form-label fw-semibold">Pet services:</label>
      <div>
        <div class="form-check form-check-inline" v-for="p in ['dog','cat','bird','rabbit','hamster']" :key="p">
          <input type="checkbox" class="form-check-input" v-model="pets" :value="p" :id="`pet-${p}`">
          <label class="form-check-label text-capitalize" :for="`pet-${p}`">{{ p }}</label>
        </div>
      </div>
      <div class="d-flex gap-2 my-2">
        <label for="others">Others:</label>
        <div class="col-5"><input type="text" class="form-control" id="others" v-model="other"></div>
      </div>
      <label class="fw-semibold">Rating:</label>
      <StarRating v-model="rating" :maxStars="5" />
    </div>
  </div>
</template>