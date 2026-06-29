export type UserRole = 'OWNER' | 'ADMIN' | 'RECEPTIONIST'
export type BikeStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE'
export type BikeRentalStatus = 'ACTIVE' | 'RETURNED' | 'CANCELLED'
export type RoomType = 'FAMILY' | 'WINDOW' | 'BALCONY' | 'REGULAR'
export type RoomStatus = 'AVAILABLE' | 'DIRTY' | 'CLEANING' | 'OUT_OF_ORDER'
export type DisplayStatus =
  | 'AVAILABLE' | 'OCCUPIED' | 'ARRIVAL_TODAY' | 'CHECKOUT_TODAY'
  | 'DIRTY' | 'CLEANING' | 'OUT_OF_ORDER' | 'OVERBOOKING'
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW'
export type BookingAction = 'confirm' | 'check_in' | 'check_out' | 'cancel' | 'no_show'
export type OTASource = 'AGODA' | 'BOOKING_COM' | 'TRAVELOKA' | 'ZALO' | 'DIRECT'
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
  active_bike_names: string[]
}

export interface DashboardStats {
  total_rooms: number
  occupied: number
  available: number
  arrivals_today: number
  checkouts_today: number
  dirty: number
  occupancy_warning_dates: string[]
}

export interface CommissionRate {
  ota_source: string
  rate: string
}

export interface GuestLookup {
  id: number
  full_name: string
  phone: string | null
  id_type: string | null
  id_number: string | null
  times_stayed: number
  notes: string | null
}

export interface Booking {
  id: number
  booking_ref: string | null
  room_id: number | null
  room_number: string | null
  guest_name: string
  guest_phone: string | null
  guest_id_type: string | null
  guest_id_number: string | null
  check_in_date: string
  check_out_date: string
  num_guests: number
  ota_source: OTASource
  status: BookingStatus
  total_price: string
  collected_amount: string
  notes: string | null
  is_archived: boolean
  archived_at: string | null
}

export interface CalendarBooking {
  id: number
  room_id: number | null
  room_number: string | null
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

export interface BookingLog {
  id: number
  action: string
  description: string
  created_by_name: string | null
  created_at: string
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

export interface RoomTypeBreakdown {
  room_type: string     // FAMILY | WINDOW | BALCONY | REGULAR | UNASSIGNED
  bookings: number
  revenue: string
  net_revenue: string
  nights: number
}

export interface MonthlyRevenue {
  start_date: string
  end_date: string
  total_bookings: number
  total_revenue: string
  total_collected: string
  total_net_revenue: string
  outstanding: string
  occupancy_rate: string   // "0.0000" – "1.0000"
  by_source: SourceBreakdown[]
  by_room_type: RoomTypeBreakdown[]
  by_payment_method: PaymentMethodBreakdown
  bike_revenue: string
  bike_collected: string
  bike_outstanding: string
}

// Daily Operations Report
export interface BookingSummaryRow {
  id: number
  room_number: string | null
  guest_name: string
  check_in_date: string
  check_out_date: string
  total_price: string
  collected_amount: string
  status: BookingStatus
  ota_source: OTASource
  bike_names: string[]
  bike_outstanding: string
}

export interface BikeReturnRow {
  bike_rental_id: number
  booking_id: number
  bike_name: string
  plate_number: string | null
  room_number: string | null
  guest_name: string
  outstanding: string
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

export interface Bike {
  id: number
  name: string
  plate_number: string | null
  daily_rate: string
  status: BikeStatus
  notes: string | null
  created_at: string
}

export interface BikePayment {
  id: number
  bike_rental_id: number
  amount: string
  method: PaymentMethod
  paid_at: string
  recorded_by_name: string | null
  notes: string | null
}

export interface BikeRental {
  id: number
  bike_id: number
  bike_name: string
  plate_number: string | null
  booking_id: number
  room_number: string | null
  guest_name: string
  start_date: string
  end_date: string
  num_days: number
  daily_rate: string
  total_amount: string
  collected_amount: string
  status: BikeRentalStatus
  notes: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
  payments: BikePayment[]
}

export interface BikeRentalReportRow {
  booking_id: number
  room_number: string | null
  guest_name: string
  check_in_date: string
  check_out_date: string
  rentals: BikeRental[]
  total_expected: string
  total_collected: string
  outstanding: string
}

export interface BikeRentalReport {
  start_date: string
  end_date: string
  rows: BikeRentalReportRow[]
  grand_expected: string
  grand_collected: string
  grand_outstanding: string
}

export interface DailyReport {
  date: string
  arrivals: BookingSummaryRow[]
  departures: BookingSummaryRow[]
  in_house: BookingSummaryRow[]
  tomorrow_arrivals: BookingSummaryRow[]
  revenue: RevenueSummary
  housekeeping: HousekeepingSummary
  bike_returns_today: BikeReturnRow[]
  active_bike_count: number
}
