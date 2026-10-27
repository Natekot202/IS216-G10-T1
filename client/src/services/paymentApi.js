import axios from 'axios'

// Same setup as bookingApi.js: Vite forwards /api to the server, withCredentials sends the login cookie
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true
})

export const paymentsApi = {
  // Owner pays for a completed booking: { bookingId, cardNumber, expiry, cvc }
  pay: (details) => api.post('/payments', details).then((res) => res.data),
  // My payment records (sitter: paid to me, owner: paid by me)
  getMine: () => api.get('/payments/mine').then((res) => res.data)
}