// Unit tests (Vitest) for utils/locationRecords.js: what the care report records about the sitter's location.
// These are plain functions (a visit in, the fields to save out), so no server or database is needed.
// Run with: pnpm test   (in the server folder)
import { describe, it, expect } from 'vitest'
import { recordReading, recordBlocked, closeRecords } from '../locationRecords.js'

const HOME = [103.85, 1.2965]
const AT_HOME = { location: HOME, accuracy: 10 }
const AWAY = { location: [103.85, 1.2985], accuracy: 10 } // about 220 m north of the home
const NEAR_BUT_VAGUE = { location: [103.85, 1.2973], accuracy: 30 } // about 90 m away, but within 75 m once its accuracy is counted

const MINUTE = 60 * 1000
const t0 = new Date('2026-11-05T02:00:00Z') // 10:00 am in Singapore
const after = (minutes) => new Date(t0.getTime() + minutes * MINUTE)

// A session that has just started at the home
const freshVisit = () => ({ home: HOME, awayEpisodes: [], locationGaps: [], awayStreak: null, lastLocation: { at: t0 } })

// Sends readings one after another, the way the server saves each update, and returns the visit at the end.
// readings: [[reading, minutesAfterStart, walking?], ...]
function send(visit, readings) {
  for (const [reading, minutes, walking = false] of readings) {
    const now = after(minutes)
    visit = { ...visit, ...recordReading(visit, reading, walking, now), lastLocation: { at: now } }
  }
  return visit
}

describe('TestSuite: left home, not on a walk', () => {
  it('Test1: two away updates in a row are not recorded yet (could be a GPS jump)', () => {
    const visit = send(freshVisit(), [[AWAY, 0.25], [AWAY, 0.5]])
    expect(visit.awayEpisodes).toHaveLength(0)
    expect(visit.awayStreak.count).toBe(2)
  })

  it('Test2: the 3rd away update in a row opens an episode that starts at the first one', () => {
    const visit = send(freshVisit(), [[AWAY, 0.25], [AWAY, 0.5], [AWAY, 0.75]])
    expect(visit.awayEpisodes).toHaveLength(1)
    expect(visit.awayEpisodes[0].startedAt).toEqual(after(0.25))
    expect(visit.awayEpisodes[0].endedAt).toBeUndefined()
    expect(visit.awayEpisodes[0].maxDistanceM).toBeGreaterThan(200)
  })

  it('Test3: coming back home closes the episode', () => {
    const visit = send(freshVisit(), [[AWAY, 0.25], [AWAY, 0.5], [AWAY, 0.75], [AT_HOME, 1]])
    expect(visit.awayEpisodes).toHaveLength(1)
    expect(visit.awayEpisodes[0].endedAt).toEqual(after(1))
    expect(visit.awayStreak).toBeNull()
  })

  it('Test4: an update at home in between starts the count again', () => {
    const visit = send(freshVisit(), [[AWAY, 0.25], [AWAY, 0.5], [AT_HOME, 0.75], [AWAY, 1]])
    expect(visit.awayEpisodes).toHaveLength(0)
    expect(visit.awayStreak.count).toBe(1)
  })

  it('Test5: being away during a walk is never recorded', () => {
    const visit = send(freshVisit(), [[AWAY, 0.25, true], [AWAY, 0.5, true], [AWAY, 0.75, true], [AWAY, 1, true]])
    expect(visit.awayEpisodes).toHaveLength(0)
  })

  it('Test6: a vague reading that could still be at the home does not count as away', () => {
    const visit = send(freshVisit(), [[NEAR_BUT_VAGUE, 0.25], [NEAR_BUT_VAGUE, 0.5], [NEAR_BUT_VAGUE, 0.75]])
    expect(visit.awayEpisodes).toHaveLength(0)
  })
})

describe('TestSuite: location gaps', () => {
  it('Test1: updates every 15 seconds leave no gap', () => {
    const visit = send(freshVisit(), [[AT_HOME, 0.25], [AT_HOME, 0.5], [AT_HOME, 0.75]])
    expect(visit.locationGaps).toHaveLength(0)
  })

  it('Test2: no update for over a minute is recorded as a "stopped" gap, from 1 minute after the last update', () => {
    const visit = send(freshVisit(), [[AT_HOME, 0.25], [AT_HOME, 20.25]])
    expect(visit.locationGaps).toHaveLength(1)
    expect(visit.locationGaps[0]).toMatchObject({ reason: 'stopped', resumedAtHome: true })
    expect(visit.locationGaps[0].startedAt).toEqual(after(1.25))
    expect(visit.locationGaps[0].endedAt).toEqual(after(20.25))
  })

  it('Test3: a gap that ends away from the home says so', () => {
    const visit = send(freshVisit(), [[AWAY, 10]])
    expect(visit.locationGaps[0].resumedAtHome).toBe(false)
  })

  it('Test4: location switched off opens a "blocked" gap once, and the next reading closes it', () => {
    let visit = freshVisit()
    visit = { ...visit, ...recordBlocked(visit, after(1)) }
    visit = { ...visit, ...recordBlocked(visit, after(2)) } // still blocked: no second gap
    expect(visit.locationGaps).toHaveLength(1)
    expect(visit.locationGaps[0]).toMatchObject({ reason: 'blocked', startedAt: after(1) })
    expect(visit.locationGaps[0].endedAt).toBeUndefined()

    visit = send(visit, [[AT_HOME, 6]])
    expect(visit.locationGaps).toHaveLength(1)
    expect(visit.locationGaps[0]).toMatchObject({ endedAt: after(6), resumedAtHome: true })
  })
})

describe('TestSuite: closeRecords (the session ends)', () => {
  it('Test1: an episode still open ends when the session ends', () => {
    const visit = send(freshVisit(), [[AWAY, 0.25], [AWAY, 0.5], [AWAY, 0.75]])
    const closed = closeRecords(visit, after(30))
    expect(closed.awayEpisodes[0].endedAt).toEqual(after(30))
    expect(closed.awayStreak).toBeNull()
  })

  it('Test2: updates that had already stopped are recorded as a gap up to the end', () => {
    const visit = send(freshVisit(), [[AT_HOME, 0.25]])
    const closed = closeRecords(visit, after(40))
    expect(closed.locationGaps).toHaveLength(1)
    expect(closed.locationGaps[0]).toMatchObject({ reason: 'stopped', startedAt: after(1.25), endedAt: after(40) })
  })

  it('Test3: a session that was sharing until the end gets no gap', () => {
    const everyQuarterMinute = Array.from({ length: 119 }, (_, i) => [AT_HOME, (i + 1) * 0.25]) // up to 29.75 min
    const visit = send(freshVisit(), everyQuarterMinute)
    expect(closeRecords(visit, after(30)).locationGaps).toHaveLength(0)
  })
})
