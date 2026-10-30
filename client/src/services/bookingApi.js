import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true
})
// axios.creates a configured axios client and stores it in api 
// so api is an object with methods such as get,post,patch etc 

export const bookingsApi = {
  getMine: (status) =>
    api.get('/bookings', { params: status ? { status } : {} }).then((res) => res.data),

  updateStatus: (id, status) =>
    api.patch(`/bookings/${id}/status`, { status }).then((res) => res.data),
  
  // The owner sends a booking request: { sitterId, petIds, startDate, startTime, endDate, endTime, notes, tasks }
  create: (request) => api.post('/bookings', request).then((res) => res.data),

  // One booking, for the Booking Detail page
  getOne: (id) => api.get(`/bookings/${id}`).then((res) => res.data),
  // The owner confirms a booking the sitter accepted, which makes it final.
  // (No try/catch: errors go to the page, which shows the message.)
  confirm: async (id) => {
    const res = await api.patch(`/bookings/${id}/confirm`)
    return res.data
  },
  // The owner or the sitter cancels a pending, accepted or confirmed booking
  cancel: (id) => api.patch(`/bookings/${id}/cancel`).then((res) => res.data),
  // The care tasks the owner added to a booking request: { items: [...] }
  getCareTasks: (id) => api.get(`/bookings/${id}/care-tasks`).then((res) => res.data)
}