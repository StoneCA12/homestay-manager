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
    recorded_by_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ExpenseCreate(BaseModel):
    category: ExpenseCategory
    amount: Decimal = Field(gt=0, description="Expense amount in VND")
    expense_date: date
    description: str | None = None
