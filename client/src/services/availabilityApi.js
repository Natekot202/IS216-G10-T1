import axios from 'axios'

// Same setup as bookingApi.js: Vite forwards /api to the server, and
// withCredentials sends the login cookie.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true
})

// The sitter's own calendar data (sitter login needed)
export const availabilityApi = {
  // [{ date: '2026-10-20', status: 'available', slots: [540, 570, ...] }, ...]
  getMine: () => api.get('/availability/me').then((res) => res.data),
  // accepted / paid / in-progress bookings, with owner and pet names
  getMyBookings: () => api.get('/availability/me/bookings').then((res) => res.data),
  // changes: [{ date, slots }, ...]
  save: (changes) => api.put('/availability/me', { changes }).then((res) => res.data)
}
