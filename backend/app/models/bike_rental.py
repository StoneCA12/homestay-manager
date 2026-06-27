from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, Enum as SAEnum, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import BikeRentalStatus


class BikeRental(Base):
    __tablename__ = "bike_rentals"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_bike_rentals_dates"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    bike_id: Mapped[int] = mapped_column(ForeignKey("bikes.id"), index=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), index=True)

    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date] = mapped_column(Date)
    num_days: Mapped[int]                                    # stored for auditability
    daily_rate: Mapped[Decimal] = mapped_column(Numeric(15, 2))  # snapshot at rental time
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    collected_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))

    status: Mapped[BikeRentalStatus] = mapped_column(
        SAEnum(BikeRentalStatus), default=BikeRentalStatus.ACTIVE, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text)

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    bike: Mapped["Bike"] = relationship(back_populates="rentals")  # noqa: F821
    booking: Mapped["Booking"] = relationship(back_populates="bike_rentals")  # noqa: F821
    created_by_user: Mapped["User | None"] = relationship()  # noqa: F821
    payments: Mapped[list["BikePayment"]] = relationship(  # noqa: F821
        back_populates="bike_rental", cascade="all, delete-orphan"
    )
