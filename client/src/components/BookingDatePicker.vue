<script setup>
import { ref, computed, watch } from 'vue'
import { formatTime } from '../utils/bookingHelpers.js'
import {
  DAY_MIN,
  SLOT_MS,
  toDateString,
  prettyDate,
  toMinutes,
  toHHMM,
  momentOf,
  isBusy,
  slotFree,
  dayHasFreeSlot
} from '../utils/bookingTimeHelpers.js'

// The calendar + time dropdowns for choosing when a booking starts and ends.
// The page gives it the sitter's days and booked times (props), and it tells the page
// what the owner chose (the 'change' event).
const props = defineProps({
  availability: { type: Object, required: true }, // { '2026-10-20': 'available' | 'blocked' }
  busy: { type: Array, required: true } // times the sitter is already booked: [{ start, end }] as moments
})
const emit = defineEmits(['change'])
// lets BookingDatePicker.vue send a custom event named "change" to its parent component.

const today = toDateString(new Date())

// What the owner has chosen so far
const startDate = ref('') // 'YYYY-MM-DD'
const startTime = ref('') // '09:00'
const endDate = ref('')
const endTime = ref('') // '17:30' (or '24:00' = end of the day)

// The month shown in the calendar picker
const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth()) // 0 = January
const monthName = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })
)
function changeMonth(step) {
  const d = new Date(viewYear.value, viewMonth.value + step, 1)
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
}
// The month as rows of 7 slots (empty slots are null), like the sitter's calendar
const weeks = computed(() => {
  const firstWeekday = new Date(viewYear.value, viewMonth.value, 1).getDay() // 0 = Sunday
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  const days = []
  for (let i = 0; i < firstWeekday; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, date: toDateString(new Date(viewYear.value, viewMonth.value, d)) })
  }
  while (days.length % 7 !== 0) days.push(null)
  const result = []
  for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7))
  return result
})

// While picking the END day: the last day the booking can reach before it would run into
// a day the sitter isn't available, or into a day they are already booked.
const lastEndDate = computed(() => {
  if (!startDate.value) return ''
  let last = startDate.value
  const d = new Date(startDate.value + 'T00:00:00')
  for (let i = 0; i < 90; i++) {
    d.setDate(d.getDate() + 1) // look at the next day
    const day = toDateString(d)
    if (props.availability[day] !== 'available') break // not available: can't go any further
    const dayStart = momentOf(day, 0)
    if (!isBusy(props.busy, dayStart, momentOf(day, DAY_MIN))) {
      last = day // a completely free day: fine, keep going
      continue
    }
    if (!isBusy(props.busy, dayStart, dayStart + SLOT_MS)) last = day // booked later that day: the booking can still end that morning
    break // but it can't go past a booked day
  }
  return last
})

// Greyed-out days: past days, days the sitter isn't available, days with no free time left,
// and (once a start day is picked) days beyond the point where the booking would run into a clash.
function dayDisabled(date) {
  if (startDate.value && !endDate.value && date >= startDate.value) {
    return date > lastEndDate.value // picking the end day: everything from the start to the limit is fine
  }
  return !(date >= today && props.availability[date] === 'available' && dayHasFreeSlot(props.busy, date))
}

// makes sure the startdate,endate , starttime and endtime are logical 
function inRange(date) {
  return Boolean(startDate.value && endDate.value && date >= startDate.value && date <= endDate.value)
}

// assigns the values to the ref variables for the date and time the user picks 
function pickDay(date) {
  if (dayDisabled(date)) return
  if (!startDate.value || endDate.value || date < startDate.value) {
    // first click (or starting again): this is the start day
    startDate.value = date
    endDate.value = ''
    startTime.value = ''
    endTime.value = ''
  } else {
    endDate.value = date // second click: the end day (the same day is fine)
  }
}
function clearDates() {
  startDate.value = ''
  endDate.value = ''
  startTime.value = ''
  endTime.value = ''
}

// The Start time dropdown: every 30-minute slot of the start day. Booked or passed slots are greyed out.
const startSlots = computed(() => {
  if (!startDate.value) return []
  const list = []
  for (let m = 0; m < DAY_MIN; m += 30) {
    const free = slotFree(props.busy, startDate.value, m)
    const note = free ? '' : momentOf(startDate.value, m) <= Date.now() ? ' (passed)' : ' (booked)'
    list.push({ value: toHHMM(m), label: formatTime(toHHMM(m)) + note, disabled: !free })
  }
  return list
})
// The End time dropdown: slots on the end day. Greyed out if it's not after the start,
// or if the booking from the chosen start would run into a time the sitter is booked.
const endSlots = computed(() => {
  if (!startDate.value || !endDate.value || !startTime.value) return []
  const startMs = momentOf(startDate.value, toMinutes(startTime.value))
  const list = []
  for (let m = 30; m <= DAY_MIN; m += 30) {
    const value = m === DAY_MIN ? '24:00' : toHHMM(m) // 24:00 = the end of the day
    const endMs = momentOf(endDate.value, m)
    const afterStart = endMs > startMs
    const free = afterStart && !isBusy(props.busy, startMs, endMs)
    const note = (value === '24:00' ? ' (end of day)' : '') + (afterStart && !free ? ' (booked)' : '')
    list.push({ value, label: formatTime(value) + note, disabled: !free })
  }
  return list
})
// If the start changes and the chosen end time is no longer allowed, clear it
watch([startTime, endDate], () => {
  const chosen = endSlots.value.find((slot) => slot.value === endTime.value)
  if (!chosen || chosen.disabled) endTime.value = ''
})

