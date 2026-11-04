<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { DAY_MIN, DAY_START_MIN, toMinutes, toHHMM, momentOf, shortDateRange } from '../utils/bookingTimeHelpers.js'
import { formatTime } from '../utils/bookingHelpers.js'

const from = defineModel('from', { type: String, default: '' })
const to = defineModel('to', { type: String, default: '' })
// optional hours for every day in the range, e.g. '09:00' and '17:00' ('' = any time)
const timeFrom = defineModel('timeFrom', { type: String, default: '' })
const timeTo = defineModel('timeTo', { type: String, default: '' })

const showDatePicker = ref(false)
const dateRangeButton = ref(null)
const availabilityPicker = ref(null)
const pickerPosition = ref({ top: '8px', left: '8px' })
const draftFrom = ref('')
const draftTo = ref('')
const draftTimeFrom = ref('')
const draftTimeTo = ref('')
const now = ref(Date.now()) // updated each time the popup opens, so passed times drop out
const calendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const todayKey = dateKey(new Date())

const calendarTitle = computed(() => calendarMonth.value.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }))
const calendarWeeks = computed(() => {
  const year = calendarMonth.value.getFullYear()
  const month = calendarMonth.value.getMonth()
  const days = []
  const offset = new Date(year, month, 1).getDay()
  for (let i = 0; i < offset; i++) days.push(null)
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
    days.push({ key: dateKey(new Date(year, month, day)), day })
  }
  while (days.length % 7) days.push(null)
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7))
})
// button text once confirmed, line 1: '4 – 5 Nov', '28 Nov – 2 Dec' or '4 Nov' (year only if not this year)
const dateRangeLabel = computed(() => {
  if (!from.value) return 'Select dates'
  if (!to.value) return `${shortDateRange(from.value, from.value)} – choose end date`
  return shortDateRange(from.value, to.value)
})
// line 2: '9:00 am – 5:00 pm each day' ('each day' dropped for one day), or 'Any time' when no hours were picked
const timeRangeLabel = computed(() => {
  if (!timeFrom.value || !timeTo.value) return 'Any time'
  return `${formatTime(timeFrom.value)} – ${formatTime(timeTo.value)}${from.value !== to.value ? ' each day' : ''}`
})

// From: half hours 7:00 am to 11:30 pm. If the first day is today, only times later than now (passed times can't be picked)
const fromTimeOptions = computed(() => {
  const list = []
  for (let m = DAY_START_MIN; m < DAY_MIN; m += 30) {
    if (draftFrom.value && momentOf(draftFrom.value, m) <= now.value) continue
    list.push(toHHMM(m))
  }
  return list
})
// Until: starts 30 minutes after From (or after the first From option), up to 12:00 am ('24:00')
const untilTimeOptions = computed(() => {
  const first = draftTimeFrom.value || fromTimeOptions.value[0]
  if (!first) return []
  const list = []
  for (let m = toMinutes(first) + 30; m <= DAY_MIN; m += 30) list.push(toHHMM(m))
  return list
})
// a chosen time that is no longer in its list (new day picked, or From moved past Until) is cleared
watch([fromTimeOptions, untilTimeOptions], () => {
  if (draftTimeFrom.value && !fromTimeOptions.value.includes(draftTimeFrom.value)) draftTimeFrom.value = ''
  if (draftTimeTo.value && !untilTimeOptions.value.includes(draftTimeTo.value)) draftTimeTo.value = ''
})
// only one of From / Until picked
const halfTime = computed(() => Boolean(draftTimeFrom.value) !== Boolean(draftTimeTo.value))

