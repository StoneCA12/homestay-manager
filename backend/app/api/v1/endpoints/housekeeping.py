from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.activity import log_activity
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

    from_status = room.housekeeping_status
    _write_housekeeping_log(db, room, body, current_user)
    room.housekeeping_status = body.to_status

    _STATUS_LABELS = {
        "AVAILABLE": "Sẵn sàng", "DIRTY": "Chưa dọn",
        "CLEANING": "Đang dọn", "OUT_OF_ORDER": "Tạm ngừng",
    }
    hk_desc = (
        f"P.{room.room_number}: "
        f"{_STATUS_LABELS.get(str(from_status.value), str(from_status))} → "
        f"{_STATUS_LABELS.get(body.to_status, body.to_status)}"
    )
    log_activity(db, "ROOM_STATUS", hk_desc,
                 room_number=room.room_number,
                 actor_name=current_user.full_name, user_id=current_user.id)

    db.commit()

    return {"room_id": room_id, "new_status": body.to_status}
