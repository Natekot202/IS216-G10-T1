// Shared helpers for care reports: the Recently ended list (components/RecentlyEnded.vue), the visit report window
// (components/VisitReportModal.vue) and the owner's Today timeline. Plain functions, no Vue.
// A report entry comes from the server (server/src/utils/visitReports.js):
//   { booking: { pets, sitter, ... }, totalDays, days: [{ dayNumber, date, startTime, endTime, visit, items, walks }] }
// All times are shown in Singapore time.

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LATE_MIN = 10 // starting or ending more than this many minutes after the booked time is mentioned
const LONG_GAP_MIN = 15 // a location gap this long is a warning, shorter ones are only noted
const MERGE_TICKS_MIN = 10 // ticks this close together share one timeline row

// ---- Formatting ----

// "09:00" -> "9:00 am", "13:30" -> "1:30 pm", "24:00" -> "12:00 am"
export function clockText(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h % 24 < 12 ? 'am' : 'pm'}`
}

// A moment, as Singapore wall-clock parts
function sgParts(date) {
  const d = new Date(new Date(date).getTime() + SGT_OFFSET_MS)
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours(), minute: d.getUTCMinutes() }
}

// A moment -> "9:01 am"
export function timeOf(date) {
  if (!date) return ''
  const { hour, minute } = sgParts(date)
  return clockText(`${hour}:${minute}`)
}

// 'YYYY-MM-DD' -> "Tue 27 Oct"
export function dayLabel(date) {
  const d = new Date(`${date}T00:00:00Z`)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

// 'YYYY-MM-DD' (or a moment) -> "27 Oct"
export function shortDate(date) {
  const day = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : sgParts(date).date
  const d = new Date(`${day}T00:00:00Z`)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

// "8 Oct", "24 – 27 Oct", "30 Oct – 2 Nov"
export function dateRange(start, end) {
  if (!end || start === end) return shortDate(start)
  const [s, e] = [new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`)]
  return s.getUTCMonth() === e.getUTCMonth() ? `${s.getUTCDate()} – ${shortDate(end)}` : `${shortDate(start)} – ${shortDate(end)}`
}

// ['Mochi', 'Bean', 'Kopi'] -> "Mochi, Bean and Kopi"
export function joinNames(names) {
  const list = names.filter(Boolean)
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0] ?? ''
}

// 1300 -> "1.3 km"
export const km = (m) => `${((m || 0) / 1000).toFixed(1)} km`

