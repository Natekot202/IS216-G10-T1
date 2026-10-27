<script setup>
import { computed } from 'vue'

const props = defineProps({
  min: Number, max: Number,
  minLimit: { type: Number, default: 0 },
  maxLimit: { type: Number, default: 100 }
})
const emit = defineEmits(['update:min', 'update:max'])

function onMin(e) {
  const v = Math.min(Number(e.target.value), props.max)
  e.target.value = v                 // snap the DOM; Vue won't repaint if the prop value is unchanged
  emit('update:min', v)
}
function onMax(e) {
  const v = Math.max(Number(e.target.value), props.min)
  e.target.value = v
  emit('update:max', v)
}

const trackStyle = computed(() => {
  const range = props.maxLimit - props.minLimit
  const a = ((props.min - props.minLimit) / range) * 100
  const b = ((props.max - props.minLimit) / range) * 100
  return { background: `linear-gradient(to right, #ddd ${a}%, #C4552D ${a}%, #C4552D ${b}%, #ddd ${b}%)` }
})
</script>

<template>
  <div>
    <label class="form-label fw-bold">Price (per hour)</label>
    <div class="range-slider-container">
      <div class="slider-track" :style="trackStyle"></div>
      <input type="range" class="slider slider-min" :min="minLimit" :max="maxLimit" step="5" :value="min" @input="onMin">
      <input type="range" class="slider slider-max" :min="minLimit" :max="maxLimit" step="5" :value="max" @input="onMax">
    </div>
    
    <div class="row g-2 mb-3">
      <div class="col-6">
        <label class="form-label small text-secondary mb-1" for="price-min">Min</label>
        <input id="price-min" type="number" class="form-control" :min="minLimit" :max="maxLimit" step="5"
              :value="min" @input="onMin">
      </div>
      <div class="col-6">
        <label class="form-label small text-secondary mb-1" for="price-max">Max</label>
        <input id="price-max" type="number" class="form-control" :min="minLimit" :max="maxLimit" step="5"
              :value="max" @input="onMax">
      </div>
    </div>
  </div>
</template>


<style scoped>
 .range-slider-container {
  position: relative;
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center; /* Vertically centers the tracks and thumbs */
}

/* The actual bar background */
.slider-track {
  position: absolute;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  pointer-events: none; /* Allows clicks to pass through to the inputs */
}

.slider {
  position: absolute;
  width: 100%;
  pointer-events: none;
  appearance: none;
  background: none;
  margin: 0;
}

/* Webkit browser styling (Chrome, Safari, Edge, Opera) */
.slider::-webkit-slider-thumb {
  pointer-events: auto;
  cursor: pointer;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: brown;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* Firefox browser styling */
.slider::-moz-range-thumb {
  pointer-events: auto;
  cursor: pointer;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: brown;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
</style>