from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import BikeRentalStatus, BikeStatus, PaymentMethod


# ─── Bike ─────────────────────────────────────────────────────────────────────

class BikeOut(BaseModel):
    id: int
    name: str
    plate_number: str | None
    daily_rate: Decimal
    status: BikeStatus
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BikeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    plate_number: str | None = None
    daily_rate: Decimal = Field(ge=0)
    notes: str | None = None


class BikeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    plate_number: str | None = None
    daily_rate: Decimal | None = Field(default=None, ge=0)
    status: BikeStatus | None = None
    notes: str | None = None


# ─── Bike Payment ─────────────────────────────────────────────────────────────

class BikePaymentOut(BaseModel):
    id: int
    bike_rental_id: int
    amount: Decimal
    method: PaymentMethod
    paid_at: datetime
    recorded_by_name: str | None
    notes: str | None

    model_config = {"from_attributes": True}


class BikePaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    method: PaymentMethod
    notes: str | None = None


# ─── Bike Rental ──────────────────────────────────────────────────────────────

class BikeRentalOut(BaseModel):
    id: int
    bike_id: int
    bike_name: str
    plate_number: str | None
    booking_id: int
    room_number: str | None
    guest_name: str
    start_date: date
    end_date: date
    num_days: int
    daily_rate: Decimal
    total_amount: Decimal
    collected_amount: Decimal
    status: BikeRentalStatus
    notes: str | None
    created_by_name: str | None
    created_at: datetime
    updated_at: datetime
    payments: list[BikePaymentOut] = []

    model_config = {"from_attributes": True}


class BikeRentalCreate(BaseModel):
    bike_id: int
    booking_id: int
    start_date: date
    end_date: date
    notes: str | None = None


class BikeRentalUpdate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = None


# ─── Report ───────────────────────────────────────────────────────────────────

class BikeRentalReportRow(BaseModel):
    booking_id: int
    room_number: str | None
    guest_name: str
    check_in_date: date
    check_out_date: date
    rentals: list[BikeRentalOut]
    total_expected: Decimal
    total_collected: Decimal
    outstanding: Decimal


class BikeRentalReport(BaseModel):
    start_date: date
    end_date: date
    rows: list[BikeRentalReportRow]
    grand_expected: Decimal
    grand_collected: Decimal
    grand_outstanding: Decimal
