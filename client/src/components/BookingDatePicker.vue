<script setup>
import { ref, computed, watch } from 'vue'
import { formatTime } from '../utils/bookingHelpers.js'
import {
  DAY_MIN,
  DAY_START_MIN,
  SLOT_MS,
  toDateString,
  prettyDate,
  toMinutes,
  toHHMM,
  momentOf,
  isBusy,
  slotsFor,
  slotsCover,
  slotFree,
  dayHasFreeSlot
} from '../utils/bookingTimeHelpers.js'

// The calendar + time dropdowns for choosing when a booking starts and ends.
// A booking has a start date, an end date, a start time and an end time. The times are the hours for EACH day
// (e.g. 3 Nov to 5 Nov, 9am to 5pm = 9am to 5pm on each of the 3 days), always between 7am and 12am midnight,
// so nothing runs overnight. The first tap on the calendar picks the start date, the second the end date (the same day is fine).
// The page gives it the sitter's days and booked times (props), and it tells the page
// what the owner chose (the 'change' event).
const props = defineProps({
  availability: { type: Object, required: true }, // { '2026-10-20': { status: 'available' | 'blocked', slots: [540, 570, ...] } }
  busy: { type: Array, required: true } // times the sitter is already booked: [{ start, end }] as moments
})
const emit = defineEmits(['change'])
// lets BookingDatePicker.vue send a custom event named "change" to its parent component.

const today = toDateString(new Date())

// start and end date + timing that the owner wants 
const startDate = ref('') // 'YYYY-MM-DD'
const startTime = ref('') // '09:00'
const endDate = ref('')
const endTime = ref('') // '17:30' (or '24:00' = end of the day)

// The month shown in the calendar picker
const viewYear = ref(new Date().getFullYear()) //2026
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

// Every day of the booking, start to end: ['2026-11-03', '2026-11-04', '2026-11-05']
const rangeDays = computed(() => {
  if (!startDate.value || !endDate.value) return []
  const days = []
  const d = new Date(startDate.value + 'T00:00:00')
  const end = new Date(endDate.value + 'T00:00:00')
  while (d <= end) {
    days.push(toDateString(d))
    d.setDate(d.getDate() + 1)
  }
  return days
})

// A day the sitter could do at least part of: available, in the future, with a free half-hour left
function dayOpen(date) {
  return date >= today && props.availability[date]?.status === 'available' && dayHasFreeSlot(props.busy, date, slotsFor(props.availability, date))
}

// While picking the END day: the last day the booking can reach before it would run into
// a day the sitter isn't available at all (the exact hours are checked once the times are chosen).
const lastEndDate = computed(() => {
  if (!startDate.value) return ''
  let last = startDate.value
  const d = new Date(startDate.value + 'T00:00:00')
  for (let i = 0; i < 90; i++) {
    d.setDate(d.getDate() + 1) // look at the next day
    const day = toDateString(d)
    if (!dayOpen(day)) break // not available that day: can't go any further
    last = day
  }
  return last
})

