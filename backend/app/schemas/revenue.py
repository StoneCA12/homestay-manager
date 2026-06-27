from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import BookingStatus, OTASource


class DailyRevenue(BaseModel):
    date: date
    active_bookings: int
    total_booked: Decimal
    total_collected: Decimal
    outstanding: Decimal


class SourceBreakdown(BaseModel):
    source: str
    bookings: int
    revenue: Decimal
    collected: Decimal
    commission_rate: Decimal
    net_revenue: Decimal


class RoomTypeBreakdown(BaseModel):
    room_type: str          # FAMILY | WINDOW | BALCONY | REGULAR | UNASSIGNED
    bookings: int
    revenue: Decimal
    net_revenue: Decimal
    nights: int             # total booked room-nights for this type


class PaymentMethodBreakdown(BaseModel):
    cash: Decimal
    bank_transfer: Decimal
    ota_collected: Decimal
    total: Decimal


class MonthlyRevenue(BaseModel):
    start_date: date
    end_date: date
    total_bookings: int
    total_revenue: Decimal
    total_collected: Decimal
    total_net_revenue: Decimal
    outstanding: Decimal
    occupancy_rate: Decimal         # 0.0–1.0, booked nights / (total_rooms × period_days)
    by_source: list[SourceBreakdown]
    by_room_type: list[RoomTypeBreakdown]
    by_payment_method: PaymentMethodBreakdown
    bike_revenue: Decimal = Decimal(0)
    bike_collected: Decimal = Decimal(0)
    bike_outstanding: Decimal = Decimal(0)


# --- Daily Operations Report ---

class BookingSummaryRow(BaseModel):
    id: int
    room_number: str | None
    guest_name: str
    check_in_date: date
    check_out_date: date
    total_price: Decimal
    collected_amount: Decimal
    status: BookingStatus
    ota_source: OTASource
    bike_names: list[str] = []
    bike_outstanding: Decimal = Decimal(0)


class BikeReturnRow(BaseModel):
    bike_rental_id: int
    booking_id: int
    bike_name: str
    plate_number: str | None
    room_number: str | None
    guest_name: str
    outstanding: Decimal


class HousekeepingSummary(BaseModel):
    dirty: int
    cleaning: int
    out_of_order: int
    available: int


class RevenueSummary(BaseModel):
    total_booked: Decimal
    total_collected: Decimal
    outstanding: Decimal


class DailyReport(BaseModel):
    date: date
    arrivals: list[BookingSummaryRow]
    departures: list[BookingSummaryRow]
    in_house: list[BookingSummaryRow]
    tomorrow_arrivals: list[BookingSummaryRow]
    revenue: RevenueSummary
    housekeeping: HousekeepingSummary
    bike_returns_today: list[BikeReturnRow] = []
    active_bike_count: int = 0
