<script setup>
import { ref, computed, watch } from 'vue'
import { formatTime } from '../utils/bookingHelpers.js'
import { toDateString, prettyDate } from '../utils/bookingTimeHelpers.js'
import {
  shortTime,
  groupBookingsByDay,
  dayPart,
  chipText,
  isFullyBooked,
  slotBooked,
  canChangeSlot,
  paintedSlots
} from '../utils/availabilityHelpers.js'

// The sitter's calendar: a Month view and a Week view (30-minute rows) showing their free time and bookings.
// The page gives it the data (props). When it is editable, dragging tells the page which day changed
// and what its new free half-hours are (the 'paint' event); the page keeps the unsaved changes.
const props = defineProps({
  saved: { type: Object, required: true }, // what the server has: { '2026-10-20': [540, 570, ...] } ( [] = unavailable )
  changes: { type: Object, default: () => ({}) }, // unsaved changes, same shape
  bookings: { type: Array, required: true }, // accepted / paid / in-progress bookings
  editable: { type: Boolean, default: false }, // false = look only (no dragging)
  highlight: { type: Object, default: null }, // a booking request to point out: { startDate, startTime, endDate, endTime }
  focusDate: { type: String, default: '' }, // 'YYYY-MM-DD': when this changes, the calendar jumps to that day
  selected: { type: String, default: '' } // 'YYYY-MM-DD': the day the page has picked, drawn with a dark outline
})
// 'select' tells the page which day was clicked (the page can ignore it)
const emit = defineEmits(['paint', 'select'])

const now = new Date()
// new Date() automatically creates a JavaScript Date object containing the browser's current local date and time.
// no arguments = date object for today ; Date(year,month,day)-> date object for that day

const today = toDateString(now)
const nowMinutes = now.getHours() * 60 + now.getMinutes() // minutes after midnight right now

const year = ref(now.getFullYear())
const month = ref(now.getMonth())
// getFullyr and getMonth are built in js methods for date objects

const monthName = computed(() =>
  new Date(year.value, month.value, 1).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })
)
// todateString : converts month_number -> month_name
// recalculates the month name automatically when it changes

// The month as a list of weeks. Each week has 7 slots; empty slots are null.
const weeks = computed(() => {
  const firstWeekday = new Date(year.value, month.value, 1).getDay() // .getDay() checks date, returns the specific day as a value e.g. 0 = Sunday, 1 = monday etc
  const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()  // for the date object for the last day of the month, .getDate() returns how many days there are in that month

  const days = []
  for (let i = 0; i < firstWeekday; i++) days.push(null)
  // makes it so the days before the first day fo the month are null ( i.e days that belonged to the previous month )
  for (let d = 1; d <= daysInMonth; d++) days.push({ day: d, date: toDateString(new Date(year.value, month.value, d)) })
  // loops thru every day of the month, so days = [ { day: 1, date: "2026-10-01" },... ]
  while (days.length % 7 !== 0)
    days.push(null) // make sure each week has 7 days
  const result = []
  for (let i = 0; i < days.length; i += 7)
  result.push(days.slice(i, i + 7)) // breaks all the weeks into individual weeks
// weeks = [ [1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14], [15, 16, 17, 18, 19, 20, 21] ]
  return result
})

// Bookings grouped by day: { '2026-11-21': [booking1, booking2,...] }
const bookedDays = computed(() => groupBookingsByDay(props.bookings))

function dayBookings(date) {
  return bookedDays.value[date] || []
}
// returns the actual array of bookings for that date 
// e.g. returns : [booking1, booking2,...]

// The free half-hours of one day: the unsaved change if there is one, else what the server has, else nothing set (null)
function slotsOf(date) {
  return props.changes[date] ?? props.saved[date] ?? null
}
// it checks : 
// 1. props.changes[date] — any unsaved edit the sitter just made 
// 2. props.saved[date] — the availability last loaded from the server/database.
// returns array of all the free hour slots for that day
// e.g. [540,570,990,....]


