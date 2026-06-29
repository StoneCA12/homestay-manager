import math
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from fastapi import HTTPException
from app.core.deps import get_current_user, require_admin_or_above
from sqlalchemy.orm import joinedload

from app.models.bike_rental import BikeRental as BikeRentalModel
from app.models.booking import Booking
from app.models.enums import BikeRentalStatus, BookingStatus, RoomStatus, RoomType
from app.models.guest import Guest
from app.models.room import Room
from app.models.user import User
from app.schemas.room import DashboardStats, DisplayStatus, RoomCreate, RoomOut, RoomUpdate

router = APIRouter()

# Statuses that hold a room (mirrors bookings.py _ACTIVE)
_ACTIVE = [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]

_HK_TO_DISPLAY: dict[RoomStatus, DisplayStatus] = {
    RoomStatus.DIRTY: DisplayStatus.DIRTY,
    RoomStatus.CLEANING: DisplayStatus.CLEANING,
    RoomStatus.OUT_OF_ORDER: DisplayStatus.OUT_OF_ORDER,
}


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

    # Query 2: all active bookings for today's date range, with guests eagerly loaded
    active_bookings = (
        db.query(Booking)
        .options(joinedload(Booking.guest))
        .filter(
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
            Booking.check_in_date <= today,
            Booking.check_out_date >= today,
        )
        .all()
    )
    bookings_by_room: dict[int | None, list[Booking]] = {}
    for b in active_bookings:
        bookings_by_room.setdefault(b.room_id, []).append(b)

    # Query 3: all active bike rentals for those bookings, with bikes eagerly loaded
    active_booking_ids = [b.id for b in active_bookings]
    bike_rentals_all = (
        db.query(BikeRentalModel)
        .options(joinedload(BikeRentalModel.bike))
        .filter(
            BikeRentalModel.booking_id.in_(active_booking_ids),
            BikeRentalModel.status == BikeRentalStatus.ACTIVE,
        )
        .all()
    ) if active_booking_ids else []
    bikes_by_booking: dict[int, list[str]] = {}
    for br in bike_rentals_all:
        bikes_by_booking.setdefault(br.booking_id, []).append(br.bike.name)

    result: list[RoomOut] = []
    for room in rooms:
        active = bookings_by_room.get(room.id, [])
        display_status, guest_name, check_out = _compute_display_status(room, active, today)
        active_bike_names: list[str] = []
        outstanding_balance = None
        active_booking_id = None
        if len(active) == 1:
            b = active[0]
            active_booking_id = b.id
            active_bike_names = bikes_by_booking.get(b.id, [])
            bal = b.total_price - b.collected_amount
            if bal > 0:
                outstanding_balance = bal
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
                active_bike_names=active_bike_names,
                outstanding_balance=outstanding_balance,
                active_booking_id=active_booking_id,
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

    # Check next 14 days for >= 75% occupancy (counting all active bookings, assigned or not)
    threshold = math.ceil(total * 0.75)
    warning_dates: list[date] = []
    for i in range(0, 15):
        check_date = today + timedelta(days=i)
        count = (
            db.query(func.count(Booking.id))
            .filter(
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
                Booking.check_in_date <= check_date,
                Booking.check_out_date > check_date,
            )
            .scalar()
        ) or 0
        if count >= threshold:
            warning_dates.append(check_date)

    return DashboardStats(
        total_rooms=total,
        occupied=occupied,
        available=available,
        arrivals_today=arrivals,
        checkouts_today=checkouts,
        dirty=dirty,
        occupancy_warning_dates=warning_dates,
    )


@router.get("/available", response_model=list[RoomOut])
def available_rooms(
    check_in_date: date,
    check_out_date: date,
    room_type: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return rooms that have no active booking overlapping the given date range."""
    if check_out_date <= check_in_date:
        raise HTTPException(status_code=400, detail="Ngày trả phòng phải sau ngày nhận phòng")

    conflicting_ids = (
        select(Booking.room_id)
        .where(
            Booking.status.in_(_ACTIVE),
            Booking.check_in_date < check_out_date,
            Booking.check_out_date > check_in_date,
            Booking.room_id.isnot(None),
        )
    )

    q = db.query(Room).filter(~Room.id.in_(conflicting_ids))
    if room_type:
        try:
            q = q.filter(Room.room_type == RoomType(room_type))
        except ValueError:
            pass

    rooms = q.order_by(Room.room_number).all()
    return [
        RoomOut(
            id=r.id,
            room_number=r.room_number,
            room_type=r.room_type,
            floor=r.floor,
            capacity=r.capacity,
            base_price=r.base_price,
            housekeeping_status=r.housekeeping_status,
            display_status=_HK_TO_DISPLAY.get(r.housekeeping_status, DisplayStatus.AVAILABLE),
        )
        for r in rooms
    ]


@router.post("/", response_model=RoomOut, status_code=201)
def create_room(
    body: RoomCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_above),
):
    existing = db.query(Room).filter(Room.room_number == body.room_number).first()
    if existing:
        raise HTTPException(status_code=409, detail="Số phòng đã tồn tại.")
    room = Room(
        room_number=body.room_number,
        room_type=body.room_type,
        floor=body.floor,
        capacity=body.capacity,
        base_price=body.base_price,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return RoomOut(
        id=room.id,
        room_number=room.room_number,
        room_type=room.room_type,
        floor=room.floor,
        capacity=room.capacity,
        base_price=room.base_price,
        housekeeping_status=room.housekeeping_status,
        display_status=DisplayStatus.AVAILABLE,
    )


@router.patch("/{room_id}", response_model=RoomOut)
def update_room(
    room_id: int,
    body: RoomUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_above),
):
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Phòng không tồn tại.")
    if body.room_number and body.room_number != room.room_number:
        if db.query(Room).filter(Room.room_number == body.room_number).first():
            raise HTTPException(status_code=409, detail="Số phòng đã tồn tại.")
        room.room_number = body.room_number
    if body.room_type is not None:
        room.room_type = body.room_type
    if body.floor is not None:
        room.floor = body.floor
    if body.capacity is not None:
        room.capacity = body.capacity
    if body.base_price is not None:
        room.base_price = body.base_price
    if body.housekeeping_status is not None:
        room.housekeeping_status = body.housekeeping_status
    db.commit()
    db.refresh(room)
    return RoomOut(
        id=room.id,
        room_number=room.room_number,
        room_type=room.room_type,
        floor=room.floor,
        capacity=room.capacity,
        base_price=room.base_price,
        housekeeping_status=room.housekeeping_status,
        display_status=DisplayStatus.AVAILABLE,
    )
