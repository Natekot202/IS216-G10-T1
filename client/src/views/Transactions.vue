<script setup>
// /sitter/transactions (sitter): the money for my bookings.
// Rows come from 2 places:
//  - payment records: successful or rejected card attempts
//  - completed bookings the owner hasn't paid yet: shown as "pending"
import { computed, onMounted, ref } from 'vue'
import { paymentsApi } from '../services/paymentApi.js'
import { bookingsApi } from '../services/bookingApi.js'
import { currentUser, fetchUser } from '../services/auth.js'
import BookingTabs from '../components/BookingTabs.vue'
import { formatDateRange, formatPrice } from '../utils/bookingHelpers.js'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'successful', label: 'Successful' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Rejected' }
]
const STATUS_LABELS = { successful: 'Successful', pending: 'Awaiting payment', rejected: 'Rejected' }

const rows = ref([])
const loading = ref(true)
const error = ref('')
const activeFilter = ref('all')

function petList(pets) {
  return (pets || []).map((p) => p?.name).filter(Boolean).join(', ') || '—'
}

function shortDate(date) {
  return new Date(date).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' })
}

function sumOf(status) {
  return rows.value.filter((r) => r.status === status).reduce((total, r) => total + r.amount, 0)
}

const earned = computed(() => sumOf('successful'))
const awaiting = computed(() => sumOf('pending'))
const rejectedCount = computed(() => rows.value.filter((r) => r.status === 'rejected').length)

const visibleRows = computed(() =>
  activeFilter.value === 'all' ? rows.value : rows.value.filter((r) => r.status === activeFilter.value)
)
const tabs = computed(() =>
  FILTERS.map((f) => ({
    key: f.key,
    label: f.label,
    count: f.key === 'all' ? rows.value.length : rows.value.filter((r) => r.status === f.key).length
  }))
)

async function loadTransactions() {
  loading.value = true
  error.value = ''
  try {
    if (!currentUser.value) await fetchUser()
    if (currentUser.value?.role !== 'sitter') {
      error.value = 'This page is for pet sitters.'
      return
    }
    // Ask for both lists at the same time
    const [payments, unpaid] = await Promise.all([paymentsApi.getMine(), bookingsApi.getMine('completed')])

    const paymentRows = payments.map((p) => ({
      key: p._id,
      date: p.createdAt,
      owner: p.ownerId?.username || 'Unknown',
      pets: petList(p.bookingId?.petIds),
      session: p.bookingId
        ? formatDateRange(p.bookingId.startDate, p.bookingId.endDate, p.bookingId.startTime, p.bookingId.endTime)
        : '—',
      amount: p.amount,
      status: p.status,
      method: `${p.method === 'visa' ? 'VISA' : 'Mastercard'} •••• ${p.cardLast4}`
    }))

    const pendingRows = unpaid.map((b) => ({
      key: b._id,
      date: b.endDate,
      owner: b.ownerId?.username || 'Unknown',
      pets: petList(b.petIds),
      session: formatDateRange(b.startDate, b.endDate, b.startTime, b.endTime),
      amount: b.totalPrice,
      status: 'pending',
      method: '—'
    }))

    // newest first
    rows.value = [...pendingRows, ...paymentRows].sort((a, b) => new Date(b.date) - new Date(a.date))
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load your transactions.'
  } finally {
    loading.value = false
  }
}

onMounted(loadTransactions)
</script>

<template>
  <h2 class="mb-4">Transactions</h2>

  <div v-if="error" class="alert alert-warning">{{ error }}</div>
  <div v-else-if="loading" class="text-muted">Loading transactions…</div>

  <template v-else>
    <!-- Summary tiles -->
    <div class="row g-3 mb-4">
      <div class="col-12 col-sm-4">
        <div class="card h-100 shadow-sm tile">
          <div class="card-body">
            <div class="text-muted small">Total earned</div>
            <div class="fs-3 fw-bold text-earned">{{ formatPrice(earned) }}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-sm-4">
        <div class="card h-100 shadow-sm tile">
          <div class="card-body">
            <div class="text-muted small">Awaiting payment</div>
            <div class="fs-3 fw-bold text-awaiting">{{ formatPrice(awaiting) }}</div>
          </div>
        </div>
      </div>
      <div class="col-6 col-sm-4">
        <div class="card h-100 shadow-sm tile">
          <div class="card-body">
            <div class="text-muted small">Rejected attempts</div>
            <div class="fs-3 fw-bold text-rejected">{{ rejectedCount }}</div>
          </div>
        </div>
      </div>
    </div>

    <BookingTabs :tabs="tabs" :active-tab="activeFilter" @select="activeFilter = $event" />

    <p v-if="!visibleRows.length" class="text-muted text-center py-5">No transactions here yet 🐾</p>

    <div v-else class="table-responsive tx-table">
      <table class="table align-middle mb-0">
        <thead>
          <tr>
            <th>Date</th>
            <th>Owner</th>
            <th class="d-none d-md-table-cell">Session</th>
            <th class="text-end">Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in visibleRows" :key="r.key">
            <td class="text-nowrap">{{ shortDate(r.date) }}</td>
            <td>
              <div class="fw-semibold">{{ r.owner }}</div>
              <div class="small text-muted">{{ r.pets }}</div>
            </td>
            <td class="d-none d-md-table-cell small">{{ r.session }}</td>
            <td class="text-end text-nowrap">
              <div class="fw-semibold">{{ formatPrice(r.amount) }}</div>
              <div class="small text-muted">{{ r.method }}</div>
            </td>
            <td><span class="tx-pill" :class="`tx-${r.status}`">{{ STATUS_LABELS[r.status] }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>

<style scoped>
.tile {
  border: 1px solid #ede3d8;
  border-radius: 12px;
}
.text-earned { color: #1f7a53; }
.text-awaiting { color: #8a5a14; }
.text-rejected { color: #b23c3c; }
.tx-table {
  background: #fff;
  border: 1px solid #ede3d8;
  border-radius: 12px;
  padding: 0 0.75rem;
}
.tx-table th {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6c757d;
  white-space: nowrap;
}
/* same colours as StatusPill */
.tx-pill {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid;
  white-space: nowrap;
}
.tx-successful { background: #e6f5ee; border-color: #9fd8c0; color: #1f7a53; }
.tx-pending { background: #fdf1dc; border-color: #f0c987; color: #8a5a14; }
.tx-rejected { background: #fbeaea; border-color: #efb6b6; color: #b23c3c; }
</style>