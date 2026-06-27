from datetime import datetime
from decimal import Decimal

from sqlalchemy import Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CommissionRate(Base):
    __tablename__ = "commission_rates"

    ota_source: Mapped[str] = mapped_column(String(20), primary_key=True)
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 4), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
