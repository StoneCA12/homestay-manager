from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.housekeeping import HousekeepingLog
from app.models.room import Room
from app.models.user import User
from app.schemas.housekeeping import StatusUpdate

router = APIRouter()


def _write_housekeeping_log(
    db: Session, room: Room, body: StatusUpdate, user: User
) -> None:
    """Append an audit log entry for a housekeeping status transition."""
    log = HousekeepingLog(
        room_id=room.id,
        changed_by_id=user.id,
        from_status=room.housekeeping_status,
        to_status=body.to_status,
        notes=body.notes,
    )
    db.add(log)


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

    _write_housekeeping_log(db, room, body, current_user)
    room.housekeeping_status = body.to_status
    db.commit()

    return {"room_id": room_id, "new_status": body.to_status}
