<script setup>
// Tab bar shared by My Bookings (owner), Booking Requests (sitter) and Transactions.
// The page owns the list and the active tab; this only shows the tabs and says which one was clicked.
// Phones (under 576px) get a dropdown instead of the tabs: it fits on one line and shows every option in one tap,
// where tabs would wrap onto two lines or scroll sideways and hide some of them.
defineProps({
  tabs: { type: Array, required: true }, // [{ key, label, count }]
  activeTab: { type: String, required: true }
})

defineEmits(['select'])
</script>

<template>
  <!-- Phones: one dropdown, e.g. "Pending (1)" -->
  <div class="d-sm-none mb-3">
    <label class="visually-hidden" for="booking-tab-select">Show</label>
    <select
      id="booking-tab-select"
      class="form-select tab-select"
      :value="activeTab"
      @change="$emit('select', $event.target.value)"
    >
      <option v-for="tab in tabs" :key="tab.key" :value="tab.key">{{ tab.label }} ({{ tab.count }})</option>
    </select>
  </div>

  <!-- Tablets and laptops: the underline tabs -->
  <ul class="nav nav-underline mb-4 d-none d-sm-flex">
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
  border-bottom-color: var(--accent-deep);
}
.tab-select {
  font-weight: 600;
  border-color: #e4dbd0;
  border-radius: 10px;
}
.tab-select:focus {
  border-color: var(--accent-deep);
  box-shadow: 0 0 0 0.2rem rgb(var(--accent-rgb) / 0.2);
}
.tab-count {
  background: #f1ece6;
  color: #2b2420;
}
</style>
