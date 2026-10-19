import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true
})

export const bookingsApi = {
  getMine: (status) =>
    api.get('/bookings', { params: status ? { status } : {} }).then((res) => res.data),

  updateStatus: (id, status) =>
    api.patch(`/bookings/${id}/status`, { status }).then((res) => res.data),
  
  // The care tasks the owner added to a booking request: { items: [...] }
  getCareTasks: (id) => api.get(`/bookings/${id}/care-tasks`).then((res) => res.data)
}