// 2100 -> "35 min", 4200 -> "1 h 10 min"
export function duration(seconds) {
  const min = Math.max(1, Math.round((seconds || 0) / 60))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`
}

const minutesBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / MINUTE_MS)
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)
// A booked time on a day ('YYYY-MM-DD', '09:00') -> milliseconds
const bookedMoment = (date, hhmm) => new Date(`${date}T00:00:00+08:00`).getTime() + (Number(hhmm.split(':')[0]) * 60 + Number(hhmm.split(':')[1])) * MINUTE_MS
// "the evening walk" style: the task's title, lower case at the start, for use inside a sentence
const inSentence = (title) => (title ? title.charAt(0).toLowerCase() + title.slice(1) : 'the walk')

// The pets a task is for, as names. `pets` are the booking's pets.
function petNamesFor(item, pets) {
  const ids = (item.petIds ?? []).map(String)
  const names = pets.filter((p) => ids.includes(String(p._id))).map((p) => p.name)
  return names.length ? names : pets.map((p) => p.name)
}

// ---- One day's summary ----

// Everything the report shows about one day. `day` is one of entry.days, `pets` is entry.booking.pets.
// Returns { visit, tasks, expected, done, walks, walkM, walkS, photos, warn, info }
//   tasks: [{ item, petNames, due, ticks: [at, ...], missing }]   (ticks are capped at the number due)
//   warn ("To note") and info ("Also noted"): [{ text, at, short, eventId }]; eventId is the timeline row it points at
export function summarize(day, pets) {
  const visit = day.visit
  const finished = visit.status === 'completed'
  const ticks = visit.completedTasks ?? []
  const tasks = day.items.map((item) => {
    const mine = ticks.filter((t) => String(t.task) === String(item._id)).map((t) => t.at).sort((a, b) => new Date(a) - new Date(b))
    const due = item.dailyFrequency
    const done = mine.slice(0, due)
    return { item, petNames: petNamesFor(item, pets), due, ticks: done, missing: finished ? due - done.length : 0 }
  })
  const walks = (day.walks ?? []).filter((w) => w.startedAt)
  const titleOf = (w) => day.items.find((i) => String(i._id) === String(w.task))?.title ?? 'Walk'
  const warn = []
  const info = []

  const missed = tasks.filter((t) => t.missing > 0)
  if (missed.length) {
    warn.push({
      text: `Not done: ${missed.map((t) => `${t.item.title} (${t.due - t.missing} of ${t.due})`).join(', ')}`,
      short: `${missed.length} not done`, eventId: 'checklist'
    })
  }
  const check = visit.startCheck
  if (check) {
    warn.push({
      text: check.reason === 'out-of-range' && check.distanceM != null
        ? `Started ${Math.round(check.distanceM)} m from home · "${check.note}"`
        : `Started without a location check · "${check.note}"`,
      at: visit.startedAt, short: 'Away at start', eventId: 'start'
    })
  }
  if (visit.autoEnded) {
    warn.push({ text: 'Ended automatically: the sitter did not end the session', at: visit.endedAt, short: 'Ended automatically', eventId: 'end' })
  }
  for (const w of walks) {
    const notified = (w.deviations ?? []).filter((d) => d.ownerNotifiedAt)
    const quiet = (w.deviations ?? []).filter((d) => !d.ownerNotifiedAt)
    if (notified.length) {
      const furthest = Math.max(...notified.map((d) => d.maxDistanceM || 0))
      warn.push({
        text: `Off route ${times(notified.length)} on ${inSentence(titleOf(w))} · up to ${Math.round(furthest)} m`,
        at: notified[0].startedAt, short: 'Off route', eventId: `walk-${w._id}`
      })
    }
    if (quiet.length) {
      info.push({ text: `Briefly off route ${times(quiet.length)}, not far enough to notify you`, at: quiet[0].startedAt, eventId: `walk-${w._id}` })
    }
    if (w.status === 'ended-early') {
      warn.push({ text: `Walk ended early · "${w.endedEarlyReason}"`, at: w.endedAt, short: 'Walk ended early', eventId: `walk-${w._id}` })
    }
  }
  ;(visit.awayEpisodes ?? []).forEach((a, i) => {
    warn.push({ text: `Left home, not on a walk · ${minutesBetween(a.startedAt, a.endedAt ?? visit.endedAt)} min`, at: a.startedAt, short: 'Left home', eventId: `away-${i}` })
  })
  ;(visit.locationGaps ?? []).forEach((g, i) => {
    const min = minutesBetween(g.startedAt, g.endedAt ?? visit.endedAt)
    if (min >= LONG_GAP_MIN) warn.push({ text: `Location stopped · ${min} min`, at: g.startedAt, short: 'Location stopped', eventId: `gap-${i}` })
    else info.push({ text: `Location gap · ${min} min`, at: g.startedAt, eventId: `gap-${i}` })
  })
  const lateStart = minutesBetween(bookedMoment(day.date, day.startTime), visit.startedAt)
  if (lateStart > LATE_MIN) info.push({ text: `Started ${lateStart} min after the booked time`, at: visit.startedAt, eventId: 'start' })
  if (finished && !visit.autoEnded) {
    const lateEnd = minutesBetween(bookedMoment(day.date, day.endTime), visit.endedAt)
    if (lateEnd > LATE_MIN) info.push({ text: `Ended ${lateEnd} min after booked time`, at: visit.endedAt, eventId: 'end' })
  }

  return {
    visit,
    tasks,
    expected: tasks.reduce((n, t) => n + t.due, 0),
    done: tasks.reduce((n, t) => n + t.ticks.length, 0),
    walks,
    walkM: walks.reduce((n, w) => n + (w.distanceM || 0), 0),
    walkS: walks.reduce((n, w) => n + (w.durationS || 0), 0),
    photos: visit.report?.photos ?? [],
    warn,
    info
  }
}

// ---- The report's timeline ----

// The walk card's "route check" and its rows: off route, back on route, ended early
function walkDetails(w) {
  const deviations = w.deviations ?? []
  const notified = deviations.filter((d) => d.ownerNotifiedAt).length
  const rows = []
  for (const d of deviations) {
    rows.push({
      at: d.startedAt, warn: !!d.ownerNotifiedAt, title: 'Off route',
      text: d.ownerNotifiedAt ? `Up to ${Math.round(d.maxDistanceM)} m. You were notified.` : `Up to ${Math.round(d.maxDistanceM)} m, not far enough to notify you.`
    })
    if (d.endedAt) rows.push({ at: d.endedAt, warn: false, title: 'Back on route', text: `${Math.max(1, minutesBetween(d.startedAt, d.endedAt))} min off` })
  }
  if (w.status === 'ended-early') rows.push({ at: w.endedAt, warn: true, title: 'Walk ended early', text: `"${w.endedEarlyReason}"` })
  const routeCheck = w.mode === 'instructions'
    ? { text: 'No route set', warn: false }
    : deviations.length ? { text: `Off route ${times(deviations.length)}`, warn: notified > 0 } : { text: 'On route', warn: false }
  return { rows, routeCheck, hasProblems: notified > 0 || w.status === 'ended-early' }
}

// Morning before 12 pm, Afternoon 12–4 pm, Evening after 4 pm. Anything after midnight still counts as Evening.
function sectionOf(at, date) {
  const p = sgParts(at)
  if (p.date > date) return 'evening'
  return p.hour < 12 ? 'morning' : p.hour < 16 ? 'afternoon' : 'evening'
}
const hourText = (h) => String(h % 12 || 12)

// The report's timeline for one day, in sections: [{ key, label, range, events, taskCount, walkCount, warnCount }]
// Each event: { id, at, kind: 'milestone' | 'ticks' | 'walk' | 'away' | 'gap', warn, ...what it shows }
export function buildTimeline(day, pets, summary = summarize(day, pets)) {
  const { visit } = summary
  const manyPets = pets.length > 1
  const itemById = new Map(day.items.map((i) => [String(i._id), i]))
  const events = []

  const check = visit.startCheck
  events.push({
    id: 'start', at: visit.startedAt, kind: 'milestone', title: 'Session started', warn: !!check,
    sub: !check ? 'At the home, location check passed.'
      : check.reason === 'out-of-range' && check.distanceM != null ? `${Math.round(check.distanceM)} m from home. Sitter's note: "${check.note}"`
        : `No location check. Sitter's note: "${check.note}"`
  })

  // Ticks by hand, merged when close together (walk ticks are left out: the walk card covers them)
  const handTicks = (visit.completedTasks ?? []).filter((t) => !t.walk).slice().sort((a, b) => new Date(a.at) - new Date(b.at))
  let group = null
  handTicks.forEach((t) => {
    const item = itemById.get(String(t.task))
    const label = item && manyPets ? `${item.title} (${joinNames(petNamesFor(item, pets))})` : item?.title ?? t.title
    if (group && minutesBetween(group.last, t.at) <= MERGE_TICKS_MIN && sectionOf(group.at, day.date) === sectionOf(t.at, day.date)) {
      group.labels.push(label)
      group.last = t.at
    } else {
      group = { id: `ticks-${events.length}`, at: t.at, last: t.at, kind: 'ticks', labels: [label], warn: false }
      events.push(group)
    }
  })
  for (const g of events.filter((e) => e.kind === 'ticks')) {
    g.sub = g.labels.length > 1 ? `${g.labels.length} tasks, ${timeOf(g.at)} – ${timeOf(g.last)}` : ''
  }

  for (const w of summary.walks) {
    const item = itemById.get(String(w.task))
    const details = walkDetails(w)
    events.push({
      id: `walk-${w._id}`, at: w.startedAt, kind: 'walk', walk: w, warn: details.hasProblems,
      title: item?.title ?? 'Walk', petNames: item ? joinNames(petNamesFor(item, pets)) : '',
      range: `${timeOf(w.startedAt)} – ${timeOf(w.endedAt)}`, distance: km(w.distanceM), duration: duration(w.durationS), ...details
    })
  }

  ;(visit.awayEpisodes ?? []).forEach((a, i) => {
    const min = minutesBetween(a.startedAt, a.endedAt ?? visit.endedAt)
    events.push({
      id: `away-${i}`, at: a.startedAt, kind: 'away', warn: true, title: 'Left home, not on a walk',
      text: `Up to ${Math.round(a.maxDistanceM || 0)} m away. ${a.endedAt ? `Back home at ${timeOf(a.endedAt)}, after ${min} min.` : 'Not back before the session ended.'}`
    })
  })
  ;(visit.locationGaps ?? []).forEach((g, i) => {
    const min = minutesBetween(g.startedAt, g.endedAt ?? visit.endedAt)
    const long = min >= LONG_GAP_MIN
    events.push({
      id: `gap-${i}`, at: g.startedAt, kind: 'gap', warn: long,
      title: long ? `Location stopped updating · ${min} min` : `Location gap · ${min} min`,
      text: g.endedAt ? `Sharing resumed at ${timeOf(g.endedAt)}${g.resumedAtHome ? ', at home' : ''}.` : 'Sharing did not resume before the session ended.'
    })
  })

  if (visit.status === 'completed') {
    const late = minutesBetween(bookedMoment(day.date, day.endTime), visit.endedAt)
    events.push({
      id: 'end', at: visit.endedAt, kind: 'milestone', title: 'Session ended', warn: !!visit.autoEnded,
      sub: visit.autoEnded ? 'Ended automatically, because the sitter did not end it.'
        : late > LATE_MIN ? `By the sitter, ${late} min after the booked end.` : 'By the sitter.'
    })
  }

  events.sort((a, b) => new Date(a.at) - new Date(b.at))
  const startHour = Number(day.startTime.split(':')[0])
  const endHour = Number(day.endTime.split(':')[0])
  const sections = [
    { key: 'morning', label: 'Morning', from: Math.min(startHour, 12), to: 12 },
    { key: 'afternoon', label: 'Afternoon', from: 12, to: 16 },
    { key: 'evening', label: 'Evening', from: 16, to: Math.max(endHour, 16) }
  ]
  return sections
    .map((s) => {
      const list = events.filter((e) => sectionOf(e.at, day.date) === s.key)
      return {
        key: s.key,
        label: s.label,
        range: `${hourText(s.from)} – ${hourText(s.to)}`,
        events: list,
        taskCount: list.filter((e) => e.kind === 'ticks').reduce((n, e) => n + e.labels.length, 0),
        walkCount: list.filter((e) => e.kind === 'walk').length,
        warnCount: list.filter((e) => e.warn).length
      }
    })
    .filter((s) => s.events.length)
}

