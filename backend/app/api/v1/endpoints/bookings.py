from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.booking import Booking
from app.models.enums import BookingStatus, RoomStatus
from app.models.guest import Guest
from app.models.payment import Payment
from app.models.room import Room
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingOut,
    BookingStatusUpdate,
    CalendarBooking,
)
from app.schemas.payment import PaymentCreate, PaymentOut

router = APIRouter()

# Valid status transitions: current_status → { action → new_status }
_TRANSITIONS: dict[BookingStatus, dict[str, BookingStatus]] = {
    BookingStatus.CONFIRMED: {
        "check_in": BookingStatus.CHECKED_IN,
        "cancel":   BookingStatus.CANCELLED,
        "no_show":  BookingStatus.NO_SHOW,
    },
    BookingStatus.CHECKED_IN: {
        "check_out": BookingStatus.CHECKED_OUT,
        "cancel":    BookingStatus.CANCELLED,
    },
}

# Statuses that hold a room and block new bookings
_ACTIVE = [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]


def _to_booking_out(b: Booking) -> BookingOut:
    return BookingOut(
        id=b.id,
        booking_ref=b.booking_ref,
        room_number=b.room.room_number,
        guest_name=b.guest.full_name,
        guest_phone=b.guest.phone,
        check_in_date=b.check_in_date,
        check_out_date=b.check_out_date,
        num_guests=b.num_guests,
        ota_source=b.ota_source,
        status=b.status,
        total_price=b.total_price,
        collected_amount=b.collected_amount,
        notes=b.notes,
    )


def _find_or_create_guest(
    db: Session,
    name: str,
    phone: str | None,
    id_type: str | None = None,
    id_number: str | None = None,
) -> Guest:
    # Primary dedup: phone (if provided)
    if phone:
        guest = db.query(Guest).filter(Guest.phone == phone).first()
        if guest:
            guest.full_name = name
            if id_type:
                guest.id_type = id_type
            if id_number:
                guest.id_number = id_number
            return guest

    # Fallback: case-insensitive name match
    guest = db.query(Guest).filter(func.lower(Guest.full_name) == name.lower()).first()
    if not guest:
        guest = Guest(full_name=name, phone=phone, id_type=id_type, id_number=id_number)
        db.add(guest)
        db.flush()
    return guest


def _check_room_availability(
    db: Session,
    room_id: int,
    check_in: date,
    check_out: date,
    exclude_booking_id: int | None = None,
) -> None:
    q = (
        db.query(Booking)
        .filter(
            Booking.room_id == room_id,
            Booking.status.in_(_ACTIVE),
            Booking.check_in_date < check_out,
            Booking.check_out_date > check_in,
        )
    )
    if exclude_booking_id:
        q = q.filter(Booking.id != exclude_booking_id)
    conflict = q.first()
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Room already booked {conflict.check_in_date} – {conflict.check_out_date} "
                f"(booking #{conflict.id})"
            ),
        )


def _recalculate_collected(db: Session, booking: Booking) -> None:
    """Recompute booking.collected_amount as the sum of all its payment rows."""
    total = (
        db.query(func.sum(Payment.amount))
        .filter(Payment.booking_id == booking.id)
        .scalar()
    ) or Decimal(0)
    booking.collected_amount = total


@router.get("/", response_model=list[BookingOut])
def list_bookings(
    booking_status: BookingStatus | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Booking)
    if booking_status:
        q = q.filter(Booking.status == booking_status)
    if start_date:
        q = q.filter(Booking.check_out_date >= start_date)
    if end_date:
        q = q.filter(Booking.check_in_date <= end_date)
    return [_to_booking_out(b) for b in q.order_by(Booking.check_in_date.desc()).limit(200)]


