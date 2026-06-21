from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.booking import Booking
from app.models.enums import BookingStatus, RoomStatus
from app.models.guest import Guest
from app.models.room import Room
from app.models.user import User
from app.schemas.room import DashboardStats, DisplayStatus, RoomOut

router = APIRouter()


def _compute_display_status(
    room: Room,
    active_bookings: list[Booking],
    today: date,
) -> tuple[DisplayStatus, str | None, date | None]:
    """Return (display_status, guest_name, check_out_date)."""
    if room.housekeeping_status == RoomStatus.DIRTY:
        return DisplayStatus.DIRTY, None, None
    if room.housekeeping_status == RoomStatus.CLEANING:
        return DisplayStatus.CLEANING, None, None
    if room.housekeeping_status == RoomStatus.OUT_OF_ORDER:
        return DisplayStatus.OUT_OF_ORDER, None, None

    if not active_bookings:
        return DisplayStatus.AVAILABLE, None, None

    if len(active_bookings) > 1:
        return DisplayStatus.OVERBOOKING, None, None

    booking = active_bookings[0]
    guest_name = booking.guest.full_name if booking.guest else None
    check_out = booking.check_out_date

    if booking.check_in_date == today:
        return DisplayStatus.ARRIVAL_TODAY, guest_name, check_out
    if booking.check_out_date == today:
        return DisplayStatus.CHECKOUT_TODAY, guest_name, check_out

    return DisplayStatus.OCCUPIED, guest_name, check_out


@router.get("/", response_model=list[RoomOut])
def list_rooms(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.today()
    rooms = db.query(Room).order_by(Room.room_number).all()

    result: list[RoomOut] = []
    for room in rooms:
        active = (
            db.query(Booking)
            .filter(
                Booking.room_id == room.id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
                Booking.check_in_date <= today,
                Booking.check_out_date >= today,
            )
            .all()
        )
        # eagerly load guests to avoid extra queries in _compute
        for b in active:
            _ = b.guest

        display_status, guest_name, check_out = _compute_display_status(room, active, today)
        result.append(
            RoomOut(
                id=room.id,
                room_number=room.room_number,
                room_type=room.room_type,
                floor=room.floor,
                capacity=room.capacity,
                base_price=room.base_price,
                housekeeping_status=room.housekeeping_status,
                display_status=display_status,
                guest_name=guest_name,
                check_out_date=check_out,
            )
        )

    return result


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.today()
    rooms = db.query(Room).all()
    total = len(rooms)

    occupied = arrivals = checkouts = dirty = available = 0
    for room in rooms:
        if room.housekeeping_status == RoomStatus.DIRTY:
            dirty += 1
            continue

        active = (
            db.query(Booking)
            .filter(
                Booking.room_id == room.id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
                Booking.check_in_date <= today,
                Booking.check_out_date >= today,
            )
            .all()
        )
        if not active:
            available += 1
        elif any(b.check_in_date == today for b in active):
            arrivals += 1
        elif any(b.check_out_date == today for b in active):
            checkouts += 1
        else:
            occupied += 1

    return DashboardStats(
        total_rooms=total,
        occupied=occupied,
        available=available,
        arrivals_today=arrivals,
        checkouts_today=checkouts,
        dirty=dirty,
    )
