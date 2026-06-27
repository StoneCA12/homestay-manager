from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.enums import ExpenseCategory


class ExpenseOut(BaseModel):
    id: int
    category: ExpenseCategory
    amount: Decimal
    expense_date: date
    description: str | None
    room_id: int | None
    recorded_by_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExpenseCreate(BaseModel):
    category: ExpenseCategory
    amount: Decimal = Field(gt=0, description="Expense amount in VND")
    expense_date: date
    description: str | None = None
    room_id: int | None = None


class ExpenseUpdate(BaseModel):
    category: ExpenseCategory | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    expense_date: date | None = None
    description: str | None = None
