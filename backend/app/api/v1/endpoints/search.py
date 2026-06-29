from datetime import date as date_type

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session, contains_eager

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.bike import Bike
from app.models.booking import Booking
from app.models.guest import Guest
from app.models.room import Room
from app.models.user import User

router = APIRouter()


class GuestResult(BaseModel):
    id: int
    full_name: str
    phone: str | None
    times_stayed: int


class BookingResult(BaseModel):
    id: int
    booking_ref: str | None
    guest_name: str
    guest_phone: str | None
    room_number: str | None
    check_in_date: date_type
    check_out_date: date_type
    status: str


class RoomResult(BaseModel):
    id: int
    room_number: str
    room_type: str
    housekeeping_status: str


class BikeResult(BaseModel):
    id: int
    name: str
    plate_number: str | None
    status: str


class SearchResponse(BaseModel):
    guests: list[GuestResult]
    bookings: list[BookingResult]
    rooms: list[RoomResult]
    bikes: list[BikeResult]
    total: int


@router.get("/", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=2, max_length=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    term = q.strip()
    pattern = f"%{term}%"

    # ── Guests ──────────────────────────────────────────────────────
    guests = (
        db.query(Guest)
        .filter(or_(Guest.full_name.ilike(pattern), Guest.phone.ilike(pattern)))
        .order_by(Guest.times_stayed.desc(), Guest.full_name)
        .limit(5)
        .all()
    )

    # ── Bookings ─────────────────────────────────────────────────────
    # Guest name/phone come from the Guest table via FK — must JOIN for filtering.
    # uses contains_eager so guest + room are fully loaded without extra queries.
    booking_conditions = [
        Guest.full_name.ilike(pattern),
        Guest.phone.ilike(pattern),
        Booking.booking_ref.ilike(pattern),
    ]
    if term.isdigit():
        booking_conditions.append(Booking.id == int(term))

    bookings = (
        db.query(Booking)
        .join(Booking.guest)
        .outerjoin(Booking.room)
        .options(contains_eager(Booking.guest), contains_eager(Booking.room))
        .filter(or_(*booking_conditions), Booking.is_archived == False)  # noqa: E712
        .order_by(Booking.id.desc())
        .limit(5)
        .all()
    )

    # ── Rooms ────────────────────────────────────────────────────────
    rooms = (
        db.query(Room)
        .filter(Room.room_number.ilike(pattern))
        .order_by(Room.room_number)
        .limit(5)
        .all()
    )

    # ── Bikes ────────────────────────────────────────────────────────
    bikes = (
        db.query(Bike)
        .filter(or_(Bike.name.ilike(pattern), Bike.plate_number.ilike(pattern)))
        .order_by(Bike.name)
        .limit(5)
        .all()
    )

    total = len(guests) + len(bookings) + len(rooms) + len(bikes)

    return SearchResponse(
        guests=[
            GuestResult(id=g.id, full_name=g.full_name, phone=g.phone, times_stayed=g.times_stayed)
            for g in guests
        ],
        bookings=[
            BookingResult(
                id=b.id,
                booking_ref=b.booking_ref,
                guest_name=b.guest.full_name,
                guest_phone=b.guest.phone,
                room_number=b.room.room_number if b.room else None,
                check_in_date=b.check_in_date,
                check_out_date=b.check_out_date,
                status=b.status.value,
            )
            for b in bookings
        ],
        rooms=[
            RoomResult(
                id=r.id,
                room_number=r.room_number,
                room_type=r.room_type.value,
                housekeeping_status=r.housekeeping_status.value,
            )
            for r in rooms
        ],
        bikes=[
            BikeResult(id=b.id, name=b.name, plate_number=b.plate_number, status=b.status.value)
            for b in bikes
        ],
        total=total,
    )
