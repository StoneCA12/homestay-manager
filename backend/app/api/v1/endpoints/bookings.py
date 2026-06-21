from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.booking import Booking
from app.models.enums import BookingStatus
from app.models.room import Room
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingOut

router = APIRouter()


def _to_out(b: Booking) -> BookingOut:
    return BookingOut(
        id=b.id,
        booking_ref=b.booking_ref,
        room_number=b.room.room_number,
        guest_name=b.guest.full_name,
        check_in_date=b.check_in_date,
        check_out_date=b.check_out_date,
        ota_source=b.ota_source,
        status=b.status,
        total_price=b.total_price,
        collected_amount=b.collected_amount,
    )


@router.get("/", response_model=list[BookingOut])
def list_bookings(
    status: BookingStatus | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Booking)
    if status:
        q = q.filter(Booking.status == status)
    bookings = q.order_by(Booking.check_in_date.desc()).limit(100).all()
    return [_to_out(b) for b in bookings]


@router.get("/today", response_model=list[BookingOut])
def today_bookings(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.today()
    bookings = (
        db.query(Booking)
        .filter(
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
            Booking.check_in_date <= today,
            Booking.check_out_date >= today,
        )
        .order_by(Booking.check_in_date)
        .all()
    )
    return [_to_out(b) for b in bookings]


@router.post("/", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    body: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.check_out_date <= body.check_in_date:
        raise HTTPException(status_code=400, detail="check_out_date must be after check_in_date")

    room = db.query(Room).filter(Room.id == body.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    booking = Booking(
        **body.model_dump(),
        status=BookingStatus.CONFIRMED,
        created_by_id=current_user.id,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return _to_out(booking)
