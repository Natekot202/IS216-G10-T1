<script setup>
// /bookings/:id/pay (owner): pay for a booking AFTER the sitter has completed it.
// Simulated card payment (VISA / Mastercard). No real money moves.
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { bookingsApi } from '../services/bookingApi.js'
import { paymentsApi } from '../services/paymentApi.js'
import { petNames, formatDateRange, formatPrice } from '../utils/bookingHelpers.js'

const route = useRoute()

const booking = ref(null)
const loading = ref(true)
const loadError = ref('')

const form = ref({ name: '', cardNumber: '', expiry: '', cvc: '' })
const paying = ref(false)
const payError = ref('')
const receipt = ref(null) // the successful payment, once paid

// Hours booked, from start date + time to end date + time (no times = all day)
const hours = computed(() => {
  const b = booking.value
  if (!b) return 0
  const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  const dayGap = Math.round((new Date(b.endDate) - new Date(b.startDate)) / 86400000)
  const minutes = dayGap * 24 * 60 + toMinutes(b.endTime || '24:00') - toMinutes(b.startTime || '00:00')
  return minutes / 60
})
const ratePerHour = computed(() => (hours.value ? booking.value.totalPrice / hours.value : 0))

// The card number without spaces, and its brand (same rule as the server)
const digits = computed(() => form.value.cardNumber.replace(/\D/g, ''))
const brand = computed(() => {
  const d = digits.value
  if (d.startsWith('4')) return 'visa'
  const firstTwo = Number(d.slice(0, 2))
  const firstFour = Number(d.slice(0, 4))
  if ((firstTwo >= 51 && firstTwo <= 55) || (d.length >= 4 && firstFour >= 2221 && firstFour <= 2720)) return 'mastercard'
  return null
})

function brandLabel(b) {
  return b === 'visa' ? 'VISA' : b === 'mastercard' ? 'Mastercard' : 'Card'
}

// Keep the inputs tidy while typing.
// We also write the value back into the box, so a typed letter disappears straight away.
function onCardInput(e) {
  const tidy = e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ') // "4242 4242 …"
  form.value.cardNumber = tidy
  e.target.value = tidy
}
function onExpiryInput(e) {
  const d = e.target.value.replace(/\D/g, '').slice(0, 4)
  const tidy = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d // "1228" -> "12/28"
  form.value.expiry = tidy
  e.target.value = tidy
}
function onCvcInput(e) {
  const tidy = e.target.value.replace(/\D/g, '').slice(0, 3)
  form.value.cvc = tidy
  e.target.value = tidy
}

onMounted(async () => {
  try {
    booking.value = await bookingsApi.getOne(route.params.id)
    if (booking.value.status === 'paid') {
      loadError.value = 'This booking has already been paid. Thank you!'
    } else if (booking.value.status !== 'completed') {
      loadError.value = 'You can pay once the sitter has completed this booking.'
    }
  } catch (err) {
    loadError.value = err.response?.data?.message || 'Could not load this booking.'
  } finally {
    loading.value = false
  }
})

async function pay() {
  payError.value = ''
  // Quick checks here for friendly messages (the server checks everything again)
  if (!form.value.name.trim()) return (payError.value = 'Enter the name on the card.')
  if (digits.value.length !== 16) return (payError.value = 'Card number must be 16 digits.')
  if (!brand.value) return (payError.value = 'Only VISA and Mastercard are accepted.')
  if (!/^\d{2}\/\d{2}$/.test(form.value.expiry)) return (payError.value = 'Expiry must be MM/YY.')
  if (form.value.cvc.length !== 3) return (payError.value = 'CVC must be 3 digits.')

  paying.value = true
  try {
    const result = await paymentsApi.pay({
      bookingId: booking.value._id,
      cardNumber: digits.value,
      expiry: form.value.expiry,
      cvc: form.value.cvc
    })
    receipt.value = result.payment
    booking.value.status = 'paid'
  } catch (err) {
    payError.value = err.response?.data?.message || 'Payment failed. Please try again.'
  } finally {
    paying.value = false
  }
}
</script>

