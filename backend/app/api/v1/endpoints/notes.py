from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.booking import Booking
from app.models.enums import NoteCategory, NoteEntityType, UserRole
from app.models.guest import Guest
from app.models.internal_note import InternalNote
from app.models.room import Room
from app.models.user import User
from app.schemas.note import NoteCreate, NoteOut

router = APIRouter()


def _to_note_out(n: InternalNote) -> NoteOut:
    return NoteOut(
        id=n.id,
        entity_type=n.entity_type,
        entity_id=n.entity_id,
        category=n.category,
        content=n.content,
        author_name=n.author.full_name if n.author else None,
        created_at=n.created_at,
    )


def _note_query(db: Session, entity_type: NoteEntityType, entity_id: int, current_user: User):
    q = db.query(InternalNote).filter(
        InternalNote.entity_type == entity_type,
        InternalNote.entity_id == entity_id,
    )
    if current_user.role != UserRole.OWNER:
        q = q.filter(InternalNote.category != NoteCategory.OWNER)
    return q


@router.get("/", response_model=list[NoteOut])
def list_notes(
    entity_type: NoteEntityType,
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = (
        _note_query(db, entity_type, entity_id, current_user)
        .order_by(InternalNote.created_at.desc())
        .all()
    )
    return [_to_note_out(n) for n in notes]


@router.post("/", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def create_note(
    body: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.category == NoteCategory.OWNER and current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Chỉ chủ nhà mới có thể thêm ghi chú chủ nhà")

    # Validate entity exists
    if body.entity_type == NoteEntityType.BOOKING:
        if not db.get(Booking, body.entity_id):
            raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")
    elif body.entity_type == NoteEntityType.ROOM:
        if not db.get(Room, body.entity_id):
            raise HTTPException(status_code=404, detail="Phòng không tồn tại")
    elif body.entity_type == NoteEntityType.GUEST:
        if not db.get(Guest, body.entity_id):
            raise HTTPException(status_code=404, detail="Khách không tồn tại")

    note = InternalNote(
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        category=body.category,
        content=body.content,
        author_id=current_user.id,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _to_note_out(note)


@router.get("/rooms/latest", response_model=list[NoteOut])
def latest_room_notes(
    categories: str = "HOUSEKEEPING,MAINTENANCE",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the single most recent note per room for the given categories.
    Used by the housekeeping board to show inline note previews."""
    requested_cats: list[NoteCategory] = []
    for cat_str in categories.split(","):
        try:
            requested_cats.append(NoteCategory(cat_str.strip()))
        except ValueError:
            pass
    if not requested_cats:
        return []

    # Remove OWNER category for non-owners (security)
    if current_user.role != UserRole.OWNER and NoteCategory.OWNER in requested_cats:
        requested_cats.remove(NoteCategory.OWNER)

    # Subquery: latest created_at per room_id
    latest_sub = (
        db.query(
            InternalNote.entity_id.label("room_id"),
            func.max(InternalNote.created_at).label("max_ts"),
        )
        .filter(
            InternalNote.entity_type == NoteEntityType.ROOM,
            InternalNote.category.in_(requested_cats),
        )
        .group_by(InternalNote.entity_id)
        .subquery()
    )

    notes = (
        db.query(InternalNote)
        .join(
            latest_sub,
            (InternalNote.entity_id == latest_sub.c.room_id)
            & (InternalNote.created_at == latest_sub.c.max_ts),
        )
        .filter(InternalNote.entity_type == NoteEntityType.ROOM)
        .all()
    )
    return [_to_note_out(n) for n in notes]
