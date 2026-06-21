from datetime import datetime
from decimal import Decimal

from sqlalchemy import Enum as SAEnum, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import RoomStatus, RoomType


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_number: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    room_type: Mapped[RoomType] = mapped_column(SAEnum(RoomType))
    floor: Mapped[int]
    capacity: Mapped[int]
    base_price: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    housekeeping_status: Mapped[RoomStatus] = mapped_column(
        SAEnum(RoomStatus), default=RoomStatus.AVAILABLE
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    bookings: Mapped[list["Booking"]] = relationship(back_populates="room")  # noqa: F821
    housekeeping_logs: Mapped[list["HousekeepingLog"]] = relationship(back_populates="room")  # noqa: F821
