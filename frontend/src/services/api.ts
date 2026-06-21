import axios from 'axios'
import type { AuthResponse, Booking, DashboardStats, Room } from '../types'

const api = axios.create({ baseURL: '/api/v1' })

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, clear session and redirect to login
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),
  me: () => api.get<AuthResponse['user']>('/auth/me').then((r) => r.data),
}

export const roomsApi = {
  list: () => api.get<Room[]>('/rooms/').then((r) => r.data),
  stats: () => api.get<DashboardStats>('/rooms/stats').then((r) => r.data),
  updateStatus: (roomId: number, toStatus: string, notes?: string) =>
    api.patch(`/housekeeping/${roomId}/status`, { to_status: toStatus, notes }).then((r) => r.data),
}

export const bookingsApi = {
  list: () => api.get<Booking[]>('/bookings/').then((r) => r.data),
  today: () => api.get<Booking[]>('/bookings/today').then((r) => r.data),
}
