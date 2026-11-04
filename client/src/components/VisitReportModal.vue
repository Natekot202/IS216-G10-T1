<script setup>
// The visit report window: one day of a booking's care report, for the owner.
// Opened from a Recently ended row, or "View report" on a finished day of the Today card.
// `entry` is one report entry from the server (server/src/utils/visitReports.js), `dayIndex` is its place in entry.days.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { walkApi } from '../services/walkApi.js'
import { SERVICE_LABELS } from '../utils/servicePrices.js'
import { buildTimeline, checklistGroups, clockText, dayLabel, duration, joinNames, km, summarize, timeOf } from '../utils/visitReport.js'
import WalkMap from './WalkMap.vue'

const props = defineProps({
  entry: { type: Object, required: true },
  dayIndex: { type: Number, required: true }
})
const emit = defineEmits(['close', 'change-day'])

const day = computed(() => props.entry.days[props.dayIndex])
const pets = computed(() => props.entry.booking.pets ?? [])
const summary = computed(() => summarize(day.value, pets.value))
const sections = computed(() => buildTimeline(day.value, pets.value, summary.value))
const visit = computed(() => summary.value.visit)
const sitterName = computed(() => props.entry.booking.sitter?.username ?? 'Sitter')
const petNames = computed(() => joinNames(pets.value.map((p) => p.name)))
const prev = computed(() => props.entry.days[props.dayIndex - 1] ?? null)
const next = computed(() => props.entry.days[props.dayIndex + 1] ?? null)

// ---- Stat strip ----
const stats = computed(() => {
  const s = summary.value
  const v = visit.value
  const petCount = new Set(s.tasks.flatMap((t) => t.petNames)).size || pets.value.length
  return [
    { label: 'Started', value: timeOf(v.startedAt), sub: `Booked ${clockText(day.value.startTime)}` },
    { label: 'Ended', value: v.endedAt ? timeOf(v.endedAt) : '–', sub: v.autoEnded ? 'Ended automatically' : `Booked ${clockText(day.value.endTime)}` },
    { label: 'Tasks', value: `${s.done} of ${s.expected} done`, sub: `${s.tasks.length} task${s.tasks.length === 1 ? '' : 's'}, ${petCount} pet${petCount === 1 ? '' : 's'}` },
    {
      label: 'Walks',
      value: s.walks.length ? `${s.walks.length} walk${s.walks.length === 1 ? '' : 's'}, ${km(s.walkM)}` : 'No walks',
      sub: s.walks.length ? duration(s.walkS) : ''
    }
  ]
})

// ---- Checklist ----
const notDoneFirst = ref(true)
const groups = computed(() => checklistGroups(summary.value, notDoneFirst.value))

// ---- Timeline sections and walk cards ----
// "5 tasks, 1 walk" (counts of 0 are left out)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const sectionCounts = (s) => [s.taskCount && plural(s.taskCount, 'task'), s.walkCount && plural(s.walkCount, 'walk')].filter(Boolean).join(', ')
const isPhone = () => window.matchMedia('(max-width: 767.98px)').matches
const sectionOpen = reactive({})  // section key -> open
const walkOpen = reactive({})     // walk id -> its route and rows are showing
const walkData = reactive({})     // walk id -> the full walk (paths), loaded when shown
const walkError = reactive({})

// Desktop: every section open. Phones: only sections with something to look at.
// Walks with problems show their rows and map straight away; others wait behind "Show route".
function resetOpen() {
  for (const k of Object.keys(sectionOpen)) delete sectionOpen[k]
  for (const s of sections.value) sectionOpen[s.key] = !isPhone() || s.warnCount > 0
  for (const s of sections.value) {
    for (const e of s.events.filter((x) => x.kind === 'walk')) {
      walkOpen[e.walk._id] = e.hasProblems
      if (e.hasProblems) loadWalk(e.walk._id)
    }
  }
}
async function loadWalk(id) {
  if (walkData[id]) return
  try {
    walkData[id] = await walkApi.getById(id)
  } catch (err) {
    walkError[id] = err.response?.data?.message || 'Could not load this walk.'
  }
}
function toggleWalk(id) {
  walkOpen[id] = !walkOpen[id]
  if (walkOpen[id]) loadWalk(id)
}

