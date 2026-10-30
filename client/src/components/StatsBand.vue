<script setup>
defineProps({
  stats: { type: Array, required: true }
})
</script>

<template>
  <div class="stat-band">
    <div v-for="s in stats" :key="s.key" class="stat-item">
      <span class="stat-big" :class="{ 'stat-big--empty': s.empty }">{{ s.value }}</span>
      <span v-if="s.stars" class="stat-stars" :aria-label="s.starsLabel">{{ s.stars }}</span>
      <span class="stat-sub">{{ s.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.stat-band {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid #e6d3c0;
  border-radius: 20px;
  background: #fbf1e6;
  box-shadow: 0 8px 20px rgba(120, 70, 40, 0.14);
}
.stat-item {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.2rem;
  padding: 1rem 0.75rem;
  min-width: 0;
  text-align: center;
}
.stat-item + .stat-item {
  border-left: 1px solid rgba(43, 36, 32, 0.14);
}
.stat-big {
  font-size: clamp(1.4rem, 1rem + 0.9vw, 1.8rem);
  color: #2b2420;
}
.stat-big--empty {
  color: rgba(43, 36, 32, 0.35);
}
.stat-stars {
  color: #c44f1c;
  font-size: 1rem;
}
.stat-sub {
  font-size: 1rem;
  color: #5c524b;
}
@media (max-width: 575.98px) {
  .stat-band {
    grid-template-columns: 1fr;
  }
  .stat-item + .stat-item {
    border-left: 0;
    border-top: 1px solid rgba(43, 36, 32, 0.14);
  }
}
</style>