// Greyed-out days: past days, days the sitter isn't available, days with no free time left,
// and (once a start day is picked) days beyond the point where the booking would run into a day the sitter is off.
function dayDisabled(date) {
  if (startDate.value && !endDate.value && date > startDate.value) {
    return date > lastEndDate.value // picking the end day: everything from the start to the limit is fine
  }
  return !dayOpen(date)
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

// The Start time dropdown: every 30-minute slot from 7:00 am to 11:30 pm. A slot is greyed out if,
// on any day of the booking, it has passed, is booked or the sitter isn't free then.
const startSlots = computed(() => {
  if (!rangeDays.value.length) return []
  const list = []
  for (let m = DAY_START_MIN; m < DAY_MIN; m += 30) {
    let note = ''
    for (const day of rangeDays.value) {
      if (slotFree(props.busy, day, m, slotsFor(props.availability, day))) continue
      const startOfSlot = momentOf(day, m)
      note = startOfSlot <= Date.now() ? ' (passed)' : isBusy(props.busy, startOfSlot, startOfSlot + SLOT_MS) ? ' (booked)' : ' (not available)'
      break // one day that doesn't work is enough
    }
    list.push({ value: toHHMM(m), label: formatTime(toHHMM(m)) + note, disabled: note !== '' })
  }
  return list
})
// The End time dropdown: slots from 7:30 am to 12:00 am. Greyed out if it's not after the start time,
// or if on any day of the booking those hours aren't all free, or run into a time the sitter is booked.
const endSlots = computed(() => {
  if (!rangeDays.value.length || !startTime.value) return []
  const startMin = toMinutes(startTime.value)
  const list = []
  for (let m = DAY_START_MIN + 30; m <= DAY_MIN; m += 30) {
    const value = m === DAY_MIN ? '24:00' : toHHMM(m) //when m == 1440, special case, toHHMM doesnt work, assign it 24:00 (which it actl is ) 
    const afterStart = m > startMin
    let busyThen = false
    let hoursOk = true
    for (const day of rangeDays.value) {
      if (!slotsCover(slotsFor(props.availability, day), startMin, m)) hoursOk = false // all of those hours are free hours that day
      if (isBusy(props.busy, momentOf(day, startMin), momentOf(day, m))) busyThen = true
    }
    const free = afterStart && hoursOk && !busyThen // checks wether booking end is aft booking start + person isnt busy during that period 
    const note = (value === '24:00' ? ' (end of day)' : '') + (afterStart && !free ? (busyThen ? ' (booked)' : ' (not available)') : '')
    list.push({ value, label: formatTime(value) + note, disabled: !free }) //disabled =!free ; so if free, will be disabled and greyeded out ; if not wont be 
  }
  return list
})
// If the start changes and the chosen end time is no longer allowed, clear it
watch([startTime, endDate], () => {
  const chosen = endSlots.value.find((slot) => slot.value === endTime.value)
  if (!chosen || chosen.disabled) endTime.value = ''
})

// Safety net: with everything chosen, does any day of the booking run into a booked time? (The greying should stop this.)
const clash = computed(() => {
  if (!rangeDays.value.length || !startTime.value || !endTime.value) return false
  const startMin = toMinutes(startTime.value)
  const endMin = toMinutes(endTime.value)
  return rangeDays.value.some((day) => isBusy(props.busy, momentOf(day, startMin), momentOf(day, endMin)))
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
    <!-- 44px round buttons right beside the month name (same look as the sitter's My Calendar), easy to hit with a thumb -->
    <div class="d-flex justify-content-center align-items-center gap-2 mb-2">
      <button type="button" class="month-btn" aria-label="Previous month" @click="changeMonth(-1)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <span class="month-name">{{ monthName }}</span>
      <button type="button" class="month-btn" aria-label="Next month" @click="changeMonth(1)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>
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
    <template v-if="!startDate">Tap the start date. Greyed-out days can't be chosen.</template>
    <template v-else-if="!endDate">Now tap the end date (tap the same day again for a one-day booking).</template>
    <template v-else>{{ rangeDays.length }} day{{ rangeDays.length === 1 ? '' : 's' }}. Tap a new start date to change.</template>
    <button v-if="startDate" type="button" class="btn btn-link btn-sm p-0 ms-2" @click="clearDates">Clear</button>
  </p>

  <!-- Start date and End date fill in from the taps on the calendar above -->
  <div class="row g-2 mb-2">
    <div class="col-6">
      <label class="form-label small" for="start-date">Start date</label>
      <input id="start-date" class="form-control" readonly :value="startDate ? prettyDate(startDate) : ''" placeholder="Tap a day" />
    </div>
    <div class="col-6">
      <label class="form-label small" for="end-date">End date</label>
      <input id="end-date" class="form-control" readonly :value="endDate ? prettyDate(endDate) : ''" placeholder="Tap the last day" />
    </div>
  </div>

  <!-- Times: the hours for EACH day, every 30 minutes from 7:00 am to 12:00 am; booked times are greyed out. For a whole day choose 7:00 am to 12:00 am (end of day). -->
  <div class="row g-2">
    <div class="col-6">
      <label class="form-label small" for="start-time">Start time (each day)</label>
      <select id="start-time" v-model="startTime" class="form-select" :disabled="!endDate">
        <option value="" disabled>{{ endDate ? 'Choose a time' : 'Pick the dates first' }}</option>
        <option v-for="slot in startSlots" :key="slot.value" :value="slot.value" :disabled="slot.disabled">{{ slot.label }}</option>
      </select>
    </div>
    <div class="col-6">
      <label class="form-label small" for="end-time">End time (each day)</label>
      <select id="end-time" v-model="endTime" class="form-select" :disabled="!endDate || !startTime">
        <option value="" disabled>{{ !endDate ? 'Pick the dates first' : !startTime ? 'Choose a start time first' : 'Choose a time' }}</option>
        <option v-for="slot in endSlots" :key="slot.value" :value="slot.value" :disabled="slot.disabled">{{ slot.label }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.month-btn { /* 44px circle, the size Apple and Google recommend for touch */
  width: 44px;
  height: 44px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1.5px solid #e4dbd0;
  background: #fffdfa;
  color: #2b2420;
}
.month-btn:hover { background: #f3e2d9; border-color: #c44f1c; }
.month-btn svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.month-name { font-weight: 600; min-width: 9.5em; text-align: center; }
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