// ---- "To note" lines jump to their timeline row ----
const scroller = ref(null)
const highlighted = ref('')
let highlightTimer = null
async function jumpTo(eventId) {
  const section = sections.value.find((s) => s.events.some((e) => e.id === eventId))
  if (section) sectionOpen[section.key] = true
  const walk = sections.value.flatMap((s) => s.events).find((e) => e.id === eventId && e.kind === 'walk')
  if (walk) toggleWalkOpen(walk.walk._id)
  await nextTick()
  const target = scroller.value?.querySelector(`[data-event="${eventId}"]`)
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  highlighted.value = eventId
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => { highlighted.value = '' }, 1500)
}
function toggleWalkOpen(id) {
  if (!walkOpen[id]) toggleWalk(id)
}

// ---- Window behaviour: focus, Esc, no page scrolling behind it, back to the top on a new day ----
function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', onKey)
  resetOpen()
  // focus the ✕ that's showing (phones have it on the left, computers on the right)
  nextTick(() => [...scroller.value.querySelectorAll('.rep-close')].find((b) => b.offsetParent)?.focus())
})
onBeforeUnmount(() => {
  document.body.style.overflow = ''
  document.removeEventListener('keydown', onKey)
  clearTimeout(highlightTimer)
})
watch(() => props.dayIndex, () => {
  resetOpen()
  nextTick(() => scroller.value?.scrollTo({ top: 0 }))
})

const titleId = computed(() => `rep-title-${props.entry.booking._id}`)
</script>

