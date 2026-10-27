<script setup>
const model = defineModel({ type: Number })
defineProps({ limit: Number, referenceLabel: { type: String, default: null } })
</script>

<template>
  <div>
    <label for="distance" class="form-label fw-bold">Distance</label>
    <input id="distance" type="range" class="form-range" min="1" :max="limit" step="1"
           v-model.number="model" :disabled="!referenceLabel">
    <small class="text-secondary d-block mb-3">
      <template v-if="!referenceLabel">Allow location access or search a location to use this filter</template>
      <template v-else>
        {{ model >= limit ? 'Any distance' : `Within ${model} km` }} of {{ referenceLabel }}
      </template>
    </small>
  </div>
</template>