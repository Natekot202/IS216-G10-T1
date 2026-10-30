<script setup>
defineProps({
  items: { type: Array, required: true }
})
</script>

<template>
  <ul class="pill-list">
    <li v-for="item in items" :key="item">{{ item }}</li>
  </ul>
</template>

<style scoped>
.pill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pill-list li {
  padding: 0.3rem 0.8rem;
  border-radius: 100px;
  background: #fbf1e6;
  color: #2b2420;
  font-size: 0.9rem;
  font-weight: 600;
}
</style>