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
    by_source: list[SourceBreakdown]
    by_payment_method: PaymentMethodBreakdown


# --- Daily Operations Report ---

class BookingSummaryRow(BaseModel):
    id: int
    room_number: str
    guest_name: str
    check_in_date: date
    check_out_date: date
    total_price: Decimal
    collected_amount: Decimal
    status: BookingStatus
    ota_source: OTASource


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
