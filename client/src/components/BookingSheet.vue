<script setup>
import { computed } from 'vue'
import { formatDateRange } from '../utils/bookingHelpers.js'

// A short preview of one booking that slides up from the bottom of the screen.
// The calendar shows it on phones, where there is no mouse to hover with.
// The full details (pets, care tasks, notes) stay on the booking details page, which the button opens.
const props = defineProps({
  booking: { type: Object, required: true } // one booking from the calendar
})

// 'close' tells the calendar to hide the sheet
const emit = defineEmits(['close'])

// The pets on the booking, each with a picture address (empty if the pet has no picture)
const pets = computed(() => props.booking.pets || props.booking.petNames.map((name) => ({ name, photo: '' })))
</script>

<template>
  <!-- Teleport moves the sheet out to the page's <body>, so it sits above everything else on the page -->
  <Teleport to="body">
    <div class="sheet-back" @click="emit('close')"></div>
    <div class="sheet" role="dialog" aria-label="Booking preview">
      <span class="grab"></span>
      <button type="button" class="sheet-x" aria-label="Close" @click="emit('close')">✕</button>

      <div class="bs-top">
        <!-- the pets' pictures (their first letter if a pet has no picture) -->
        <span class="bs-pics">
          <span v-for="(pet, i) in pets" :key="i" class="bs-pic">
            <img v-if="pet.photo" :src="pet.photo" :alt="pet.name" />
            <template v-else>{{ pet.name.charAt(0).toUpperCase() }}</template>
          </span>
        </span>
        <div class="bs-main">
          <strong>{{ pets.map((p) => p.name).join(', ') }}</strong>
          <span class="bs-when">
            {{ formatDateRange(booking.startDate, booking.endDate, booking.startTime, booking.endTime) }}
          </span>
        </div>
        <span class="bs-price">${{ booking.totalPrice }}</span>
      </div>
      <div class="bs-bottom">
        <span>with {{ booking.ownerName }}</span>
        <span class="status-pill">{{ booking.status }}</span>
      </div>

      <router-link :to="`/bookings/${booking._id}`" class="btn btn-accent w-100 fw-semibold">Booking details</router-link>
    </div>
  </Teleport>
</template>

<style scoped>
/* the sheet is moved to the page body, so the colours are written out (same ones as the calendar's hover card) */
.sheet-back {
  position: fixed;
  inset: 0;
  z-index: 1080;
  background: rgba(20, 16, 14, 0.35);
}
.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1081;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  color: #2b2420;
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -8px 24px rgba(43, 36, 32, 0.18);
  font-family: 'Nunito', system-ui, sans-serif;
}
@media (prefers-reduced-motion: no-preference) {
  .sheet { animation: slide-up 0.2s ease-out; }
}
@keyframes slide-up {
  from { transform: translateY(30px); opacity: 0.6; }
  to { transform: none; opacity: 1; }
}
.grab { width: 40px; height: 4px; border-radius: 2px; background: #e4dbd0; align-self: center; }
.sheet-x {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: #f7f3ee;
  color: #2b2420;
}
.bs-top { display: flex; gap: 10px; align-items: center; padding-right: 40px; } /* room for the close button */
.bs-pics { display: flex; flex: none; }
.bs-pic {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 2px solid #fff;
  margin-left: -12px;
  background: #c47756;
  color: #fff;
  display: grid;
  place-items: center;
  font-family: 'Fredoka', sans-serif;
  font-weight: 600;
  overflow: hidden;
}
.bs-pic:first-child { margin-left: 0; }
.bs-pic img { width: 100%; height: 100%; object-fit: cover; }
.bs-main { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.bs-main strong { font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 1.05rem; }
.bs-when { color: #766a60; font-size: 0.82rem; }
.bs-price { color: #3f8a4a; font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 1.1rem; align-self: flex-start; }
.bs-bottom { display: flex; justify-content: space-between; align-items: center; gap: 10px; color: #766a60; font-size: 0.86rem; }
.status-pill {
  background: #dff0e0;
  color: #24572b;
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 1px 8px;
  border-radius: 999px;
}
.btn-accent { background: #c47756; border-color: #c47756; color: #fff; padding: 10px; border-radius: 10px; }
.btn-accent:hover { background: #b06647; border-color: #b06647; color: #fff; }
</style>
