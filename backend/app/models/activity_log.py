from datetime import datetime

from sqlalchemy import ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    # BOOKING_CREATED | CHECKED_IN | CHECKED_OUT | CANCELLED | NO_SHOW | PAYMENT | ROOM_STATUS | BIKE_ASSIGNED | BIKE_RETURNED
    event_type: Mapped[str]
    description: Mapped[str] = mapped_column(Text)
    booking_id: Mapped[int | None] = mapped_column(nullable=True, index=True)
    room_number: Mapped[str | None] = mapped_column(nullable=True)   # denormalized
    actor_name: Mapped[str | None] = mapped_column(nullable=True)    # denormalized
    guest_name: Mapped[str | None] = mapped_column(nullable=True)    # denormalized
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), index=True)

    user: Mapped["User | None"] = relationship()  # noqa: F821
