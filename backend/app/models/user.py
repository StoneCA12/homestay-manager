from datetime import datetime

from sqlalchemy import Boolean, Enum as SAEnum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.RECEPTIONIST)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    bookings_created: Mapped[list["Booking"]] = relationship(back_populates="created_by_user")  # noqa: F821
    housekeeping_logs: Mapped[list["HousekeepingLog"]] = relationship(back_populates="changed_by_user")  # noqa: F821