<template>
  <router-link to="/owner/bookings?tab=to-pay" class="text-secondary text-decoration-none">&larr; Back to My Bookings</router-link>
  <h2 class="mt-3 mb-4">Payment</h2>

  <div v-if="loading" class="text-muted">Loading booking…</div>

  <div v-else-if="loadError" class="alert alert-warning">{{ loadError }}</div>

  <!-- Paid -->
  <div v-else-if="receipt" class="card shadow-sm pay-card text-center p-4 mx-auto success-card">
    <div class="display-6 mb-2">✅</div>
    <h4 class="mb-2">Payment successful</h4>
    <p class="text-muted mb-1">
      {{ formatPrice(receipt.amount) }} paid with {{ brandLabel(receipt.method) }} •••• {{ receipt.cardLast4 }}
    </p>
    <p class="text-muted small mb-4">Thank you! Your sitter has been paid.</p>
    <router-link to="/owner/bookings?tab=past" class="btn btn-brand">Back to My Bookings</router-link>
  </div>

  <div v-else class="row g-4">
    <!-- Booking summary (on the right on laptops, on top on phones) -->
    <div class="col-12 col-lg-5 order-lg-2">
      <div class="card shadow-sm pay-card">
        <div class="card-body">
          <h3 class="h6 text-uppercase text-muted fw-bold mb-3">Booking summary</h3>
          <dl class="row small mb-0">
            <dt class="col-4">Sitter</dt>
            <dd class="col-8">{{ booking.sitterId?.username }}</dd>
            <dt class="col-4">Pets</dt>
            <dd class="col-8">{{ petNames(booking) }}</dd>
            <dt class="col-4">When</dt>
            <dd class="col-8">{{ formatDateRange(booking.startDate, booking.endDate, booking.startTime, booking.endTime) }}</dd>
            <dt class="col-4">Hours</dt>
            <dd class="col-8">{{ hours }}</dd>
            <dt class="col-4">Rate</dt>
            <dd class="col-8">{{ formatPrice(ratePerHour) }}/hr</dd>
          </dl>
          <hr />
          <div class="d-flex justify-content-between fw-bold fs-5">
            <span>Total</span><span>{{ formatPrice(booking.totalPrice) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Card form -->
    <div class="col-12 col-lg-7 order-lg-1">
      <div class="card shadow-sm pay-card">
        <div class="card-body">
          <h3 class="h6 text-uppercase text-muted fw-bold mb-3">Card details</h3>
          <div v-if="payError" class="alert alert-danger py-2">{{ payError }}</div>

          <form novalidate @submit.prevent="pay">
            <label for="card-name" class="form-label">Name on card</label>
            <input id="card-name" v-model="form.name" class="form-control mb-3" autocomplete="cc-name" placeholder="e.g. Tan Ah Kow" />

            <label for="card-number" class="form-label">Card number</label>
            <div class="input-group mb-3">
              <input
                id="card-number"
                :value="form.cardNumber"
                class="form-control"
                inputmode="numeric"
                autocomplete="cc-number"
                placeholder="1234 5678 9012 3456"
                @input="onCardInput"
              />
              <span class="input-group-text brand-badge" :class="brand ? `brand-${brand}` : ''">{{ brandLabel(brand) }}</span>
            </div>

            <div class="row g-3 mb-4">
              <div class="col-6">
                <label for="card-expiry" class="form-label">Expiry</label>
                <input id="card-expiry" :value="form.expiry" class="form-control" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" @input="onExpiryInput" />
              </div>
              <div class="col-6">
                <label for="card-cvc" class="form-label">CVC</label>
                <input id="card-cvc" :value="form.cvc" class="form-control" inputmode="numeric" autocomplete="cc-csc" placeholder="123" @input="onCvcInput" />
              </div>
            </div>

            <button type="submit" class="btn btn-brand w-100 py-2" :disabled="paying">
              <span v-if="paying" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
              {{ paying ? 'Paying…' : `Pay ${formatPrice(booking.totalPrice)}` }}
            </button>
          </form>

          <div class="test-cards small mt-4">
            <strong>Test cards (no real money):</strong><br />
            4242 4242 4242 4242 (VISA, approved) · 5555 5555 5555 4444 (Mastercard, approved) ·
            4000 0000 0000 0002 (declined). Any future expiry like 12/28 and any 3-digit CVC.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pay-card {
  border: 1px solid #ede3d8;
  border-radius: 12px;
}
.success-card {
  max-width: 480px;
}
.brand-badge {
  min-width: 110px;
  justify-content: center;
  font-weight: 700;
}
.brand-visa {
  color: #1a1f71;
}
.brand-mastercard {
  color: #eb001b;
}
.test-cards {
  background: #fff9f4;
  border: 1px dashed #ede3d8;
  border-radius: 8px;
  padding: 0.75rem;
}
</style>