// What colour a day's square is in the month view
function statusOf(date) {
  if (isFullyBooked(dayBookings(date), date)) return 'booked' // no free time left that day
  if (bookedDays.value[date]) return 'partial' // some bookings, but part of the day is still free
  const slots = slotsOf(date)
  if (slots === null) return 'unset'
  return slots.length ? 'available' : 'blocked'
}
// returns the status of that specific day by checking the bookedDays,changes,saved object
//  if the bookings cover the whole day: 'booked' ; if there are bookings but free time is left: 'partial'
//  else if the day has free half-hours: 'available' ; none: 'blocked' ; never set: 'unset'

// Past days and days with bookings can't be changed as a whole day (month view).
function canChange(date) {
  return date >= today && !bookedDays.value[date]
}
// reutrns true if the date is ahead of today and its not in bookedDays

// ----- Painting: drag across days (month) or half-hours (week) to make them available / unavailable -----
const mode = ref('available') // what dragging does: 'available' | 'blocked'
const painting = ref(false) // true while the mouse button is held down

// Works out the day's new free half-hours and tells the page (nothing is sent if nothing would change)
function paintRange(date, startMinutes, endMinutes, on) {
  const list = paintedSlots(slotsOf(date), date, startMinutes, endMinutes, on, dayBookings(date), today, nowMinutes)
  if (list) emit('paint', date, list)
}
// slotsOf(date)-> gets the avail slots for that day, including booked slots e.g. [480, 510, 540, 570]
// dayBookings(date) -> the bookings on that day e.g. [ {  startDate: '2026-10-23',  startTime: '10:00', endDate: '2026-10-23',  endTime: '11:00' } ]
// date -> which day are we changing, startMinutes, endMinutes → what time range are we painting?
// on -> make avail/unavail ? 
//  takes in : today -> current date, to check wether the slot is in the past 
// nowMinutes -> time in milliseconds from 1970 ; if the nowMinutes is greater than the time we're trying to edit, this means 
// the time we're trying to edit is already over, so shdnt be able to edit 




// Month view: press on a day, then drag across more days (the whole day is set)
// props not editable when parent renders calendar in view only mode, e.g. for owner to see sitter avialability
function startDayPaint(date) {
  emit('select', date)
  if (!props.editable || !canChange(date)) return
  painting.value = true
  paintDay(date) //to paint that first day itself 
}

// 
function paintDay(date) {
  if (painting.value && canChange(date)) paintRange(date, 0, 24 * 60, mode.value === 'available')
}
  

// Week view: press on a half-hour, then drag across more half-hours (a row or a column)
function startSlotPaint(date, m) {
  emit('select', date)
  if (!props.editable) return
  painting.value = true
  paintSlot(date, m)
}
function paintSlot(date, m) {
  if (painting.value) paintRange(date, m, m + 30, mode.value === 'available')
}
function stopPainting() {
  painting.value = false
}

// Month view: click S M T W... to set every day of that weekday in the shown month
function paintWeekday(weekday) {
  if (!props.editable) return
  for (const week of weeks.value) {
    const d = week[weekday]
    if (d && canChange(d.date)) paintRange(d.date, 0, 24 * 60, mode.value === 'available')
  }
}

// ----- Month / week view and moving around -----
const view = ref('month') // 'month' | 'week'
const weekStart = ref(startOfWeek(now)) // the Sunday that starts the week shown in the week view

function startOfWeek(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay())
}
const weekDays = computed(() => {
  const list = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.value.getFullYear(), weekStart.value.getMonth(), weekStart.value.getDate() + i)
    list.push({
      date: toDateString(d),
      name: d.toLocaleDateString('en-SG', { weekday: 'short' }),
      day: d.getDate()
    })
  }
  return list
})
const title = computed(() => {
  if (view.value === 'month') return monthName.value
  return `${prettyDate(weekDays.value[0].date)} – ${prettyDate(weekDays.value[6].date)}`
})

