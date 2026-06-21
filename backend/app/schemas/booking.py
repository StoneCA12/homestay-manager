from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import BookingStatus, OTASource


class BookingOut(BaseModel):
    id: int
    booking_ref: str | None
    room_number: str
    guest_name: str
    check_in_date: date
    check_out_date: date
    ota_source: OTASource
    status: BookingStatus
    total_price: Decimal
    collected_amount: Decimal

    model_config = {"from_attributes": True}


class BookingCreate(BaseModel):
    room_id: int
    guest_id: int
    check_in_date: date
    check_out_date: date
    num_guests: int = 1
    ota_source: OTASource = OTASource.DIRECT
    total_price: Decimal
    booking_ref: str | None = None
    notes: str | None = None
