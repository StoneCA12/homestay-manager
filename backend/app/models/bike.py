from datetime import datetime
from decimal import Decimal

from sqlalchemy import Enum as SAEnum, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import BikeStatus


class Bike(Base):
    __tablename__ = "bikes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))          # "Wave Alpha", "Xe số 1"
    plate_number: Mapped[str | None] = mapped_column(String(20))
    daily_rate: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    status: Mapped[BikeStatus] = mapped_column(
        SAEnum(BikeStatus), default=BikeStatus.AVAILABLE, index=True
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    rentals: Mapped[list["BikeRental"]] = relationship(back_populates="bike")  # noqa: F821
