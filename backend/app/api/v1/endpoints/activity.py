from datetime import date as date_type, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.activity_log import ActivityLog
from app.models.user import User

router = APIRouter()


class ActivityItemOut(BaseModel):
    id: int
    event_type: str
    description: str
    booking_id: int | None
    room_number: str | None
    actor_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[ActivityItemOut])
def list_activity(
    date: date_type | None = Query(default=None, description="Filter by date (YYYY-MM-DD). Omit for most-recent items."),
    event_type: str | None = Query(default=None, description="Filter by event_type"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ActivityLog)

    if date is not None:
        q = q.filter(func.date(ActivityLog.created_at) == date)

    if event_type:
        # Allow comma-separated list: CANCELLED,NO_SHOW
        types = [t.strip() for t in event_type.split(",") if t.strip()]
        if len(types) == 1:
            q = q.filter(ActivityLog.event_type == types[0])
        elif len(types) > 1:
            q = q.filter(ActivityLog.event_type.in_(types))

    return (
        q.order_by(ActivityLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
