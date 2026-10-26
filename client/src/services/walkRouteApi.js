import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true
})

// The logged-in owner's recorded walking routes
// functions call server routes and controller functions 
export const walkRoutesApi = {
  async getMyRoutes() {
    const res = await api.get('/walk-routes')
    return res.data
  },

  async getById(id) {
    const res = await api.get(`/walk-routes/${id}`)
    return res.data
  },

  // path: [[lng, lat], ...]
  async create(name, path) {
    const res = await api.post('/walk-routes', { name, path })
    return res.data
  },

  // changes: { name } to rename and/or { path } to re-record
  async update(id, changes) {
    const res = await api.patch(`/walk-routes/${id}`, changes)
    return res.data
  },

  async remove(id) {
    const res = await api.delete(`/walk-routes/${id}`)
    return res.data
  }
}
