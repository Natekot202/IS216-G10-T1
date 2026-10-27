import axios from 'axios'

// In dev, Vite proxies /api to the Express server (see vite.config.js),
// so VITE_API_URL only needs to be set explicitly for production builds.
const baseURL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL , withCredentials: true })

export const authApi = {
  me: () => api.get('/auth/me').then((res) => res.data),
  login: (data) => api.post('/auth/login', data).then((res) => res.data),
  register: (data) => api.post('/auth/register', data).then((res) => res.data),
  logout: () => api.post('/auth/logout').then((res) => res.data)
}

export const petsApi = {
  getAll: () => api.get('/pets').then((res) => res.data),
  getById: (id) => api.get(`/pets/${id}`).then((res) => res.data),
  create: (pet) => api.post('/pets', pet).then((res) => res.data),
  update: (id, pet) => api.put(`/pets/${id}`, pet).then((res) => res.data),
  remove: (id) => api.delete(`/pets/${id}`).then((res) => res.data)
}

export const usersApi = {
  getById: (id) => api.get(`/users/${id}`).then((r) => r.data),
  getPets: (id) => api.get(`/users/${id}/pets`).then((r) => r.data),
  getReviews: (id) => api.get(`/users/${id}/reviews`).then((r) => r.data),
  updateMe: (data) => api.put('/users/me', data).then((res) => res.data),
  updatePicture: (formData) => api.put('/users/me/picture', formData).then((res) => res.data),
  removePicture: () => api.delete('/users/me/picture').then((res) => res.data),
  addGallery: (formData) => api.post('/users/me/gallery', formData).then((res) => res.data),
  removeGalleryPhoto: (photoId) => api.delete(`/users/me/gallery/${photoId}`).then((res) => res.data),
  getBadges: (id) => api.get(`/users/${id}/badges`).then((r) => r.data)
}

export const visitsApi = {
  today: () => api.get('/visits/today').then((res) => res.data),
  start: (bookingId) => api.post(`/visits/booking/${bookingId}/start`).then((res) => res.data),
  setTask: (visitId, taskId, count) =>
    api.patch(`/visits/${visitId}/tasks/${taskId}`, { count }).then((res) => res.data),
  end: (visitId, formData) => api.post(`/visits/${visitId}/end`, formData).then((res) => res.data)
}

export const reviewsApi = {
  create: (data) => api.post('/reviews', data).then((res) => res.data),
  getForBooking: (bookingId) => api.get(`/reviews/booking/${bookingId}`).then((res) => res.data)
}

// export default api
// Empty by default so `${API}/api/...` is a relative URL: it goes to whichever site served the page
// and Vite's proxy forwards it to the server. A hard-coded http://localhost:5000 breaks on phones
// (localhost would mean the phone itself).
export const API = import.meta.env.VITE_API_URL || "";