<template>
  <Teleport to="body">
    <div ref="scroller" class="rep-backdrop" @click.self="emit('close')">
      <div class="rep" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <!-- pinned header -->
        <header class="rep-head">
          <button type="button" class="rep-icon rep-close rep-close--phone" aria-label="Close report" @click="emit('close')">✕</button>
          <div class="rep-head__text">
            <p class="rep-kicker">Visit report · {{ sitterName }} · {{ petNames }}</p>
            <h2 :id="titleId" class="rep-title">
              {{ dayLabel(day.date) }} · Day {{ day.dayNumber }}<span class="rep-wide"> of </span><span class="rep-narrow">/</span>{{ entry.totalDays }}
            </h2>
          </div>
          <nav class="rep-nav" aria-label="Other days">
            <button type="button" class="rep-step" :disabled="!prev" @click="emit('change-day', dayIndex - 1)">
              ‹<span class="rep-wide"> Prev</span><span class="visually-hidden"> day</span>
            </button>
            <button type="button" class="rep-step" :disabled="!next" @click="emit('change-day', dayIndex + 1)">
              <span class="rep-wide">{{ next ? `Day ${next.dayNumber}` : 'Next' }} </span><span class="visually-hidden">Next day </span>›
            </button>
            <button type="button" class="rep-icon rep-close rep-close--wide" aria-label="Close report" @click="emit('close')">✕</button>
          </nav>
        </header>

        <div class="rep-body">
          <!-- stat strip -->
          <dl class="rep-stats">
            <div v-for="s in stats" :key="s.label" class="rep-stat">
              <dt>{{ s.label }}</dt>
              <dd>
                <strong>{{ s.value }}</strong>
                <small v-if="s.sub">{{ s.sub }}</small>
              </dd>
            </div>
          </dl>

          <!-- To note / Also noted -->
          <section v-if="summary.warn.length || summary.info.length" class="rep-note" aria-label="To note">
            <div v-if="summary.warn.length">
              <h3 class="rep-note__title">⚠ To note</h3>
              <button v-for="(w, i) in summary.warn" :key="`w${i}`" type="button" class="rep-note__row rep-note__row--warn" @click="jumpTo(w.eventId)">
                <span aria-hidden="true">⚠</span>
                <strong class="rep-note__text">{{ w.text }}</strong>
                <span v-if="w.at" class="rep-note__time">{{ timeOf(w.at) }}</span>
                <span aria-hidden="true">›</span>
              </button>
            </div>
            <div v-if="summary.info.length">
              <h3 class="rep-note__title rep-note__title--info">Also noted</h3>
              <button v-for="(n, i) in summary.info" :key="`i${i}`" type="button" class="rep-note__row" @click="jumpTo(n.eventId)">
                <span aria-hidden="true">ⓘ</span>
                <strong class="rep-note__text">{{ n.text }}</strong>
                <span v-if="n.at" class="rep-note__time">{{ timeOf(n.at) }}</span>
                <span aria-hidden="true">›</span>
              </button>
            </div>
          </section>

          <div class="rep-cols">
            <!-- timeline -->
            <section class="rep-card rep-timeline">
              <div class="rep-card__head">
                <h3 class="rep-card__title">Timeline</h3>
                <small class="rep-muted">{{ timeOf(visit.startedAt) }} – {{ visit.endedAt ? timeOf(visit.endedAt) : '…' }}</small>
              </div>

              <details v-for="s in sections" :key="s.key" class="rep-section" :open="sectionOpen[s.key]"
                       @toggle="sectionOpen[s.key] = $event.target.open">
                <summary class="rep-section__summary">
                  <span class="rep-section__arrow" aria-hidden="true">▾</span>
                  <strong>{{ s.label }}</strong>
                  <span class="rep-muted">{{ s.range }}<template v-if="sectionCounts(s)"> · {{ sectionCounts(s) }}</template></span>
                  <span v-if="s.warnCount" class="rep-pill">⚠ {{ s.warnCount }}</span>
                </summary>

                <ol class="rep-events">
                  <li v-for="e in s.events" :key="e.id" class="rep-event" :class="{ 'rep-event--flash': highlighted === e.id }" :data-event="e.id">
                    <span class="rep-event__time">{{ timeOf(e.at) }}</span>
                    <span class="rep-event__dot" :class="{ 'rep-event__dot--big': e.kind !== 'ticks', 'rep-event__dot--warn': e.warn }" aria-hidden="true"></span>
                    <div class="rep-event__body">
                      <template v-if="e.kind === 'milestone'">
                        <strong>{{ e.title }}</strong>
                        <small class="rep-event__sub" :class="{ 'rep-event__sub--warn': e.warn }">{{ e.sub }}</small>
                      </template>
                      <template v-else-if="e.kind === 'ticks'">
                        <span>✓ {{ e.labels.join(', ') }}</span>
                        <small v-if="e.sub" class="rep-event__sub">{{ e.sub }}</small>
                      </template>
                      <div v-else-if="e.kind === 'away' || e.kind === 'gap'" class="rep-flag" :class="{ 'rep-flag--warn': e.warn }">
                        <strong>{{ e.warn ? '⚠' : 'ⓘ' }} {{ e.title }}</strong>
                        <small>{{ e.text }}</small>
                      </div>
                      <!-- a walk card -->
                      <div v-else-if="e.kind === 'walk'" class="rep-walk">
                        <div class="rep-walk__head">
                          <strong>{{ e.title }}<template v-if="e.petNames"> · {{ e.petNames }}</template></strong>
                          <small class="rep-muted">{{ e.range }}</small>
                        </div>
                        <dl class="rep-walk__stats">
                          <div><dt>Distance</dt><dd>{{ e.distance }}</dd></div>
                          <div><dt>Duration</dt><dd>{{ e.duration }}</dd></div>
                          <div><dt>Route check</dt><dd :class="{ 'rep-warn-text': e.routeCheck.warn }">{{ e.routeCheck.text }}</dd></div>
                        </dl>
                        <template v-if="walkOpen[e.walk._id]">
                          <ul v-if="e.rows.length" class="rep-walk__rows">
                            <li v-for="(r, i) in e.rows" :key="i" :class="{ 'rep-warn-text': r.warn }">
                              <span class="rep-walk__time">{{ timeOf(r.at) }}</span>
                              <span><strong>{{ r.warn ? '⚠ ' : '' }}{{ r.title }}</strong> · {{ r.text }}</span>
                            </li>
                          </ul>
                          <div class="rep-walk__map">
                            <WalkMap v-if="walkData[e.walk._id]" :walked-path="walkData[e.walk._id].walkedPath?.coordinates ?? []"
                                     :planned-route="walkData[e.walk._id].plannedPath?.coordinates ?? []"
                                     :home="walkData[e.walk._id].home?.coordinates ?? null" />
                            <p v-else-if="walkError[e.walk._id]" class="rep-muted m-2">{{ walkError[e.walk._id] }}</p>
                            <p v-else class="rep-muted m-2">Loading the route…</p>
                          </div>
                        </template>
                        <button type="button" class="rep-link" :aria-expanded="!!walkOpen[e.walk._id]" @click="toggleWalk(e.walk._id)">
                          {{ walkOpen[e.walk._id] ? 'Hide route ▴' : 'Show route ▾' }}
                        </button>
                      </div>
                    </div>
                  </li>
                </ol>
              </details>
            </section>

            <!-- the sitter's notes and the checklist -->
            <div class="rep-side">
              <section class="rep-card">
                <h3 class="rep-card__title">Sitter's notes</h3>
                <p v-if="visit.report?.notes" class="rep-notes">{{ visit.report.notes }}</p>
                <p v-else class="rep-muted mb-0">No notes were left for this visit.</p>
                <div v-if="summary.photos.length" class="rep-photos">
                  <a v-for="p in summary.photos" :key="p.url" :href="p.url" target="_blank" rel="noopener" class="rep-photo">
                    <img :src="p.url" alt="Photo from the visit (opens full size)" />
                  </a>
                </div>
              </section>

              <section class="rep-card" data-event="checklist" :class="{ 'rep-event--flash': highlighted === 'checklist' }">
                <div class="rep-card__head">
                  <h3 class="rep-card__title">Care checklist</h3>
                  <label class="rep-toggle"><input v-model="notDoneFirst" type="checkbox" /> Not done first</label>
                </div>
                <p class="rep-muted small">Each time a task was due, with when it was ticked.</p>
                <div v-for="g in groups" :key="g.name" class="rep-group">
                  <h4 class="rep-group__name">{{ g.name }}</h4>
                  <div v-for="t in g.tasks" :key="t.item._id" class="rep-task">
                    <div class="rep-task__text">
                      <strong>{{ t.item.title }}</strong>
                      <small class="rep-muted">{{ SERVICE_LABELS[t.item.category] }} · {{ t.ticks.length }} of {{ t.due }}</small>
                    </div>
                    <div class="rep-task__ticks">
                      <span v-for="(at, i) in t.ticks" :key="i" class="rep-tick"><span aria-hidden="true">✓</span> {{ timeOf(at) }}</span>
                      <span v-if="t.missing" class="rep-pill">Not done{{ t.missing > 1 ? ` ×${t.missing}` : '' }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.rep-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1060;
  overflow-y: auto;
  padding: 2rem 1rem;
  background: rgba(43, 36, 32, 0.55);
}
.rep {
  max-width: 1020px;
  margin: 0 auto;
  border-radius: 16px;
  background: #faf6f2;
  box-shadow: 0 24px 60px rgba(43, 36, 32, 0.35);
  color: #2b2420;
}
.rep-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.4rem;
  border-bottom: 1px solid #e6dcd3;
  border-radius: 16px 16px 0 0;
  background: #faf6f2;
}
.rep-head__text {
  flex: 1;
  min-width: 0;
}
.rep-kicker {
  margin: 0;
  overflow: hidden;
  color: #6b5f56;
  font-size: 0.85rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rep-title {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 800;
}
.rep-narrow,
.rep-close--phone {
  display: none;
}
.rep-nav {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.4rem;
}
.rep-step,
.rep-icon {
  min-width: 40px;
  min-height: 40px;
  padding: 0 0.8rem;
  border: 1px solid #e6dcd3;
  border-radius: 10px;
  background: #fff;
  color: #2b2420;
  font-weight: 800;
}
.rep-step:disabled {
  opacity: 0.4;
}
.rep-step:focus-visible,
.rep-icon:focus-visible,
.rep-note__row:focus-visible,
.rep-link:focus-visible,
.rep-section__summary:focus-visible,
.rep-photo:focus-visible {
  outline: 3px solid var(--accent-deep);
  outline-offset: 2px;
}
.rep-body {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding: 1.2rem 1.4rem 1.6rem;
}

/* stat strip: plain columns with thin rules between them */
.rep-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 0;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e6dcd3;
}
.rep-stat {
  padding: 0 1rem;
}
.rep-stat + .rep-stat {
  border-left: 1px solid #e6dcd3;
}
.rep-stat:first-child {
  padding-left: 0;
}
.rep-stat dt {
  color: #5c524b;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.rep-stat dd {
  display: flex;
  flex-direction: column;
  margin: 0.2rem 0 0;
}
.rep-stat strong {
  font-size: 1.1rem;
}
.rep-stat small {
  color: #6b5f56;
}

