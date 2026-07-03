from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import BookingStatus, OTASource

BookingAction = Literal["confirm", "check_in", "check_out", "cancel", "no_show"]
PaymentState = Literal["unpaid", "deposit_paid", "partially_paid", "paid", "refunded"]


def compute_payment_state(total: Decimal, collected: Decimal, payment_count: int) -> PaymentState:
    """Derive payment state purely from totals — never manually settable."""
    if payment_count > 0 and collected <= 0:
        return "refunded"
    if collected <= 0:
        return "unpaid"
    if collected >= total:
        return "paid"
    if payment_count == 1:
        return "deposit_paid"
    return "partially_paid"


class BookingOut(BaseModel):
    id: int
    booking_ref: str | None
    room_id: int | None
    room_number: str | None
    guest_id: int
    guest_name: str
    guest_phone: str | None
    guest_id_type: str | None
    guest_id_number: str | None
    check_in_date: date
    check_out_date: date
    num_guests: int
    ota_source: OTASource
    status: BookingStatus
    total_price: Decimal
    collected_amount: Decimal
    payment_state: PaymentState = "unpaid"
    notes: str | None
    is_archived: bool
    archived_at: datetime | None

    model_config = {"from_attributes": True}


class CalendarBooking(BaseModel):
    id: int
    room_id: int | None
    room_number: str | None
    guest_name: str
    check_in_date: date
    check_out_date: date
    status: BookingStatus
    ota_source: OTASource
    total_price: Decimal
    collected_amount: Decimal


class BookingCreate(BaseModel):
    room_id: int | None = None
    guest_name: str = Field(min_length=1, max_length=150)
    guest_phone: str | None = None
    guest_id_type: str | None = None     # CCCD | CMND | PASSPORT
    guest_id_number: str | None = None
    check_in_date: date
    check_out_date: date
    num_guests: int = Field(default=1, ge=1)
    ota_source: OTASource = OTASource.DIRECT
    total_price: Decimal = Field(ge=0)
    deposit_amount: Decimal = Field(default=Decimal("0"), ge=0)
    deposit_payment_method: str = "CASH"
    booking_ref: str | None = None
    notes: str | None = None


class BookingUpdate(BaseModel):
    """All fields optional — only provided fields are applied."""
    room_id: int | None = None
    guest_name: str | None = Field(default=None, min_length=1, max_length=150)
    guest_phone: str | None = None
    guest_id_type: str | None = None
    guest_id_number: str | None = None
    check_in_date: date | None = None
    check_out_date: date | None = None
    num_guests: int | None = Field(default=None, ge=1)
    ota_source: OTASource | None = None
    total_price: Decimal | None = Field(default=None, ge=0)
    booking_ref: str | None = None
    notes: str | None = None


class BookingStatusUpdate(BaseModel):
    action: BookingAction
    room_id: int | None = None   # Required for check_in when booking has no room assigned
    reason: str | None = None    # Optional reason for cancel/no_show; required for early check_in
    check_in_date: date | None = None    # Required when checking in before the booked check_in_date
    check_out_date: date | None = None   # Required alongside check_in_date in that case


class PaymentUpdate(BaseModel):
    amount: Decimal = Field(ge=0, description="New total collected amount (replaces previous value)")
    notes: str | None = None


class LateCheckoutSurcharge(BaseModel):
    amount: Decimal = Field(gt=0, description="Surcharge amount to add to total_price")
    notes: str | None = None


class RoomChargeCreate(BaseModel):
    amount: Decimal = Field(gt=0, description="Charge amount to add to total_price")
    description: str = Field(min_length=1, max_length=300, description="What the charge is for, e.g. laundry, drinks")


class StayExtension(BaseModel):
    extra_days: int = Field(gt=0, description="Number of extra nights to add to check_out_date")
    price: Decimal = Field(gt=0, description="Price charged for the extension, added to total_price")


class WalkInCreate(BaseModel):
    room_id: int
    guest_name: str = Field(min_length=1, max_length=150)
    guest_phone: str | None = None
    guest_id_type: str | None = None
    guest_id_number: str | None = None
    check_in_date: date
    check_out_date: date
    num_guests: int = Field(default=1, ge=1)
    total_price: Decimal = Field(ge=0)
    deposit_amount: Decimal = Field(default=Decimal("0"), ge=0)
    payment_method: str = "CASH"
    notes: str | None = None


class BookingLogOut(BaseModel):
    id: int
    booking_id: int
    action: str
    description: str
    created_by_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
