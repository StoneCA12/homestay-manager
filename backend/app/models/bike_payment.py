from datetime import datetime
from decimal import Decimal

from sqlalchemy import Enum as SAEnum, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import PaymentMethod


class BikePayment(Base):
    __tablename__ = "bike_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    bike_rental_id: Mapped[int] = mapped_column(ForeignKey("bike_rentals.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    method: Mapped[PaymentMethod] = mapped_column(SAEnum(PaymentMethod))
    paid_at: Mapped[datetime] = mapped_column(server_default=func.now())
    recorded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    notes: Mapped[str | None] = mapped_column(Text)

    bike_rental: Mapped["BikeRental"] = relationship(back_populates="payments")  # noqa: F821
    recorded_by: Mapped["User | None"] = relationship()  # noqa: F821