/* To note */
.rep-note {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 0.5rem 1.5rem;
  padding: 0.9rem 1.1rem;
  border: 1px solid #f1d7a6;
  border-left: 5px solid #c98a12;
  border-radius: 12px;
  background: #fff;
}
.rep-note__title {
  margin: 0 0 0.3rem;
  color: #7a5a00;
  font-size: 1rem;
  font-weight: 800;
}
.rep-note__title--info {
  color: #6b5f56;
  font-size: 0.9rem;
  font-weight: 700;
}
.rep-note__row {
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0;
  border: 0;
  background: none;
  color: #6b5f56;
  text-align: left;
}
.rep-note__row--warn {
  color: #7a5a00;
}
.rep-note__text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.rep-note__time {
  flex: none;
  color: #6b5f56;
  font-size: 0.85rem;
}

/* columns */
.rep-cols {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  gap: 1.1rem;
  align-items: start;
}
.rep-side {
  position: sticky;
  top: 5.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.rep-card {
  min-width: 0;
  padding: 1rem 1.1rem;
  border: 1px solid #f0e8e0;
  border-radius: 12px;
  background: #fff;
}
.rep-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}
.rep-card__title {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
  font-weight: 800;
}
.rep-card__head .rep-card__title {
  margin: 0;
}
.rep-muted {
  color: #6b5f56;
}
.rep-warn-text {
  color: #7a5a00;
  font-weight: 700;
}
.rep-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.05rem 0.55rem;
  border: 1px solid #f1d7a6;
  border-radius: 999px;
  background: #fdf0c4;
  color: #7a5a00;
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

