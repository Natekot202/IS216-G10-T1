<script setup>
import { computed } from 'vue'
import { passwordChecks } from '../utils/passwordChecks.js'

const props = defineProps({
  password: { type: String, default: '' },
  light: { type: Boolean, default: false } 
})

const rules = computed(() => passwordChecks(props.password))

</script>

<template>
  <ul class="pr" :class="{ 'pr--light': light }" aria-label="Password requirements">
    <li v-for="r in rules" :key="r.text" :class="{ 'pr__ok': r.ok }">
      <span aria-hidden="true">{{ r.ok ? '✓' : '○' }}</span> {{ r.text }}
    </li>
  </ul>
</template>

<style scoped>
.pr {
  margin: 0.5rem 0 1rem;
  padding: 0;
  list-style: none;
  font-size: 0.85rem;
  color: #5c524b;
}
.pr__ok {
  color: #2f6f3a;
}
.pr--light {
  color: rgba(255, 255, 255, 0.75);
}
.pr--light .pr__ok {
  color: #9fe0b0;
}
</style>