function changeCalendarMonth(offset) {
  calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() + offset, 1)
}
function pickAvailabilityDate(date) {
  if (!date || date < todayKey) return
  if (!draftFrom.value || draftTo.value || date < draftFrom.value) {
    draftFrom.value = date
    draftTo.value = ''
    return
  }
  draftTo.value = date
}
function isInSelectedRange(date) {
  return Boolean(date && draftFrom.value && draftTo.value && date >= draftFrom.value && date <= draftTo.value)
}
function confirmAvailabilityDates() {
  if (!draftFrom.value || !draftTo.value || halfTime.value) return
  from.value = draftFrom.value
  to.value = draftTo.value
  timeFrom.value = draftTimeFrom.value
  timeTo.value = draftTimeTo.value
  showDatePicker.value = false
}
function clearAvailabilityDates() {
  draftFrom.value = ''
  draftTo.value = ''
  draftTimeFrom.value = ''
  draftTimeTo.value = ''
  from.value = ''
  to.value = ''
  timeFrom.value = ''
  timeTo.value = ''
}
function toggleDatePicker() {
  if (!showDatePicker.value) {
    now.value = Date.now()
    draftFrom.value = from.value
    draftTo.value = to.value
    draftTimeFrom.value = timeFrom.value
    draftTimeTo.value = timeTo.value
  }
  showDatePicker.value = !showDatePicker.value
}

function positionPicker() {
  const button = dateRangeButton.value
  const picker = availabilityPicker.value
  if (!button || !picker) return

  const buttonRect = button.getBoundingClientRect()
  const gap = 8
  const width = Math.min(picker.offsetWidth, window.innerWidth - gap * 2)
  const height = picker.offsetHeight
  const left = Math.max(gap, Math.min(buttonRect.left, window.innerWidth - width - gap))
  const roomBelow = window.innerHeight - buttonRect.bottom - gap
  const top = roomBelow >= height + gap
    ? buttonRect.bottom + gap
    : Math.max(gap, buttonRect.top - height - gap)

  pickerPosition.value = { top: `${top}px`, left: `${left}px`, width: `${width}px` }
}

// clicking outside the picker (and its button) closes it
function closeOnOutsideClick(e) {
  if (availabilityPicker.value?.contains(e.target) || dateRangeButton.value?.contains(e.target)) return
  showDatePicker.value = false
}

function removePositionListeners() {
  window.removeEventListener('resize', positionPicker)
  window.removeEventListener('scroll', positionPicker, true)
  document.removeEventListener('pointerdown', closeOnOutsideClick)
}

watch(showDatePicker, async (isOpen) => {
  if (!isOpen) {
    removePositionListeners()
    return
  }

  await nextTick()
  if (!showDatePicker.value) return
  positionPicker()
  window.addEventListener('resize', positionPicker)
  window.addEventListener('scroll', positionPicker, true)
  document.addEventListener('pointerdown', closeOnOutsideClick)
}, { flush: 'post' })

// parent's "Clear filters" resets from/to; keep the drafts in step
watch([from, to, timeFrom, timeTo], ([f, t, tf, tt]) => { draftFrom.value = f; draftTo.value = t; draftTimeFrom.value = tf; draftTimeTo.value = tt })

onBeforeUnmount(removePositionListeners)
</script>

