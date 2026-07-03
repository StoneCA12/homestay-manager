from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog


def log_activity(
    db: Session,
    event_type: str,
    description: str,
    *,
    booking_id: int | None = None,
    room_number: str | None = None,
    actor_name: str | None = None,
    guest_name: str | None = None,
    user_id: int | None = None,
) -> None:
    db.add(ActivityLog(
        event_type=event_type,
        description=description,
        booking_id=booking_id,
        room_number=room_number,
        actor_name=actor_name,
        guest_name=guest_name,
        user_id=user_id,
    ))