/* timeline */
.rep-section {
  border-top: 1px solid #f0e8e0;
}
.rep-section__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.6rem;
  min-height: 44px;
  padding: 0.4rem 0;
  cursor: pointer;
  list-style: none;
}
.rep-section__summary::-webkit-details-marker {
  display: none;
}
.rep-section__arrow {
  display: inline-block;
  transition: transform 0.15s;
}
.rep-section:not([open]) .rep-section__arrow {
  transform: rotate(-90deg);
}
.rep-section__summary .rep-pill {
  margin-left: auto;
}
.rep-events {
  margin: 0 0 0.6rem;
  padding: 0;
  list-style: none;
}
.rep-event {
  display: grid;
  grid-template-columns: 4.6rem 1rem 1fr;
  align-items: start;
  gap: 0.5rem;
  padding: 0.4rem 0.3rem;
  border-radius: 8px;
  transition: background 0.3s;
}
.rep-event--flash {
  background: #fdf0c4;
}
.rep-event__time {
  font-size: 0.8rem;
  font-weight: 800;
  text-align: right;
}
.rep-event__dot {
  justify-self: center;
  width: 0.45rem;
  height: 0.45rem;
  margin-top: 0.35rem;
  border-radius: 50%;
  background: #9a8d83;
}
.rep-event__dot--big {
  width: 0.7rem;
  height: 0.7rem;
  margin-top: 0.25rem;
}
.rep-event__dot--warn {
  background: #e08a16;
}
.rep-event__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow-wrap: anywhere;
}
.rep-event__sub {
  color: #6b5f56;
}
.rep-event__sub--warn {
  color: #7a5a00;
}
.rep-flag {
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e6dcd3;
  border-radius: 10px;
  background: #faf6f2;
  color: #5c524b;
}
.rep-flag--warn {
  border-color: #f1d7a6;
  background: #fdf0c4;
  color: #7a5a00;
}

