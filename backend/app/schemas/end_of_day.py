from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import BookingStatus, OTASource, PaymentMethod


class EodBookingRow(BaseModel):
    id: int
    room_number: str | None
    guest_name: str
    check_in_date: date
    check_out_date: date
    total_price: Decimal
    collected_amount: Decimal
    status: BookingStatus
    ota_source: OTASource

    model_config = {"from_attributes": True}


class EodPaymentRow(BaseModel):
    id: int
    booking_id: int
    guest_name: str
    room_number: str | None
    amount: Decimal
    method: PaymentMethod
    paid_at: datetime
    recorded_by: str | None

    model_config = {"from_attributes": True}


class EodRevenueByMethod(BaseModel):
    cash: Decimal
    bank_transfer: Decimal
    ota_collected: Decimal
    total: Decimal


class EodRoomCleaned(BaseModel):
    room_number: str
    cleaned_by: str | None
    cleaned_at: datetime


class EodBikeActivity(BaseModel):
    bike_name: str
    plate_number: str | None
    room_number: str | None
    guest_name: str


class EodOutstanding(BaseModel):
    booking_id: int
    room_number: str | None
    guest_name: str
    outstanding: Decimal
    check_out_date: date


class EndOfDayReport(BaseModel):
    report_date: date
    generated_at: datetime
    is_snapshot: bool

    # Arrivals
    arrivals_on_time: list[EodBookingRow]
    arrivals_late: list[EodBookingRow]
    arrivals_no_show: list[EodBookingRow]

    # Departures
    departures_on_time: list[EodBookingRow]
    departures_late: list[EodBookingRow]

    # Revenue collected today
    revenue: EodRevenueByMethod
    payments: list[EodPaymentRow]

    # Housekeeping
    rooms_cleaned: list[EodRoomCleaned]

    # Bikes
    bikes_assigned: list[EodBikeActivity]
    bikes_returned: list[EodBikeActivity]

    # Occupancy
    total_rooms: int
    occupied_tonight: int

    # Outstanding balances (checked-in guests)
    outstanding_balances: list[EodOutstanding]

    # Booking activity counts
    bookings_created_count: int
    bookings_cancelled_count: int
    bookings_modified_count: int
