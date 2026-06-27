from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.models.enums import BookingStatus, OTASource

BookingAction = Literal["check_in", "check_out", "cancel", "no_show"]


class BookingOut(BaseModel):
    id: int
    booking_ref: str | None
    room_id: int | None
    room_number: str | None
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
    notes: str | None

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
    room_id: int | None = None  # Required for check_in when booking has no room assigned


class PaymentUpdate(BaseModel):
    amount: Decimal = Field(ge=0, description="New total collected amount (replaces previous value)")
    notes: str | None = None


class LateCheckoutSurcharge(BaseModel):
    amount: Decimal = Field(gt=0, description="Surcharge amount to add to total_price")
    notes: str | None = None
