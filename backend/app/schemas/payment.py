from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import PaymentMethod


class PaymentOut(BaseModel):
    id: int
    booking_id: int
    amount: Decimal
    method: PaymentMethod
    paid_at: datetime
    recorded_by_name: str | None
    notes: str | None

    model_config = {"from_attributes": True}


class PaymentCreate(BaseModel):
    amount: Decimal = Field(description="Payment amount in VND")
    method: PaymentMethod
    notes: str | None = None
