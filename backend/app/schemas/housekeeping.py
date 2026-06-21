from pydantic import BaseModel

from app.models.enums import RoomStatus


class StatusUpdate(BaseModel):
    to_status: RoomStatus
    notes: str | None = None
