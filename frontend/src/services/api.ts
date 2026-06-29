import axios from 'axios'
import type {
  Bike, BikeRental, BikeRentalReport,
  Booking, BookingLog, CalendarBooking, CommissionRate, DailyReport, DailyRevenue,
  DashboardStats, Expense, GuestLookup, MonthlyRevenue, Payment, Room, User,
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
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword }),
}

export const roomsApi = {
  list: () => api.get<Room[]>('/rooms/').then((r) => r.data),
  available: (checkInDate: string, checkOutDate: string, roomType?: string) =>
    api.get<Room[]>('/rooms/available', { params: { check_in_date: checkInDate, check_out_date: checkOutDate, room_type: roomType } }).then((r) => r.data),
  stats: () => api.get<DashboardStats>('/rooms/stats').then((r) => r.data),
  updateStatus: (roomId: number, toStatus: string, notes?: string) =>
    api.patch(`/housekeeping/${roomId}/status`, { to_status: toStatus, notes }).then((r) => r.data),
  create: (data: { room_number: string; room_type: string; floor: number; capacity: number; base_price: number }) =>
    api.post<Room>('/rooms/', data).then((r) => r.data),
  update: (id: number, data: { room_number?: string; room_type?: string; floor?: number; capacity?: number; base_price?: number; housekeeping_status?: string }) =>
    api.patch<Room>(`/rooms/${id}`, data).then((r) => r.data),
}

export const bookingsApi = {
  list: (params?: { booking_status?: string; start_date?: string; end_date?: string; search?: string; archived?: boolean; limit?: number; offset?: number }) =>
    api.get<Booking[]>('/bookings/', { params }).then((r) => r.data),
  today: () => api.get<Booking[]>('/bookings/today').then((r) => r.data),
  getById: (id: number) => api.get<Booking>(`/bookings/${id}`).then((r) => r.data),
  calendar: (start: string, end: string) =>
    api.get<CalendarBooking[]>('/bookings/calendar', { params: { start, end } }).then((r) => r.data),
  create: (data: {
    room_id?: number | null
    guest_name: string
    guest_phone?: string
    guest_id_type?: string
    guest_id_number?: string
    check_in_date: string
    check_out_date: string
    num_guests?: number
    ota_source?: string
    total_price: number
    deposit_amount?: number
    booking_ref?: string
    notes?: string
  }) => api.post<Booking>('/bookings/', data).then((r) => r.data),
  update: (id: number, data: {
    room_id?: number | null
    guest_name?: string
    guest_phone?: string
    guest_id_type?: string
    guest_id_number?: string
    check_in_date?: string
    check_out_date?: string
    num_guests?: number
    ota_source?: string
    total_price?: number
    booking_ref?: string
    notes?: string
  }) => api.patch<Booking>(`/bookings/${id}`, data).then((r) => r.data),
  updateStatus: (id: number, action: string, room_id?: number, reason?: string) =>
    api.patch<Booking>(`/bookings/${id}/status`, { action, room_id, reason }).then((r) => r.data),
  archive: (id: number): Promise<Booking> =>
    api.post<Booking>(`/bookings/${id}/archive`).then((r) => r.data),
  restore: (id: number): Promise<Booking> =>
    api.post<Booking>(`/bookings/${id}/restore`).then((r) => r.data),
  getPayments: (id: number) =>
    api.get<Payment[]>(`/bookings/${id}/payments`).then((r) => r.data),
  addPayment: (id: number, data: { amount: number; method: string; notes?: string }) =>
    api.post<Booking>(`/bookings/${id}/payments`, data).then((r) => r.data),
  addLateCheckout: (id: number, data: { amount: number; notes?: string }) =>
    api.post<Booking>(`/bookings/${id}/late-checkout`, data).then((r) => r.data),
  walkIn: (data: {
    room_id: number
    guest_name: string
    guest_phone?: string
    guest_id_type?: string
    guest_id_number?: string
    check_in_date: string
    check_out_date: string
    num_guests?: number
    total_price: number
    deposit_amount?: number
    payment_method?: string
    notes?: string
  }): Promise<Booking> =>
    api.post<Booking>('/bookings/walk-in', data).then((r) => r.data),
  getLogs: (id: number): Promise<BookingLog[]> =>
    api.get<BookingLog[]>(`/bookings/${id}/logs`).then((r) => r.data),
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
  update: (id: number, data: { category?: string; amount?: number; expense_date?: string; description?: string }) =>
    api.patch<Expense>(`/expenses/${id}`, data).then((r) => r.data),
  delete: (id: number) =>
    api.delete(`/expenses/${id}`),
}

export const guestsApi = {
  lookup: (phone: string) =>
    api.get<GuestLookup>('/guests/lookup', { params: { phone } }).then((r) => r.data),
}

export const settingsApi = {
  listCommissionRates: () =>
    api.get<CommissionRate[]>('/settings/commission-rates').then((r) => r.data),
  updateCommissionRate: (otaSource: string, rate: number) =>
    api.patch<CommissionRate>(`/settings/commission-rates/${otaSource}`, { rate }).then((r) => r.data),
}

export const bikesApi = {
  listBikes: () => api.get<Bike[]>('/xe-may/bikes').then((r) => r.data),
  createBike: (data: { name: string; plate_number?: string; daily_rate: number; notes?: string }) =>
    api.post<Bike>('/xe-may/bikes', data).then((r) => r.data),
  updateBike: (id: number, data: { name?: string; plate_number?: string; daily_rate?: number; status?: string; notes?: string }) =>
    api.patch<Bike>(`/xe-may/bikes/${id}`, data).then((r) => r.data),
  deleteBike: (id: number) => api.delete(`/xe-may/bikes/${id}`),

  listRentals: (params?: { booking_id?: number; rental_status?: string; start_date?: string; end_date?: string }) =>
    api.get<BikeRental[]>('/xe-may/rentals', { params }).then((r) => r.data),
  createRental: (data: { bike_id: number; booking_id: number; start_date: string; end_date: string; notes?: string }) =>
    api.post<BikeRental>('/xe-may/rentals', data).then((r) => r.data),
  updateRental: (id: number, data: { start_date?: string; end_date?: string; notes?: string }) =>
    api.patch<BikeRental>(`/xe-may/rentals/${id}`, data).then((r) => r.data),
  returnRental: (id: number) =>
    api.patch<BikeRental>(`/xe-may/rentals/${id}/return`).then((r) => r.data),
  cancelRental: (id: number) => api.delete(`/xe-may/rentals/${id}`),
  addPayment: (rentalId: number, data: { amount: number; method: string; notes?: string }) =>
    api.post<BikeRental>(`/xe-may/rentals/${rentalId}/payments`, data).then((r) => r.data),

  report: (startDate: string, endDate: string) =>
    api.get<BikeRentalReport>('/xe-may/report', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data),
}

export const usersApi = {
  list: () => api.get<User[]>('/users/').then((r) => r.data),
  create: (data: { email: string; password: string; full_name: string; role: string }) =>
    api.post<User>('/users/', data).then((r) => r.data),
  toggleActive: (userId: number) =>
    api.patch<User>(`/users/${userId}/deactivate`).then((r) => r.data),
  delete: (userId: number) =>
    api.delete(`/users/${userId}`),
  resetPassword: (userId: number, newPassword: string) =>
    api.patch<User>(`/users/${userId}/reset-password`, { new_password: newPassword }).then((r) => r.data),
}