// The week view shows 6 am to 10 pm in half-hour rows
const FIRST_MIN = 6 * 60
const LAST_MIN = 22 * 60
const ROW_PX = 22 // height of one half-hour row
const rows = []
for (let m = FIRST_MIN; m < LAST_MIN; m += 30) rows.push(m)

// Where a booking sits in a day column of the week view: top and height in pixels
function blockStyle(b, date) {
  const [startMinutes, endMinutes] = dayPart(b, date)
  const top = ((Math.max(startMinutes, FIRST_MIN) - FIRST_MIN) / 30) * ROW_PX
  const height = ((Math.min(endMinutes, LAST_MIN) - Math.max(startMinutes, FIRST_MIN)) / 30) * ROW_PX
  return { top: top + 1 + 'px', height: Math.max(height - 2, 4) + 'px' }
}

function move(step) {
  if (view.value === 'month') {
    const d = new Date(year.value, month.value + step, 1)
    year.value = d.getFullYear()
    month.value = d.getMonth()
  } else {
    const w = weekStart.value
    weekStart.value = new Date(w.getFullYear(), w.getMonth(), w.getDate() + step * 7)
  }
}
function goTo(date) {
  const d = new Date(date + 'T00:00:00')
  year.value = d.getFullYear()
  month.value = d.getMonth()
  weekStart.value = startOfWeek(d)
}
function goToday() {
  goTo(today)
}
// when the page asks for a day (e.g. a booking request was picked), jump there
watch(() => props.focusDate, (date) => date && goTo(date))

// ----- A booking request the page wants to point out -----
function inHighlight(date) {
  return Boolean(props.highlight && date >= props.highlight.startDate && date <= props.highlight.endDate)
}

// ----- The card that appears next to the mouse when it is over a booking -----
const hovered = ref(null) // { booking, left, top }
const CARD_W = 236 // width of the card
const CARD_H = 190 // roughly how tall it is

// Puts the card just right of the mouse, or to its left / above if there is no room
function placeCard(event) {
  const left = event.clientX + 14 + CARD_W > window.innerWidth ? event.clientX - 14 - CARD_W : event.clientX + 14
  const top = event.clientY + 14 + CARD_H > window.innerHeight ? event.clientY - 14 - CARD_H : event.clientY + 14
  return { left, top }
}
function showBooking(b, event) {
  hovered.value = { booking: b, ...placeCard(event) }
}
// b-> booking object currently under the mouse 
// event -> e browser mouse event, which includes the cursor’s position.
// hovered.value = { booking: b,left: 820, top: 300} (rmb the ...{} js creates a copy)
// now that hovered.value!=nth, v-if hovered in the template = true, so the booking card is rendered 

function moveCard(event) { // the card follows the mouse while it moves over the booking
  if (hovered.value) hovered.value = { ...hovered.value, ...placeCard(event) }
}
// hovered.value -> checks if card is currently visible 
// if the card is visible, when the mouse moves, runs placecard agan to find new position of mouse, so that we can position the card correctly 

function hideBooking() {
  hovered.value = null
}
// changes hovered.value to null so it isnt rendered
</script>

