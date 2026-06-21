import axios from 'axios'
import type {
  Booking, CalendarBooking, DailyReport, DailyRevenue,
  DashboardStats, Expense, MonthlyRevenue, Payment, Room, User,
} from '../types'

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  login: (email: string, password: string) =>
    api.post<User>('/auth/login', { email, password }).then((r) => r.data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
}

export const roomsApi = {
  list: () => api.get<Room[]>('/rooms/').then((r) => r.data),
  stats: () => api.get<DashboardStats>('/rooms/stats').then((r) => r.data),
  updateStatus: (roomId: number, toStatus: string, notes?: string) =>
    api.patch(`/housekeeping/${roomId}/status`, { to_status: toStatus, notes }).then((r) => r.data),
}

export const bookingsApi = {
  list: (params?: { booking_status?: string; start_date?: string; end_date?: string }) =>
    api.get<Booking[]>('/bookings/', { params }).then((r) => r.data),
  today: () => api.get<Booking[]>('/bookings/today').then((r) => r.data),
  calendar: (start: string, end: string) =>
    api.get<CalendarBooking[]>('/bookings/calendar', { params: { start, end } }).then((r) => r.data),
  create: (data: {
    room_id: number
    guest_name: string
    guest_phone?: string
    check_in_date: string
    check_out_date: string
    num_guests?: number
    ota_source?: string
    total_price: number
    booking_ref?: string
    notes?: string
  }) => api.post<Booking>('/bookings/', data).then((r) => r.data),
  updateStatus: (id: number, action: string) =>
    api.patch<Booking>(`/bookings/${id}/status`, { action }).then((r) => r.data),
  getPayments: (id: number) =>
    api.get<Payment[]>(`/bookings/${id}/payments`).then((r) => r.data),
  addPayment: (id: number, data: { amount: number; method: string; notes?: string }) =>
    api.post<Booking>(`/bookings/${id}/payments`, data).then((r) => r.data),
}

export const revenueApi = {
  daily: () => api.get<DailyRevenue>('/revenue/daily').then((r) => r.data),
  summary: (startDate?: string, endDate?: string) =>
    api.get<MonthlyRevenue>('/revenue/summary', {
      params: { start_date: startDate, end_date: endDate },
    }).then((r) => r.data),
  dailyReport: (reportDate?: string) =>
    api.get<DailyReport>('/revenue/daily-report', {
      params: reportDate ? { report_date: reportDate } : {},
    }).then((r) => r.data),
}

export const expensesApi = {
  list: (params?: { start_date?: string; end_date?: string }) =>
    api.get<Expense[]>('/expenses/', { params }).then((r) => r.data),
  create: (data: { category: string; amount: number; expense_date: string; description?: string }) =>
    api.post<Expense>('/expenses/', data).then((r) => r.data),
}

export const usersApi = {
  list: () => api.get<User[]>('/users/').then((r) => r.data),
  create: (data: { email: string; password: string; full_name: string; role: string }) =>
    api.post<User>('/users/', data).then((r) => r.data),
  toggleActive: (userId: number) =>
    api.patch<User>(`/users/${userId}/deactivate`).then((r) => r.data),
}
