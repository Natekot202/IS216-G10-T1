// Sample tasklists for front-end testing only. Do NOT send this file to teammates.
// Shape matches server/models/Tasklist.js exactly, as it would arrive from
// GET /api/bookings/:id/tasklist. One tasklist per booking, linked by bookingId.
// Which visits are ticked off is NOT in here, see sampleTaskCompletions.js.
//
// Each task has a short version (category, title, pets, times, amounts) and full details
// (instructions, ownerNote, referencePhotos, medication name/dosage). Sitters only get the
// full details once the booking is paid, see findTasklist() below.
//
// `times` are local "HH:mm". `days` is empty for "every day of the booking".

// Fields hidden from sitters before the booking is paid. Same list as DETAIL_FIELDS in Tasklist.js.
const DETAIL_FIELDS = ['instructions', 'ownerNote', 'referencePhotos', 'medicationName', 'dosage', 'withFood']

export const sampleTasklists = [
  // b1: Aisyah's booking, all five task types
  {
    _id: 'c1',
    bookingId: 'b1',
    items: [
      {
        _id: 't1', category: 'feed', title: 'Feed Mochi', petIds: ['p1'],
        times: ['08:00', '18:00'], days: [], requiresPhoto: false,
        food: 'kibble', amount: 1, unit: 'cup',
        instructions: 'Mix a little warm water into the kibble. Remove the bowl after 20 minutes.',
        ownerNote: 'Kibble is in the cupboard under the sink.', referencePhotos: [],
      },
      {
        _id: 't2', category: 'feed', title: 'Feed Luna', petIds: ['p2'],
        times: ['08:30', '19:00'], days: [], requiresPhoto: false,
        food: 'wet food', amount: 0.5, unit: 'can',
        instructions: 'Keep the other half in the fridge.', ownerNote: '', referencePhotos: [],
      },
      {
        _id: 't3', category: 'walk', title: 'Evening walk', petIds: ['p1', 'p2'],
        times: ['17:00'], days: [], requiresPhoto: true,
        distanceKm: 1.5, durationMinutes: 30,
        instructions: 'Keep Mochi on the lead near the road. Luna pulls, so use the harness.',
        ownerNote: 'Harness is on the hook by the door.', referencePhotos: [],
      },
      {
        _id: 't4', category: 'medication', title: 'Luna joint supplement', petIds: ['p2'],
        times: ['08:30'], days: [], requiresPhoto: false,
        medicationName: 'Joint supplement', dosage: '1 tablet', withFood: true,
        instructions: 'Hide it in a small piece of cheese.', ownerNote: '', referencePhotos: [],
      },
      {
        _id: 't5', category: 'groom', title: 'Brush Mochi', petIds: ['p1'],
        times: ['20:00'], days: [], requiresPhoto: false,
        service: 'brush',
        instructions: "Brush gently and skip the belly, he doesn't like it.", ownerNote: '', referencePhotos: [],
      },
      {
        _id: 't6', category: 'other', title: 'Water the balcony plants', petIds: [],
        times: ['09:00'], days: [], requiresPhoto: false,
        instructions: 'One watering can, left side only.', ownerNote: '', referencePhotos: [],
      },
    ],
    createdAt: '2026-10-12T03:00:00.000Z',
    updatedAt: '2026-10-12T03:00:00.000Z',
  },

  // b2: Marcus's booking in the same trip, but a different set of tasks.
  // t13 is a one-off: only on 24 Oct (the `days` field).
  {
    _id: 'c2',
    bookingId: 'b2',
    items: [
      {
        _id: 't11', category: 'feed', title: 'Feed Mochi', petIds: ['p1'],
        times: ['08:00', '18:00'], days: [], requiresPhoto: false,
        food: 'kibble', amount: 1, unit: 'cup',
        instructions: 'Mix a little warm water into the kibble.', ownerNote: '', referencePhotos: [],
      },
      {
        _id: 't12', category: 'walk', title: 'Morning walk', petIds: ['p1', 'p2'],
        times: ['07:30'], days: [], requiresPhoto: false,
        durationMinutes: 45,
        instructions: '', ownerNote: '', referencePhotos: [], // details not added yet
      },
      {
        _id: 't13', category: 'groom', title: 'Nail trim Luna', petIds: ['p2'],
        times: ['11:00'], days: ['2026-10-24T00:00:00.000Z'], requiresPhoto: true,
        service: 'nail-trim',
        instructions: '', ownerNote: '', referencePhotos: [],
      },
    ],
    createdAt: '2026-10-12T03:00:00.000Z',
    updatedAt: '2026-10-12T03:00:00.000Z',
  },

  // b3: a one-sitter trip, short list, details not added yet
  {
    _id: 'c3',
    bookingId: 'b3',
    items: [
      {
        _id: 't7', category: 'feed', title: 'Feed Luna', petIds: ['p2'],
        times: ['08:00'], days: [], requiresPhoto: false,
        food: 'dry food', amount: 1, unit: 'scoop',
        instructions: '', ownerNote: '', referencePhotos: [],
      },
      {
        _id: 't8', category: 'walk', title: 'Morning walk', petIds: ['p2'],
        times: ['07:30'], days: [], requiresPhoto: false,
        durationMinutes: 20,
        instructions: '', ownerNote: '', referencePhotos: [],
      },
    ],
    createdAt: '2026-10-12T03:00:00.000Z',
    updatedAt: '2026-10-12T03:00:00.000Z',
  },

  // b4: in-progress booking. Its ticked visits are in sampleTaskCompletions.js.
  // Add a booking with _id 'b4' and status 'in-progress' to sampleBookings to use it.
  {
    _id: 'c4',
    bookingId: 'b4',
    items: [
      {
        _id: 't9', category: 'feed', title: 'Feed Mochi', petIds: ['p1'],
        times: ['08:00', '18:00'], days: [], requiresPhoto: true,
        food: 'kibble', amount: 1, unit: 'cup',
        instructions: 'Mix a little warm water into the kibble.', ownerNote: '', referencePhotos: [],
      },
      {
        _id: 't10', category: 'medication', title: 'Luna joint supplement', petIds: ['p2'],
        times: ['08:30'], days: [], requiresPhoto: false,
        medicationName: 'Joint supplement', dosage: '1 tablet', withFood: true,
        instructions: 'Hide it in a small piece of cheese.', ownerNote: '', referencePhotos: [],
      },
    ],
    createdAt: '2026-10-12T03:00:00.000Z',
    updatedAt: '2026-10-12T03:00:00.000Z',
  },
]

// Finds the tasklist for one booking, like GET /api/bookings/:id/tasklist would.
// Pass { sitterView: true } to get the short version a sitter sees before the booking is paid.
export function findTasklist(bookingId, { sitterView = false } = {}) {
  const found = sampleTasklists.find((t) => t.bookingId === bookingId)
  if (!found) return null
  if (!sitterView) return found
  return {
    ...found,
    items: found.items.map((item) => {
      const copy = { ...item }
      DETAIL_FIELDS.forEach((f) => delete copy[f])
      return copy
    }),
  }
}
