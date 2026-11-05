// Test data shared by the component tests: one 3-day booking's care report, shaped like
// GET /api/visits/recent and GET /api/visits/booking/:id/report send it (server/src/utils/visitReports.js).
// Day 1 was a normal day. Day 2 has every kind of location record: off route (owner notified twice, once not),
// left home without a walk, a long and a short location gap. Day 3 never had a session, so it isn't in `days`.
const at = (date, time) => `${date}T${time}:00+08:00`
const PETS = [{ _id: 'p1', name: 'Mochi', species: 'Dog' }]
const ITEMS = [
  { _id: 't-feed', category: 'feed', title: 'Meals', dailyFrequency: 1, petIds: ['p1'] },
  { _id: 't-walk', category: 'walk', title: 'Evening walk', dailyFrequency: 1, petIds: ['p1'] }
]

const day1 = {
  dayNumber: 1, date: '2026-11-02', startTime: '09:00', endTime: '17:00', items: ITEMS,
  visit: {
    _id: 'v1', status: 'completed', startedAt: at('2026-11-02', '09:00'), endedAt: at('2026-11-02', '16:55'),
    completedTasks: [{ task: 't-feed', title: 'Meals', at: at('2026-11-02', '09:10') }, { task: 't-walk', title: 'Evening walk', at: at('2026-11-02', '16:40'), walk: 'w1' }],
    awayEpisodes: [], locationGaps: [], report: { notes: 'A quiet day.', photos: [] }
  },
  walks: [{
    _id: 'w1', task: 't-walk', mode: 'route', routeName: 'SMU loop', status: 'completed',
    startedAt: at('2026-11-02', '16:00'), endedAt: at('2026-11-02', '16:40'), distanceM: 1300, durationS: 2400, deviations: []
  }]
}

const day2 = {
  dayNumber: 2, date: '2026-11-03', startTime: '09:00', endTime: '17:00', items: ITEMS,
  visit: {
    _id: 'v2', status: 'completed', startedAt: at('2026-11-03', '09:00'), endedAt: at('2026-11-03', '16:58'),
    completedTasks: [{ task: 't-feed', title: 'Meals', at: at('2026-11-03', '09:10') }, { task: 't-walk', title: 'Evening walk', at: at('2026-11-03', '16:40'), walk: 'w2' }],
    awayEpisodes: [{ startedAt: at('2026-11-03', '12:30'), endedAt: at('2026-11-03', '12:58'), maxDistanceM: 380 }],
    locationGaps: [
      { startedAt: at('2026-11-03', '15:05'), endedAt: at('2026-11-03', '15:30'), reason: 'stopped', resumedAtHome: true },
      { startedAt: at('2026-11-03', '10:00'), endedAt: at('2026-11-03', '10:12'), reason: 'blocked', resumedAtHome: true }
    ],
    report: { notes: 'Mochi pulled on the lead.', photos: [] }
  },
  walks: [{
    _id: 'w2', task: 't-walk', mode: 'route', routeName: 'SMU loop', status: 'completed',
    startedAt: at('2026-11-03', '16:00'), endedAt: at('2026-11-03', '16:40'), distanceM: 1400, durationS: 2400,
    deviations: [
      { startedAt: at('2026-11-03', '16:08'), endedAt: at('2026-11-03', '16:12'), maxDistanceM: 70, ownerNotifiedAt: at('2026-11-03', '16:09') },
      { startedAt: at('2026-11-03', '16:20'), endedAt: at('2026-11-03', '16:26'), maxDistanceM: 62, ownerNotifiedAt: at('2026-11-03', '16:21') },
      { startedAt: at('2026-11-03', '16:30'), endedAt: at('2026-11-03', '16:32'), maxDistanceM: 40, ownerNotifiedAt: null }
    ]
  }]
}

// reviewOpenUntil: when reviews close (milliseconds). Defaults to 20 days from now.
export function reportEntry({ reviewOpenUntil = Date.now() + 20 * 24 * 60 * 60 * 1000, review = null } = {}) {
  return {
    booking: {
      _id: 'b1', status: 'completed', startDate: '2026-11-02', endDate: '2026-11-04', startTime: '09:00', endTime: '17:00',
      sitter: { _id: 's1', username: 'SeedSitter' }, owner: { _id: 'o1', username: 'SeedOwner' }, pets: PETS
    },
    endedAt: Date.parse(at('2026-11-04', '17:00')),
    reviewOpenUntil,
    totalDays: 3,
    days: [structuredClone(day1), structuredClone(day2)],
    review,
    messageCount: 0
  }
}
