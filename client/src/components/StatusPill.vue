<script setup>
// One pill style per booking status, colours from the team style guide.
defineProps({ status: { type: String, required: true } })

const labels = {
  pending: 'Pending',
  accepted: 'Accepted',
  confirmed: 'Confirmed',
  paid: 'Paid',
  'in-progress': 'In Progress',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  expired: 'Expired',
}
</script>

<template>
  <span class="pill" :class="`pill-${status}`">{{ labels[status] || status }}</span>
</template>

<style scoped>
.pill { display: inline-flex; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid; }
.pill-pending { background: #FDF1DC; border-color: #F0C987; color: #8A5A14; }
.pill-accepted { background: #E8F0FB; border-color: #AFCBEF; color: #2C5FA8; }
.pill-confirmed { background: #E3F1EE; border-color: #A9D2C8; color: #2F6F62; }
.pill-paid { background: #E6F5EE; border-color: #9FD8C0; color: #1F7A53; }
.pill-in-progress { background: #F1EAFB; border-color: #CBB3F0; color: #6A3FB0; }
.pill-completed { background: #EFF4EC; border-color: #C9DDC2; color: #4C7A3F; }
.pill-declined { background: #FBEAEA; border-color: #EFB6B6; color: #B23C3C; }
.pill-cancelled { background: #F1EEEA; border-color: #D6CEC6; color: #5E554D; }
.pill-expired { background: #F6F4F1; border-color: #E0D9D1; color: #8A7F75; border-style: dashed; }
</style>
