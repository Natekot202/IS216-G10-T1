<script setup>
defineProps({
  title: { type: String, default: '' }
})
</script>

<template>
  <section class="info-card">
    <h4 v-if="title" class="info-card__title">{{ title }}</h4>
    <slot />
  </section>
</template>

<style scoped>
.info-card {
  margin-top: 1rem;
  padding: 1.15rem 1.3rem;
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid #e6d3c0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(120, 70, 40, 0.1);
}
.info-card__title {
  margin: 0 0 0.6rem;
  font-size: 1.2rem;
  font-weight: 700;
  color: #2b2420;
}
</style>