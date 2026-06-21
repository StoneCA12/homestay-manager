from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, Enum as SAEnum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import BookingStatus, OTASource


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("check_out_date > check_in_date", name="ck_bookings_dates"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_ref: Mapped[str | None] = mapped_column(String(100), index=True)  # OTA confirmation number
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), index=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guests.id"), index=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    check_in_date: Mapped[date] = mapped_column(Date, index=True)
    check_out_date: Mapped[date] = mapped_column(Date, index=True)
    num_guests: Mapped[int] = mapped_column(default=1)

    ota_source: Mapped[OTASource] = mapped_column(SAEnum(OTASource), default=OTASource.DIRECT)
    status: Mapped[BookingStatus] = mapped_column(
        SAEnum(BookingStatus), default=BookingStatus.CONFIRMED, index=True
    )

    total_price: Mapped[Decimal] = mapped_column(Numeric(15, 2))
    collected_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0"))

    notes: Mapped[str | None] = mapped_column(Text)
    raw_email_id: Mapped[str | None] = mapped_column(String(255))  # message-id of source email

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    room: Mapped["Room"] = relationship(back_populates="bookings")  # noqa: F821
    guest: Mapped["Guest"] = relationship(back_populates="bookings")  # noqa: F821
    created_by_user: Mapped["User | None"] = relationship(back_populates="bookings_created", passive_deletes=True)  # noqa: F821
