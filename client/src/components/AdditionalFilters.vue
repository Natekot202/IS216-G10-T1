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
    <button class="btn btn-brand-outline btn-sm w-100 fw-semibold" type="button"
            :aria-expanded="open" aria-controls="additionalFilters"
            @click="open = !open">
      More filters {{ open ? '▴' : '▾' }}
    </button>
    <div v-if="open" id="additionalFilters" class="mt-3">
      <label class="form-label fw-bold">Pet services:</label>
      <div>
        <div class="form-check form-check-inline" v-for="p in ['dog','cat','bird','rabbit','hamster']" :key="p">
          <input type="checkbox" class="form-check-input" v-model="pets" :value="p" :id="`pet-${p}`" style="width:20px;height: 20px;">
          <label class="form-check-label text-capitalize m-1" :for="`pet-${p}`">{{ p }}</label>
        </div>
      </div>
      <div class="d-flex gap-2 my-2">
        <label for="others">Others:</label>
        <div class="col-5"><input type="text" class="form-control" id="others" v-model="other"></div>
      </div>
      <label class="fw-bold">Rating:</label>
      <StarRating v-model="rating" :maxStars="5" />
    </div>
  </div>
</template>
<style scoped>
.form-check-input:checked {
  background-color: var(--accent-main);
  border-color: var(--accent-main);
}
.form-check-input:focus {
  border-color: var(--accent-main);
  box-shadow: 0 0 0 0.25rem rgb(var(--accent-rgb) / 0.25);
}
</style>

