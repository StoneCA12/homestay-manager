from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import RoomStatus
from app.models.housekeeping import HousekeepingLog
from app.models.room import Room
from app.models.user import User

router = APIRouter()


class StatusUpdate(BaseModel):
    to_status: RoomStatus
    notes: str | None = None


@router.patch("/{room_id}/status")
def update_room_status(
    room_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    log = HousekeepingLog(
        room_id=room.id,
        changed_by_id=current_user.id,
        from_status=room.housekeeping_status,
        to_status=body.to_status,
        notes=body.notes,
    )
    db.add(log)
    room.housekeeping_status = body.to_status
    db.commit()

    return {"room_id": room_id, "new_status": body.to_status}
