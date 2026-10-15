import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true
})

export const bookingsApi = {
  getMine: (status) =>
    api.get('/bookings', { params: status ? { status } : {} }).then((res) => res.data),
  updateStatus: (id, status) =>
    api.patch(`/bookings/${id}/status`, { status }).then((res) => res.data)
}