// Safety net: with everything chosen, does the booking run into a booked time? (The greying should stop this.)
const clash = computed(() => {
  if (!startDate.value || !endDate.value || !startTime.value || !endTime.value) return false
  return isBusy(
    props.busy,
    momentOf(startDate.value, toMinutes(startTime.value)),
    momentOf(endDate.value, toMinutes(endTime.value))
  )
})

// Tell the page whenever the choice changes (immediately too, so it starts with the empty choice)
watch(
  () => ({
    startDate: startDate.value,
    startTime: startTime.value,
    endDate: endDate.value,
    endTime: endTime.value,
    clash: clash.value
  }),
  (choice) => emit('change', choice), //sends a custom event called change back to the parent 
  { immediate: true }
)
</script>

<template>
  <!-- Dates: pick a start day, then an end day (greyed-out days can't be picked) -->
  <h3 class="h6 text-uppercase text-muted fw-bold">Dates</h3>
  <div class="mb-2">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <button type="button" class="btn btn-outline-secondary btn-sm" @click="changeMonth(-1)">‹</button>
      <span class="fw-semibold">{{ monthName }}</span>
      <button type="button" class="btn btn-outline-secondary btn-sm" @click="changeMonth(1)">›</button>
    </div>
    <div class="rgrid">
      <div v-for="name in ['S', 'M', 'T', 'W', 'T', 'F', 'S']" class="text-center small text-muted fw-semibold">{{ name }}</div>
      <template v-for="week in weeks">
        <template v-for="d in week">
          <div v-if="!d"></div>
          <button
            v-else
            type="button"
            class="rday"
            :class="{ start: d.date === startDate, end: d.date === endDate, inrange: inRange(d.date) }"
            :disabled="dayDisabled(d.date)"
            @click="pickDay(d.date)"
          >
            {{ d.day }}
          </button>
        </template>
      </template>
    </div>
  </div>
  <p class="small text-muted mb-3">
    <template v-if="!startDate">Pick a start day. Greyed-out days can't be chosen.</template>
    <template v-else-if="!endDate">Start: <strong>{{ prettyDate(startDate) }}</strong>. Now pick an end day (the same day is fine).</template>
    <template v-else><strong>{{ prettyDate(startDate) }}</strong> to <strong>{{ prettyDate(endDate) }}</strong></template>
    <button v-if="startDate" type="button" class="btn btn-link btn-sm p-0 ms-2" @click="clearDates">Clear</button>
  </p>

  <!-- Times: every 30 minutes; booked times are greyed out. For a whole day choose 12:00 am to 12:00 am (end of day). -->
  <div class="row g-2">
    <div class="col-sm-6">
      <label class="form-label small" for="start-time">Start time</label>
      <select id="start-time" v-model="startTime" class="form-select" :disabled="!startDate">
        <option value="" disabled>{{ startDate ? 'Choose a time' : 'Pick a start day first' }}</option>
        <option v-for="slot in startSlots" :key="slot.value" :value="slot.value" :disabled="slot.disabled">{{ slot.label }}</option>
      </select>
    </div>
    <div class="col-sm-6">
      <label class="form-label small" for="end-time">End time</label>
      <select id="end-time" v-model="endTime" class="form-select" :disabled="!endDate || !startTime">
        <option value="" disabled>{{ !endDate ? 'Pick an end day first' : !startTime ? 'Choose a start time first' : 'Choose a time' }}</option>
        <option v-for="slot in endSlots" :key="slot.value" :value="slot.value" :disabled="slot.disabled">{{ slot.label }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.rgrid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.rday {
  height: 2.8rem; /* the calendar stretches the full width; each day keeps a fixed height */
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
}
.rday:disabled { /* greyed out: can't be picked */
  background: #f1f1f1;
  color: #aaa;
  cursor: not-allowed;
}
.rday.inrange { background: #fbeee4; border-color: #e8cdb9; }
.rday.start, .rday.end { background: #2b2420; border-color: #2b2420; color: #fff; }
</style>
