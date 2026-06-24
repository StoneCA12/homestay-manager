from datetime import datetime

from sqlalchemy import Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Guest(Base):
    __tablename__ = "guests"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(150), index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20), index=True)
    nationality: Mapped[str | None] = mapped_column(String(60))
    id_type: Mapped[str | None] = mapped_column(String(20))   # CCCD | CMND | PASSPORT
    id_number: Mapped[str | None] = mapped_column(String(50))
    times_stayed: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    bookings: Mapped[list["Booking"]] = relationship(back_populates="guest")  # noqa: F821