<template>
  <div>
    <label class="form-label fw-bold">Available dates</label>
    <div class="position-relative mb-3">
        <!-- paste your existing toggle button + v-if="showDatePicker" popup markup here, unchanged -->
        <button ref="dateRangeButton" type="button" class="form-control text-start d-flex justify-content-between align-items-center" aria-haspopup="dialog" :aria-expanded="showDatePicker" @click="toggleDatePicker">
            <span class="range-label me-2">
                <span class="range-dates">{{ dateRangeLabel }}</span>
                <span v-if="from && to" class="range-time" :title="timeRangeLabel">{{ timeRangeLabel }}</span>
            </span>
            <span aria-hidden="true">▦</span>
        </button>
        <!-- show date calandar to pick date  -->
        <Teleport to="body">
        <div v-if="showDatePicker" ref="availabilityPicker" :style="pickerPosition" class="availability-picker shadow bg-white border rounded p-3" role="dialog" aria-label="Choose available date range">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <button type="button" class="btn btn-sm btn-outline-secondary" aria-label="Previous month" @click="changeCalendarMonth(-1)">‹</button>
                <strong>{{ calendarTitle }}</strong>
                <button type="button" class="btn btn-sm btn-outline-secondary" aria-label="Next month" @click="changeCalendarMonth(1)">›</button>
            </div>
            <div class="availability-calendar">
                <span v-for="weekday in ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']" :key="weekday" class="weekday">{{ weekday }}</span>
                <template v-for="(week, weekIndex) in calendarWeeks" :key="weekIndex">
                <span v-for="(date, dayIndex) in week" :key="date?.key || `blank-${weekIndex}-${dayIndex}`" class="day-cell"
                :class="{
                    'range-cell': isInSelectedRange(date?.key),
                    'range-start': date && draftFrom && draftTo && draftFrom !== draftTo && date.key === draftFrom,
                    'range-end': date && draftFrom && draftTo && draftFrom !== draftTo && date.key === draftTo
                }">
                    <button v-if="date" type="button" class="calendar-day" :class="{ endpoint: date.key === draftFrom || date.key === draftTo }" :disabled="date.key < todayKey" @click="pickAvailabilityDate(date.key)">{{ date.day }}</button>
                </span>
                </template>
            </div>
            <!-- optional hours, the same for every day in the range -->
            <div class="time-row">
                <div>
                    <label class="form-label small fw-bold mb-1" for="filter-time-from">From</label>
                    <select id="filter-time-from" v-model="draftTimeFrom" class="form-select form-select-sm">
                        <option value="">Any time</option>
                        <option v-for="t in fromTimeOptions" :key="t" :value="t">{{ formatTime(t) }}</option>
                    </select>
                </div>
                <div>
                    <label class="form-label small fw-bold mb-1" for="filter-time-to">Until</label>
                    <select id="filter-time-to" v-model="draftTimeTo" class="form-select form-select-sm">
                        <option value="">Any time</option>
                        <option v-for="t in untilTimeOptions" :key="t" :value="t">{{ formatTime(t) }}</option>
                    </select>
                </div>
            </div>
            <p class="small text-secondary mt-1 mb-0">
                {{ halfTime ? 'Pick both From and Until, or leave both on Any time.' : 'Optional. Hours apply to every day in the range.' }}
            </p>
            <div class="d-flex justify-content-between align-items-center mt-3">
                <button type="button" class="btn btn-outline-secondary btn-sm" @click="clearAvailabilityDates">Clear days</button>
                <button type="button" class="btn btn-brand btn-sm apply-days" :disabled="!draftFrom || !draftTo || halfTime" @click="confirmAvailabilityDates">Confirm dates</button>
            </div>
        </div>
        </Teleport>
    </div>
    
  </div>
</template>

<style scoped>
/* paste .availability-picker, .availability-calendar, .weekday, .day-cell*, .calendar-day* here */

.availability-picker {
  position: fixed;
  z-index: 1080;
  width: 300px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  font-family: Roboto, system-ui, -apple-system, sans-serif;
}

.availability-calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 4px;
  text-align: center;
}

/* MO TU WE ... headers */
.weekday {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #3c3c3c;
  padding-bottom: 8px;
}

.day-cell {
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Light orange range band; start/end rules must stay below range-cell. */
.day-cell.range-cell  { background: #fff0e3; }
.day-cell.range-start { background: linear-gradient(to right, transparent 50%, #fff0e3 50%); }
.day-cell.range-end   { background: linear-gradient(to right, #fff0e3 50%, transparent 50%); }

.calendar-day {
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  font-size: 15px;
  color: #333;
  cursor: pointer;
}
.calendar-day:hover:not(:disabled) { background: #fce2cf; }

/* past dates: grey + strikethrough */
.calendar-day:disabled {
  color: #c8c8c8;
  text-decoration: line-through;
  cursor: default;
}

/* Selected endpoints: solid light orange circles. */
.calendar-day.endpoint,
.calendar-day.endpoint:hover {
  background: #c46b17;
  color: white;
  font-weight: 700;
}

/* button text once confirmed: dates on top, hours underneath in grey */
.range-label {
  display: flex;
  flex-direction: column;
  min-width: 0; /* lets the lines shrink and end in "..." instead of wrapping */
  line-height: 1.3;
}
.range-dates,
.range-time {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.range-time { font-size: 0.85em; color: #6c757d; }

/* From / Until dropdowns under the calendar */
.time-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

</style>