@router.get("/today", response_model=list[BookingOut])
def today_bookings(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.today()
    bookings = (
        db.query(Booking)
        .filter(
            Booking.status.in_(_ACTIVE),
            Booking.check_in_date <= today,
            Booking.check_out_date >= today,
        )
        .order_by(Booking.check_in_date)
        .all()
    )
    return [_to_booking_out(b) for b in bookings]


@router.get("/calendar", response_model=list[CalendarBooking])
def calendar_bookings(
    start: date,
    end: date,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    bookings = (
        db.query(Booking)
        .filter(
            Booking.check_in_date < end,
            Booking.check_out_date > start,
        )
        .all()
    )
    return [
        CalendarBooking(
            id=b.id,
            room_id=b.room_id,
            room_number=b.room.room_number,
            guest_name=b.guest.full_name,
            check_in_date=b.check_in_date,
            check_out_date=b.check_out_date,
            status=b.status,
            ota_source=b.ota_source,
            total_price=b.total_price,
            collected_amount=b.collected_amount,
        )
        for b in bookings
    ]


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

    _check_room_availability(db, body.room_id, body.check_in_date, body.check_out_date)

    guest = _find_or_create_guest(
        db, body.guest_name, body.guest_phone,
        id_type=body.guest_id_type, id_number=body.guest_id_number,
    )

    booking = Booking(
        room_id=body.room_id,
        guest_id=guest.id,
        check_in_date=body.check_in_date,
        check_out_date=body.check_out_date,
        num_guests=body.num_guests,
        ota_source=body.ota_source,
        total_price=body.total_price,
        booking_ref=body.booking_ref,
        notes=body.notes,
        status=BookingStatus.CONFIRMED,
        created_by_id=current_user.id,
    )
    db.add(booking)
    db.flush()

    if body.deposit_amount > 0:
        from app.models.enums import PaymentMethod
        deposit = Payment(
            booking_id=booking.id,
            amount=body.deposit_amount,
            method=PaymentMethod.CASH,
            notes="Tiền đặt cọc",
            recorded_by_id=current_user.id,
        )
        db.add(deposit)
        db.flush()
        _recalculate_collected(db, booking)

    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)


@router.patch("/{booking_id}/status", response_model=BookingOut)
def update_booking_status(
    booking_id: int,
    body: BookingStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    allowed = _TRANSITIONS.get(booking.status, {})
    new_status = allowed.get(body.action)
    if not new_status:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot '{body.action}' a booking with status '{booking.status.value}'",
        )

    booking.status = new_status

    if new_status == BookingStatus.CHECKED_OUT:
        booking.room.housekeeping_status = RoomStatus.DIRTY
        booking.guest.times_stayed += 1

    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)


@router.get("/{booking_id}/payments", response_model=list[PaymentOut])
def list_payments(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    payments = (
        db.query(Payment)
        .filter(Payment.booking_id == booking_id)
        .order_by(Payment.paid_at.asc())
        .all()
    )
    return [
        PaymentOut(
            id=p.id,
            booking_id=p.booking_id,
            amount=p.amount,
            method=p.method,
            paid_at=p.paid_at,
            recorded_by_name=p.recorded_by.full_name if p.recorded_by else None,
            notes=p.notes,
        )
        for p in payments
    ]


@router.post("/{booking_id}/payments", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def add_payment(
    booking_id: int,
    body: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.status in [BookingStatus.CANCELLED, BookingStatus.NO_SHOW]:
        raise HTTPException(status_code=400, detail="Cannot record payment for cancelled/no-show booking")

    new_total = booking.collected_amount + body.amount
    if new_total > booking.total_price:
        raise HTTPException(
            status_code=400,
            detail=f"Payment would exceed booking total. Outstanding: {booking.total_price - booking.collected_amount}",
        )

    payment = Payment(
        booking_id=booking_id,
        amount=body.amount,
        method=body.method,
        notes=body.notes,
        recorded_by_id=current_user.id,
    )
    db.add(payment)
    db.flush()

    _recalculate_collected(db, booking)
    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)
