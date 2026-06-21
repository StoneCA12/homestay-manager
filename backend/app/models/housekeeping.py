from datetime import datetime

from sqlalchemy import Enum as SAEnum, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import RoomStatus


class HousekeepingLog(Base):
    __tablename__ = "housekeeping_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), index=True)
    changed_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    from_status: Mapped[RoomStatus] = mapped_column(SAEnum(RoomStatus))
    to_status: Mapped[RoomStatus] = mapped_column(SAEnum(RoomStatus))
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    room: Mapped["Room"] = relationship(back_populates="housekeeping_logs")  # noqa: F821
    changed_by_user: Mapped["User"] = relationship(back_populates="housekeeping_logs")  # noqa: F821
