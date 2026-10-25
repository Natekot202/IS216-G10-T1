import axios from 'axios'

// Same setup as bookingApi.js: Vite forwards /api to the server, and
// withCredentials sends the login cookie.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true
})

export const availabilityApi = {
  // ----- A sitter's days and busy times, for the booking form (anyone can read these) -----
  // [{ date: '2026-10-20', status: 'available', slots: [540, 570, ...] }, ...] from today on
  getForSitter: (sitterId) => api.get(`/availability/${sitterId}`).then((res) => res.data),
  // the times the sitter is already booked: [{ start: '2026-10-21T01:00:00.000Z', end: '...' }, ...]
  getBusy: (sitterId) => api.get(`/availability/${sitterId}/busy`).then((res) => res.data),

  // ----- The sitter's own calendar data (sitter login needed) -----
  // [{ date: '2026-10-20', status: 'available', slots: [540, 570, ...] }, ...]
  getMine: () => api.get('/availability/me').then((res) => res.data),
  // accepted / paid / in-progress bookings, with owner and pet names
  getMyBookings: () => api.get('/availability/me/bookings').then((res) => res.data),
  // changes: [{ date, slots }, ...]
  save: (changes) => api.put('/availability/me', { changes }).then((res) => res.data)
}