/* walk card */
.rep-walk {
  padding: 0.65rem 0.8rem;
  border: 1px solid #e6dcd3;
  border-radius: 10px;
  background: #faf6f2;
}
.rep-walk__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.2rem 0.75rem;
}
.rep-walk__stats {
  display: grid;
  grid-template-columns: repeat(3, auto);
  justify-content: start;
  gap: 0.2rem 1.4rem;
  margin: 0.4rem 0 0;
}
.rep-walk__stats dt {
  color: #5c524b;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.rep-walk__stats dd {
  margin: 0;
  font-weight: 700;
}
.rep-walk__rows {
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.88rem;
}
.rep-walk__rows li {
  display: grid;
  grid-template-columns: 4rem 1fr;
  gap: 0.5rem;
  padding: 0.15rem 0;
}
.rep-walk__time {
  font-weight: 800;
}
.rep-walk__map {
  height: 180px;
  margin-top: 0.5rem;
  overflow: hidden;
  border: 1px solid #e6dcd3;
  border-radius: 8px;
  background: #fff;
}
.rep-walk__map :deep(.map) {
  min-height: 0;
}
.rep-link {
  min-height: 36px;
  margin-top: 0.2rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-deep);
  font-weight: 700;
}

/* notes and checklist */
.rep-notes {
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.rep-photos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.rep-photo img {
  width: 84px;
  height: 84px;
  border-radius: 8px;
  object-fit: cover;
}
.rep-toggle {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 0.35rem;
  color: #2b2420;
  font-size: 0.85rem;
  font-weight: 700;
}
.rep-group__name {
  margin: 0.8rem 0 0.2rem;
  color: #5c524b;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.rep-task {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-top: 1px solid #f0e8e0;
}
.rep-task__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow-wrap: anywhere;
}
.rep-task__ticks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem 0.6rem;
  font-size: 0.85rem;
}
.rep-tick {
  white-space: nowrap;
}
.rep-tick span {
  color: #1f8a4c;
  font-weight: 800;
}

@media (prefers-reduced-motion: reduce) {
  .rep-event,
  .rep-section__arrow {
    transition: none;
  }
}

/* phones: a full-screen sheet, in the order an owner reads it */
@media (max-width: 767.98px) {
  .rep-backdrop {
    padding: 0;
    background: #faf6f2;
  }
  .rep {
    min-height: 100%;
    border-radius: 0;
    box-shadow: none;
  }
  .rep-head {
    top: 0;
    gap: 0.6rem;
    padding: 0.7rem 0.75rem;
    border-radius: 0;
  }
  .rep-close--phone {
    display: inline-block;
  }
  .rep-close--wide,
  .rep-wide {
    display: none;
  }
  .rep-narrow {
    display: inline;
  }
  .rep-title {
    font-size: 1.15rem;
  }
  .rep-step {
    padding: 0;
  }
  .rep-step,
  .rep-icon {
    min-height: 44px;
    min-width: 44px;
  }
  .rep-body {
    padding: 1rem 0.75rem 1.5rem;
  }
  .rep-stats {
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem 0;
  }
  .rep-stat:nth-child(odd) {
    padding-left: 0;
    border-left: 0;
  }
  .rep-note {
    grid-template-columns: 1fr;
  }
  .rep-note__row {
    min-height: 44px;
  }
  .rep-cols {
    display: flex;
    flex-direction: column;
  }
  .rep-side {
    position: static;
    order: 1;
  }
  .rep-timeline {
    order: 2;
  }
  .rep-walk__head {
    flex-direction: column;
  }
  .rep-link {
    min-height: 44px;
  }
  /* more room for the walk card: a narrower time column, and stat labels that don't split mid-word */
  .rep-event {
    grid-template-columns: 3.6rem 0.8rem 1fr;
    gap: 0.4rem;
  }
  .rep-walk__stats {
    grid-template-columns: repeat(3, 1fr);
    gap: 0.2rem 0.6rem;
  }
  .rep-walk__stats dt {
    font-size: 10px;
    letter-spacing: 0.02em;
  }
  .rep-walk__rows li {
    grid-template-columns: 3.6rem 1fr;
  }
}
</style>
