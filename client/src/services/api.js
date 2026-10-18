import axios from 'axios'

// In dev, Vite proxies /api to the Express server (see vite.config.js),
// so VITE_API_URL only needs to be set explicitly for production builds.
const baseURL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL })

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
  removePicture: () => api.delete('/users/me/picture').then((res) => res.data)
}

// export default api
export const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
