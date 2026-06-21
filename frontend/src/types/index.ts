export type UserRole = 'OWNER' | 'ADMIN' | 'RECEPTIONIST'

export type RoomType = 'SINGLE' | 'DOUBLE' | 'TWIN' | 'TRIPLE' | 'SUITE'

export type RoomStatus = 'AVAILABLE' | 'DIRTY' | 'CLEANING' | 'OUT_OF_ORDER'

export type DisplayStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'ARRIVAL_TODAY'
  | 'CHECKOUT_TODAY'
  | 'DIRTY'
  | 'CLEANING'
  | 'OUT_OF_ORDER'
  | 'OVERBOOKING'

export type BookingStatus = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW'

export type OTASource = 'AGODA' | 'BOOKING_COM' | 'TRAVELOKA' | 'DIRECT'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
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
  ota_source: OTASource
  status: BookingStatus
  total_price: string
  collected_amount: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}
