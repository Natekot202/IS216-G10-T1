import axios from 'axios'

// Same setup as bookingApi.js: Vite forwards /api to the server, withCredentials sends the login cookie
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true
})

export const paymentsApi = {
  // Owner starts paying for a completed booking. The server asks Stripe for a checkout page
  // and sends back its link: { url }. The page then sends the owner there.
  checkout: (bookingId) => api.post('/payments/checkout', { bookingId }).then((res) => res.data),
  // After Stripe sends the owner back: ask the server to check with Stripe that it was really paid
  confirm: (sessionId) => api.post('/payments/confirm', { sessionId }).then((res) => res.data),
  // The owner pressed "back" on Stripe's page without paying: mark that attempt as rejected
  cancel: (paymentId) => api.post(`/payments/${paymentId}/cancel`).then((res) => res.data),
  // My payment records (sitter: paid to me, owner: paid by me)
  getMine: () => api.get('/payments/mine').then((res) => res.data)
}