<template>
  <!-- mouseup anywhere ends a drag, even if the mouse is let go outside the calendar -->
  <div class="avail-cal" @mouseup="stopPainting" @mouseleave="stopPainting">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div class="d-flex align-items-center gap-2">
        <button type="button" class="btn btn-outline-secondary btn-sm" aria-label="Previous" @click="move(-1)">‹</button>
        <button type="button" class="btn btn-outline-secondary btn-sm" @click="goToday">Today</button>
        <button type="button" class="btn btn-outline-secondary btn-sm" aria-label="Next" @click="move(1)">›</button>
        <h2 class="cal-title mb-0 ms-1">{{ title }}</h2>
      </div>
      <div class="d-flex flex-wrap align-items-center gap-3">
        <div class="btn-group btn-group-sm" role="group" aria-label="Calendar view">
          <button type="button" class="btn" :class="view === 'month' ? 'btn-accent' : 'btn-outline-secondary'" @click="view = 'month'">Month</button>
          <button type="button" class="btn" :class="view === 'week' ? 'btn-accent' : 'btn-outline-secondary'" @click="view = 'week'">Week</button>
        </div>
        <div v-if="editable" class="d-flex align-items-center gap-2 small text-muted">
          Drag to
          <div class="btn-group btn-group-sm" role="group" aria-label="What dragging does">
            <button type="button" class="btn" :class="mode === 'available' ? 'btn-accent' : 'btn-outline-secondary'" @click="mode = 'available'">Make available</button>
            <button type="button" class="btn" :class="mode === 'blocked' ? 'btn-accent' : 'btn-outline-secondary'" @click="mode = 'blocked'">Make unavailable</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Month view -->
    <div v-if="view === 'month'" class="calendar">
      <button
        v-for="(name, i) in ['S', 'M', 'T', 'W', 'T', 'F', 'S']"
        :key="i"
        type="button"
        class="weekday"
        :disabled="!editable"
        :title="editable ? 'Set every day of this weekday this month' : ''"
        @click="paintWeekday(i)"
      >
        {{ name }}
      </button>
      <template v-for="week in weeks">
        <template v-for="d in week">
          <div v-if="!d"></div>
          <div
            v-else
            class="day"
            :class="[statusOf(d.date), {
              past: d.date < today,
              today: d.date === today,
              asked: inHighlight(d.date),
              selected: d.date === selected,
              unsaved: changes[d.date] }]"
            @mousedown.prevent="startDayPaint(d.date)"
            @mouseenter="paintDay(d.date)"
          >
          <!-- 
          @mousedown.prevent="startDayPaint(d.date)" -> @mousedown listens for mouse being pressed on that element, 
          .prevent is to stop default browser behaviour, which might interfere with the painting 
        
          @mouseenter -> fires when the pointer moves into an element 

          so initially, when person clicks into first square, @mousedown fires, : 
          startDayPaint fires, painting.value = true 

          then when person drags their cursor through more squares, for each new square,
          @mouseenter fires, paintDay for that date fires, 
          

          -->

            <span class="num">{{ d.day }}</span>
            <!-- up to 2 bookings written inside the square, then "+N more"; hover one for its details -->
            <span
              v-for="b in dayBookings(d.date).slice(0, 2)"
              :key="b._id"
              class="chip"
              @mouseenter="showBooking(b, $event)"
              @mousemove="moveCard"
              @mouseleave="hideBooking"
            >
              <span class="chip-text">{{ chipText(b, d.date) }}</span>
            </span>
            <span v-if="dayBookings(d.date).length > 2" class="more">+{{ dayBookings(d.date).length - 2 }} more</span>
          </div>
        </template>
      </template>
    </div>

    <!-- Week view: one column per day, one row per half-hour -->
    <div v-else class="week">
      <div></div>
      <div v-for="d in weekDays" :key="d.date" class="week-head" :class="{ today: d.date === today }">
        {{ d.name }} <span class="week-num">{{ d.day }}</span>
      </div>

      <div class="time-col">
        <div v-for="m in rows" :key="m" class="time-label">{{ m % 60 === 0 ? shortTime(m) : '' }}</div>
      </div>
      <div v-for="d in weekDays" :key="d.date" class="day-col">
        <div
          v-for="m in rows"
          :key="m"
          class="slot"
          :class="{
            free: (slotsOf(d.date) || []).includes(m),
            off: editable && !canChangeSlot(d.date, m, dayBookings(d.date), today, nowMinutes) && !slotBooked(dayBookings(d.date), d.date, m),
            hour: m % 60 === 0,
            looking: !editable,
            unsaved: changes[d.date] && (changes[d.date].includes(m) !== (saved[d.date] || []).includes(m))
          }"
          @mousedown.prevent="startSlotPaint(d.date, m)"
          @mouseenter="paintSlot(d.date, m)"
        ></div>
        <!-- the booking request the page is pointing out, drawn over the hours it asks for -->
        <div v-if="inHighlight(d.date)" class="block asked-block" :style="blockStyle(highlight, d.date)">
          <strong>Request</strong>
        </div>
        <!-- bookings sit on top of the half-hours they take -->
        <div
          v-for="b in dayBookings(d.date)"
          :key="b._id"
          class="block"
          :style="blockStyle(b, d.date)"
          @mouseenter="showBooking(b, $event)"
              @mousemove="moveCard"
          @mouseleave="hideBooking"
        >
          <strong>{{ b.petNames.join(', ') }}</strong>
          <span>{{ chipText(b, d.date).split(' · ')[0] }}</span>
        </div>
      </div>
    </div>

    <div class="legend d-flex flex-wrap gap-3 small mt-3">
      <span><span class="swatch available"></span> Available</span>
      <span><span class="swatch blocked"></span> Unavailable</span>
      <span><span class="swatch partial"></span> Partly booked</span>
      <span><span class="swatch booked"></span> Fully booked</span>
      <span><span class="swatch unset"></span> Not set</span>
    </div>
    <p class="small text-muted mt-2 mb-0">
      <template v-if="editable && view === 'month'">
        Drag across days to change several at once, or click a weekday letter to set that weekday for the whole month. To set only some hours of a day, use the Week view.
      </template>
      <template v-else-if="editable">
        Drag across the half-hours to make them available or unavailable, for a few hours of a day or across days. Hours in the past and booked hours can't be changed.
      </template>
      Hover a booking to see its details.
    </p>

    <!-- The white card next to the mouse. Teleport moves it out to the page's <body>, so the cards around the
         calendar (which are animated) can't shift where it appears on the screen. -->
    <Teleport to="body">
    <div v-if="hovered" class="booking-card" :style="{ left: hovered.left + 'px', top: hovered.top + 'px' }">
      <span class="status-pill">{{ hovered.booking.status }}</span>
      <strong>{{ hovered.booking.petNames.join(', ') }}</strong>
      <span>{{ hovered.booking.ownerName }}</span>
      <span class="text-muted">
        {{ prettyDate(hovered.booking.startDate) }}<template v-if="hovered.booking.startTime">, {{ formatTime(hovered.booking.startTime) }}</template>
        – {{ prettyDate(hovered.booking.endDate) }}<template v-if="hovered.booking.endTime">, {{ formatTime(hovered.booking.endTime) }}</template>
      </span>
      <span class="text-muted">${{ hovered.booking.totalPrice }}</span>
      <span v-if="hovered.booking.notes" class="small">Notes: "{{ hovered.booking.notes }}"</span>
    </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Colours (the PetSociety brown, orange and cream, with calm green and blue for the days) */
