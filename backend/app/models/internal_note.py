from datetime import datetime

from sqlalchemy import Enum as SAEnum, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import NoteCategory, NoteEntityType


class InternalNote(Base):
    __tablename__ = "internal_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[NoteEntityType] = mapped_column(SAEnum(NoteEntityType), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    category: Mapped[NoteCategory] = mapped_column(SAEnum(NoteCategory), index=True)
    content: Mapped[str] = mapped_column(Text)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    author: Mapped["User | None"] = relationship()  # noqa: F821
