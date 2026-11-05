// Unit tests (Vitest) for utils/visitReport.js: what the owner's care report says about a day.
// Covers the records the server keeps during a session:
//   off route on a walk (notified or not), left home without a walk, and location gaps.
// Run with: pnpm test   (in the client folder)
import { describe, it, expect } from 'vitest'
import { summarize, buildTimeline } from '../visitReport.js'

const DATE = '2026-11-04'
const at = (time) => `${DATE}T${time}:00+08:00` // a Singapore time on the report's day
const PETS = [{ _id: 'p1', name: 'Mochi' }]
const WALK_TASK = { _id: 't-walk', category: 'walk', title: 'Evening walk', dailyFrequency: 1, petIds: ['p1'] }

// One finished day. `visit` and `walks` override the parts a test cares about.
function makeDay({ visit = {}, walks = [] } = {}) {
  return {
    dayNumber: 1,
    date: DATE,
    startTime: '09:00',
    endTime: '17:00',
    items: [WALK_TASK],
    walks,
    visit: {
      status: 'completed',
      startedAt: at('09:00'),
      endedAt: at('17:00'),
      completedTasks: [{ task: 't-walk', title: 'Evening walk', at: at('16:40'), walk: 'w1' }],
      awayEpisodes: [],
      locationGaps: [],
      ...visit
    }
  }
}
// A route walk 4:00 to 4:40 pm with the given deviations
const walkWith = (deviations) => ({
  _id: 'w1', task: 't-walk', mode: 'route', routeName: 'SMU loop', status: 'completed',
  startedAt: at('16:00'), endedAt: at('16:40'), distanceM: 1300, durationS: 2400, deviations
})
const NOTIFIED_1 = { startedAt: at('16:08'), endedAt: at('16:12'), maxDistanceM: 70, ownerNotifiedAt: at('16:09') }
const NOTIFIED_2 = { startedAt: at('16:20'), endedAt: at('16:26'), maxDistanceM: 62, ownerNotifiedAt: at('16:21') }
const QUIET = { startedAt: at('16:30'), endedAt: at('16:32'), maxDistanceM: 40, ownerNotifiedAt: null }

const texts = (list) => list.map((x) => x.text)
const allEvents = (day) => buildTimeline(day, PETS).flatMap((s) => s.events)

describe('TestSuite: off-route records', () => {
  it('Test1: deviations the owner was notified about are a warning, with the furthest distance', () => {
    const s = summarize(makeDay({ walks: [walkWith([NOTIFIED_1, NOTIFIED_2])] }), PETS)
    expect(texts(s.warn)).toContain('Off route twice on evening walk · up to 70 m')
  })

  it('Test2: a short deviation under 50 m is only noted, not a warning', () => {
    const s = summarize(makeDay({ walks: [walkWith([QUIET])] }), PETS)
    expect(texts(s.warn).some((t) => t.startsWith('Off route'))).toBeFalsy()
    expect(texts(s.info)).toContain('Briefly off route once, not far enough to notify you')
  })

  it('Test3: the walk card lists each deviation and when the sitter got back on route', () => {
    const walk = allEvents(makeDay({ walks: [walkWith([NOTIFIED_1, QUIET])] })).find((e) => e.kind === 'walk')
    expect(walk.warn).toBe(true)
    expect(walk.routeCheck).toEqual({ text: 'Off route twice', warn: true })
    expect(walk.rows.map((r) => `${r.title}: ${r.text}`)).toEqual([
      'Off route: Up to 70 m. You were notified.',
      'Back on route: 4 min off',
      'Off route: Up to 40 m, not far enough to notify you.',
      'Back on route: 2 min off'
    ])
  })

  it('Test4: a walk that stayed on its route says so', () => {
    const walk = allEvents(makeDay({ walks: [walkWith([])] })).find((e) => e.kind === 'walk')
    expect(walk.routeCheck).toEqual({ text: 'On route', warn: false })
    expect(walk.warn).toBe(false)
  })
})

describe('TestSuite: left home, not on a walk', () => {
  const day = makeDay({ visit: { awayEpisodes: [{ startedAt: at('12:30'), endedAt: at('12:58'), maxDistanceM: 380 }] } })

  it('Test1: is a warning with how long the sitter was away', () => {
    expect(texts(summarize(day, PETS).warn)).toContain('Left home, not on a walk · 28 min')
  })

  it('Test2: the timeline row says how far and when they got back', () => {
    const row = allEvents(day).find((e) => e.kind === 'away')
    expect(row.title).toBe('Left home, not on a walk')
    expect(row.text).toBe('Up to 380 m away. Back home at 12:58 pm, after 28 min.')
  })

  it('Test3: an episode still open when the session ended says they were not back', () => {
    const open = makeDay({ visit: { awayEpisodes: [{ startedAt: at('16:30'), maxDistanceM: 200 }] } })
    expect(allEvents(open).find((e) => e.kind === 'away').text).toBe('Up to 200 m away. Not back before the session ended.')
  })
})

describe('TestSuite: location gaps', () => {
  const day = makeDay({
    visit: {
      locationGaps: [
        { startedAt: at('15:05'), endedAt: at('15:30'), reason: 'stopped', resumedAtHome: true },
        { startedAt: at('10:00'), endedAt: at('10:12'), reason: 'blocked', resumedAtHome: false }
      ]
    }
  })

  it('Test1: a gap of 15 minutes or more is a warning', () => {
    expect(texts(summarize(day, PETS).warn)).toContain('Location stopped · 25 min')
  })

  it('Test2: a shorter gap is only noted', () => {
    const s = summarize(day, PETS)
    expect(texts(s.info)).toContain('Location gap · 12 min')
    expect(texts(s.warn)).not.toContain('Location stopped · 12 min')
  })

  it('Test3: the timeline rows say when sharing resumed, and whether it was at home', () => {
    const rows = allEvents(day).filter((e) => e.kind === 'gap')
    expect(rows.map((r) => [r.title, r.text, r.warn])).toEqual([
      ['Location gap · 12 min', 'Sharing resumed at 10:12 am.', false],
      ['Location stopped updating · 25 min', 'Sharing resumed at 3:30 pm, at home.', true]
    ])
  })
})

describe('TestSuite: a session that ended automatically', () => {
  it('Test1: is a warning, and the end row says the sitter did not end it', () => {
    const day = makeDay({ visit: { autoEnded: true, report: { notes: "The sitter didn't submit a report." } } })
    expect(texts(summarize(day, PETS).warn)).toContain('Ended automatically: the sitter did not end the session')
    expect(allEvents(day).find((e) => e.id === 'end').sub).toBe('Ended automatically, because the sitter did not end it.')
  })
})
