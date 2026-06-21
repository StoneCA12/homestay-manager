export type UserRole = 'OWNER' | 'ADMIN' | 'RECEPTIONIST'
export type RoomType = 'SINGLE' | 'DOUBLE' | 'TWIN' | 'TRIPLE' | 'SUITE'
export type RoomStatus = 'AVAILABLE' | 'DIRTY' | 'CLEANING' | 'OUT_OF_ORDER'
export type DisplayStatus =
  | 'AVAILABLE' | 'OCCUPIED' | 'ARRIVAL_TODAY' | 'CHECKOUT_TODAY'
  | 'DIRTY' | 'CLEANING' | 'OUT_OF_ORDER' | 'OVERBOOKING'
export type BookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW'
export type BookingAction = 'check_in' | 'check_out' | 'cancel' | 'no_show'
export type OTASource = 'AGODA' | 'BOOKING_COM' | 'TRAVELOKA' | 'DIRECT'
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'OTA_COLLECTED'
export type ExpenseCategory = 'CLEANING' | 'SUPPLIES' | 'OTHER' | 'UTILITIES' | 'SALARIES' | 'MAINTENANCE'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
}

export interface Room {
  id: number
  room_number: string
  room_type: RoomType
  floor: number
  capacity: number
  base_price: string
  housekeeping_status: RoomStatus
  display_status: DisplayStatus
  guest_name: string | null
  check_out_date: string | null
}

export interface DashboardStats {
  total_rooms: number
  occupied: number
  available: number
  arrivals_today: number
  checkouts_today: number
  dirty: number
}

export interface Booking {
  id: number
  booking_ref: string | null
  room_number: string
  guest_name: string
  check_in_date: string
  check_out_date: string
  num_guests: number
  ota_source: OTASource
  status: BookingStatus
  total_price: string
  collected_amount: string
  notes: string | null
}

export interface CalendarBooking {
  id: number
  room_id: number
  room_number: string
  guest_name: string
  check_in_date: string
  check_out_date: string
  status: BookingStatus
  ota_source: OTASource
  total_price: string
  collected_amount: string
}

export interface Payment {
  id: number
  booking_id: number
  amount: string
  method: PaymentMethod
  paid_at: string
  recorded_by_name: string | null
  notes: string | null
}

export interface Expense {
  id: number
  category: ExpenseCategory
  amount: string
  expense_date: string
  description: string | null
  recorded_by_name: string | null
  created_at: string
}

export interface DailyRevenue {
  date: string
  active_bookings: number
  total_booked: string
  total_collected: string
  outstanding: string
}

export interface SourceBreakdown {
  source: string
  bookings: number
  revenue: string
  collected: string
  commission_rate: string
  net_revenue: string
}

export interface PaymentMethodBreakdown {
  cash: string
  bank_transfer: string
  ota_collected: string
  total: string
}

export interface MonthlyRevenue {
  start_date: string
  end_date: string
  total_bookings: number
  total_revenue: string
  total_collected: string
  total_net_revenue: string
  outstanding: string
  by_source: SourceBreakdown[]
  by_payment_method: PaymentMethodBreakdown
}

// Daily Operations Report
export interface BookingSummaryRow {
  id: number
  room_number: string
  guest_name: string
  check_in_date: string
  check_out_date: string
  total_price: string
  collected_amount: string
  status: BookingStatus
  ota_source: OTASource
}

export interface HousekeepingSummary {
  dirty: number
  cleaning: number
  out_of_order: number
  available: number
}

export interface RevenueSummary {
  total_booked: string
  total_collected: string
  outstanding: string
}

export interface DailyReport {
  date: string
  arrivals: BookingSummaryRow[]
  departures: BookingSummaryRow[]
  in_house: BookingSummaryRow[]
  tomorrow_arrivals: BookingSummaryRow[]
  revenue: RevenueSummary
  housekeeping: HousekeepingSummary
}