.avail-cal {
  --ink: #2b2420;
  --muted: #766a60;
  --line: #e4dbd0;
  --accent: #c47756;
  --open: #e3e9dc;
  --open-line: #8aa07c;
  --booked: #bfd0e4;
  --booked-line: #5b7ea6;
  --booked-ink: #1f3550;
  --partial: #e1e6f1;
  --blocked: #e6dfd6;
  color: var(--ink);
}
.cal-title { font-family: 'Fredoka', 'Nunito', sans-serif; font-size: 1.25rem; font-weight: 600; }
.btn-accent { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-accent:hover { background: #b06647; border-color: #b06647; color: #fff; }

/* ----- month view ----- */
.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}
.weekday {
  border: 0;
  background: none;
  padding: 4px 0;
  color: var(--muted);
  font-weight: 600;
  font-size: 0.8rem;
  border-radius: 4px;
}
.weekday:not(:disabled):hover { background: var(--open); color: var(--ink); }
.day {
  min-height: 5.4rem; /* room for the bookings written inside the square */
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  text-align: left;
  padding: 4px 5px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fffdfa;
  position: relative;
  user-select: none; /* so dragging does not select text */
}
.num { font-weight: 700; font-size: 0.9rem; }
.chip { /* one booking inside a day square */
  display: block;
  margin-top: 2px;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--booked);
  border-left: 3px solid var(--booked-line);
  color: var(--booked-ink);
  font-size: 0.66rem;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.more { margin-top: 1px; font-size: 0.62rem; color: var(--muted); }
.day.past { opacity: 0.45; }
.day.today { outline: 2px solid var(--accent); outline-offset: -1px; }
.day.asked { outline: 2px dashed var(--accent); outline-offset: -2px; } /* days of the request being looked at */
.day.selected { box-shadow: inset 0 0 0 3px var(--ink); } /* the day picked in the side card */
.day.unsaved::after {
  content: '';
  position: absolute;
  top: 5px;
  right: 5px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}
.available { background: var(--open); }
.blocked { background: repeating-linear-gradient(45deg, var(--blocked), var(--blocked) 5px, #fffdfa 5px, #fffdfa 10px); }
.partial { background: var(--partial); }
.booked { background: var(--booked); }
.unset { background: #fffdfa; }
.day.booked .chip { background: #d3e0ee; }

/* ----- week view ----- */
.week {
  display: grid;
  grid-template-columns: 44px repeat(7, minmax(0, 1fr));
  border-top: 1px solid var(--line);
  border-left: 1px solid var(--line);
  user-select: none;
}
.week > * { border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.week-head { text-align: center; padding: 6px 2px; font-weight: 600; font-size: 0.85rem; }
.week-head.today { color: var(--accent); box-shadow: inset 0 -3px 0 var(--accent); }
.week-num { display: block; font-family: 'Fredoka', sans-serif; font-size: 1.05rem; }
.time-col { display: grid; grid-auto-rows: 22px; }
.time-label { font-size: 0.65rem; color: var(--muted); text-align: right; padding-right: 5px; line-height: 1; transform: translateY(-4px); }
.day-col { position: relative; display: grid; grid-auto-rows: 22px; }
.slot { border-bottom: 1px dotted var(--line); cursor: pointer; background: #fffdfa; }
.slot.looking { cursor: default; }
.slot.hour { border-bottom: 1px solid var(--line); }
.slot.free { background: var(--open); }
.slot.off { opacity: 0.5; cursor: not-allowed; }
.slot.unsaved { box-shadow: inset 0 0 0 2px var(--accent); }
.block {
  position: absolute;
  left: 3px;
  right: 3px;
  background: var(--booked);
  border-left: 4px solid var(--booked-line);
  color: var(--booked-ink);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.68rem;
  line-height: 1.25;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.asked-block { /* the request being looked at: dashed orange, drawn first so real bookings sit on top */
  background: rgba(196, 119, 86, 0.18);
  border: 2px dashed var(--accent);
  border-left-width: 2px;
  color: var(--ink);
  pointer-events: none;
}

/* the white card beside a booking */
.booking-card {
  position: fixed;
  z-index: 1080;
  width: 236px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: none; /* so the card never gets in the way of the mouse */
}
.status-pill {
  align-self: flex-start;
  background: var(--booked);
  color: var(--booked-ink);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 6px;
  border-radius: 3px;
  margin-bottom: 3px;
}

.swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 1px solid #c9bfb3;
  border-radius: 3px;
  vertical-align: -2px;
  margin-right: 4px;
}

@media (max-width: 575.98px) { /* phones: squares are too small for text, so show small bars */
  .day { min-height: 3.4rem; padding: 2px; }
  .chip { height: 6px; padding: 0; }
  .chip-text, .more { display: none; }
  .week { overflow-x: auto; }
}
</style>