// ---- The report's checklist ----

// Tasks grouped by the pets they're for ("Mochi", "Kopi", or "Mochi and Kopi" for shared tasks).
// With notDoneFirst, tasks with something missing come first in each group.
export function checklistGroups(summary, notDoneFirst = true) {
  const groups = new Map()
  for (const t of summary.tasks) {
    const name = joinNames(t.petNames)
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(t)
  }
  return [...groups].map(([name, tasks]) => ({
    name,
    tasks: notDoneFirst ? [...tasks].sort((a, b) => (b.missing > 0) - (a.missing > 0)) : tasks
  }))
}

// ---- Today card timeline (owner) ----

// The owner's Today timeline, latest first: session started, each tick, walks started and finished, session ended.
// `session` is one session from GET /api/visits/today; `walks` are that day's walks, if the page has them.
export function todayEvents(session, walks = []) {
  const visit = session.visit
  if (!visit) return []
  const pets = session.booking.pets ?? []
  const itemById = new Map((session.items ?? []).map((i) => [String(i._id), i]))
  const events = [{
    id: 'start', at: visit.startedAt, big: true,
    text: visit.startCheck ? `Session started · "${visit.startCheck.note}"` : 'Session started'
  }]
  for (const t of (visit.completedTasks ?? []).filter((x) => !x.walk)) {
    const item = itemById.get(String(t.task))
    const petPart = item && pets.length > 1 ? ` (${joinNames(petNamesFor(item, pets))})` : ''
    events.push({ id: `tick-${t._id ?? t.at}`, at: t.at, big: false, text: `✓ ${item?.title ?? t.title}${petPart}` })
  }
  for (const w of walks) {
    if (w.startedAt) events.push({ id: `walk-start-${w._id}`, at: w.startedAt, big: true, text: `Walk started${w.routeName ? ` · ${w.routeName}` : ''}` })
    if (w.endedAt && w.status !== 'in-progress') {
      events.push({ id: `walk-end-${w._id}`, at: w.endedAt, big: true, text: `Walk ${w.status === 'ended-early' ? 'ended early' : 'finished'} · ${km(w.distanceM)}` })
    }
  }
  if (visit.status === 'completed') events.push({ id: 'end', at: visit.endedAt, big: true, text: 'Session ended' })
  return events.sort((a, b) => new Date(b.at) - new Date(a.at))
}
