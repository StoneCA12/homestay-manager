from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, Enum as SAEnum, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ExpenseCategory


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[ExpenseCategory] = mapped_column(SAEnum(ExpenseCategory))
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    expense_date: Mapped[date] = mapped_column(Date, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    recorded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    recorded_by: Mapped["User | None"] = relationship()  # noqa: F821
