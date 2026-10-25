<script setup>
// Tab bar shared by My Bookings (owner) and Booking Requests (sitter).
// The page owns the list and the active tab; this only shows the tabs and says which one was clicked.
defineProps({
  tabs: { type: Array, required: true }, // [{ key, label, count }]
  activeTab: { type: String, required: true }
})

defineEmits(['select'])
</script>

<template>
  <ul class="nav nav-underline mb-4 flex-nowrap overflow-auto">
    <li v-for="tab in tabs" :key="tab.key" class="nav-item">
      <button
        type="button"
        class="nav-link text-nowrap"
        :class="{ active: activeTab === tab.key }"
        @click="$emit('select', tab.key)"
      >
        {{ tab.label }}
        <span class="badge rounded-pill tab-count ms-1">{{ tab.count }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.nav-underline .nav-link {
  color: #6c757d;
}
.nav-underline .nav-link.active {
  color: #2b2420;
  font-weight: 700;
  border-bottom-color: #c44f1c;
}
.tab-count {
  background: #f1ece6;
  color: #2b2420;
}
</style>
