import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true
})

// The chat on a booking (server: /api/bookings/:id/messages)
// No try/catch here: errors are passed up to the caller, which decides what to show
export const messageApi = {
  // `after` (an ISO time) is optional: with it, only messages from that time on come back
  async getMessages(bookingId, after) {
    const res = await api.get(`/bookings/${bookingId}/messages`, { params: after ? { after } : {} })
    return res.data
  },

  async send(bookingId, text) {
    const res = await api.post(`/bookings/${bookingId}/messages`, { text })
    return res.data
  }
}
