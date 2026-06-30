from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin_or_above
from app.models.bike_rental import BikeRental as BikeRentalModel
from app.models.booking import Booking
from app.models.booking_log import BookingLog
from app.models.enums import BikeRentalStatus, BikeStatus, BookingStatus, OTASource, PaymentMethod, RoomStatus, UserRole
from app.models.guest import Guest
from app.models.payment import Payment
from app.models.room import Room
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingLogOut,
    BookingOut,
    BookingStatusUpdate,
    BookingUpdate,
    CalendarBooking,
    LateCheckoutSurcharge,
    WalkInCreate,
)
from app.schemas.booking import compute_payment_state
from app.schemas.payment import PaymentCreate, PaymentOut, PaymentVoid
from app.core.activity import log_activity

router = APIRouter()

# Valid status transitions: current_status → { action → new_status }
_TRANSITIONS: dict[BookingStatus, dict[str, BookingStatus]] = {
    BookingStatus.PENDING: {
        "confirm": BookingStatus.CONFIRMED,
        "cancel":  BookingStatus.CANCELLED,
    },
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
# Terminal statuses — no edits allowed
_TERMINAL = [BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED, BookingStatus.NO_SHOW]


def _to_booking_out(b: Booking) -> BookingOut:
    payment_count = len(b.payments)
    return BookingOut(
        id=b.id,
        booking_ref=b.booking_ref,
        room_id=b.room_id,
        room_number=b.room.room_number if b.room else None,
        guest_id=b.guest_id,
        guest_name=b.guest.full_name,
        guest_phone=b.guest.phone,
        guest_id_type=b.guest.id_type,
        guest_id_number=b.guest.id_number,
        check_in_date=b.check_in_date,
        check_out_date=b.check_out_date,
        num_guests=b.num_guests,
        ota_source=b.ota_source,
        status=b.status,
        total_price=b.total_price,
        collected_amount=b.collected_amount,
        payment_state=compute_payment_state(b.total_price, b.collected_amount, payment_count),
        notes=b.notes,
        is_archived=b.is_archived,
        archived_at=b.archived_at,
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


def _find_available_rooms(
    db: Session,
    check_in: date,
    check_out: date,
    exclude_room_id: int,
    limit: int = 3,
) -> list[dict]:
    from sqlalchemy import select
    conflicting_ids = (
        select(Booking.room_id)
        .where(
            Booking.status.in_(_ACTIVE),
            Booking.check_in_date < check_out,
            Booking.check_out_date > check_in,
            Booking.room_id.isnot(None),
        )
    )
    available = (
        db.query(Room)
        .filter(Room.id != exclude_room_id, ~Room.id.in_(conflicting_ids))
        .order_by(Room.room_number)
        .limit(limit)
        .all()
    )
    return [
        {
            "room_id": r.id,
            "room_number": r.room_number,
            "room_type": r.room_type.value,
            "base_price": str(r.base_price),
        }
        for r in available
    ]


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
    if not conflict:
        return

    room = db.get(Room, room_id)
    room_label = f"Phòng {room.room_number}" if room else f"phòng #{room_id}"
    suggestions = _find_available_rooms(db, check_in, check_out, room_id)
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "type": "ROOM_CONFLICT",
            "message": (
                f"{room_label} đã có đặt từ {conflict.check_in_date} "
                f"đến {conflict.check_out_date}"
            ),
            "conflict": {
                "booking_id": conflict.id,
                "guest_name": conflict.guest.full_name if conflict.guest else "—",
                "check_in_date": str(conflict.check_in_date),
                "check_out_date": str(conflict.check_out_date),
            },
            "suggestions": suggestions,
        },
    )


def _recalculate_collected(db: Session, booking: Booking) -> None:
    total = (
        db.query(func.sum(Payment.amount))
        .filter(Payment.booking_id == booking.id)
        .scalar()
    ) or Decimal(0)
    booking.collected_amount = total


def _log(db: Session, booking_id: int, user_id: int | None, action: str, description: str) -> None:
    db.add(BookingLog(booking_id=booking_id, user_id=user_id, action=action, description=description))


@router.get("/", response_model=list[BookingOut])
def list_bookings(
    booking_status: BookingStatus | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    search: str | None = None,
    archived: bool = False,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Clamp pagination params to safe bounds (hard cap protects the DB).
    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    q = db.query(Booking).join(Booking.guest)
    q = q.filter(Booking.is_archived == archived)
    if booking_status:
        q = q.filter(Booking.status == booking_status)
    if start_date:
        q = q.filter(Booking.check_out_date >= start_date)
    if end_date:
        q = q.filter(Booking.check_in_date <= end_date)
    if search:
        q = q.filter(Guest.full_name.ilike(f"%{search}%"))
    rows = (
        q.order_by(Booking.check_in_date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [_to_booking_out(b) for b in rows]


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
            room_number=b.room.room_number if b.room else None,
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
        raise HTTPException(status_code=400, detail="Ngày trả phòng phải sau ngày nhận phòng")

    if body.room_id is not None:
        room = db.query(Room).filter(Room.id == body.room_id).first()
        if not room:
            raise HTTPException(status_code=404, detail="Phòng không tồn tại")
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

    room_label = f"phòng {body.room_id}" if body.room_id else "chưa xếp phòng"
    created_desc = (
        f"Đặt phòng được tạo — {body.guest_name}, {room_label}, "
        f"{body.check_in_date} → {body.check_out_date}, "
        f"{int(body.total_price):,} VND"
    )
    _log(db, booking.id, current_user.id, "CREATED", created_desc)
    room_num = db.get(Room, body.room_id).room_number if body.room_id else None
    log_activity(db, "BOOKING_CREATED", created_desc,
                 booking_id=booking.id, room_number=room_num,
                 actor_name=current_user.full_name, user_id=current_user.id)

    if body.deposit_amount > 0:
        try:
            dep_method = PaymentMethod(body.deposit_payment_method)
        except ValueError:
            dep_method = PaymentMethod.CASH
        deposit = Payment(
            booking_id=booking.id,
            amount=body.deposit_amount,
            method=dep_method,
            notes="Tiền đặt cọc",
            recorded_by_id=current_user.id,
        )
        db.add(deposit)
        db.flush()
        _recalculate_collected(db, booking)
        dep_desc = f"Đặt cọc {int(body.deposit_amount):,} VND — {dep_method.value}"
        _log(db, booking.id, current_user.id, "PAYMENT", dep_desc)
        log_activity(db, "PAYMENT", dep_desc,
                     booking_id=booking.id, room_number=room_num,
                     actor_name=current_user.full_name, user_id=current_user.id)

    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)


@router.post("/walk-in", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def walk_in_booking(
    body: WalkInCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a booking and immediately check the guest in — single atomic walk-in flow."""
    if body.check_out_date <= body.check_in_date:
        raise HTTPException(status_code=400, detail="Ngày trả phòng phải sau ngày nhận phòng")

    room = db.get(Room, body.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Phòng không tồn tại")

    # Availability check — raises structured 409 if room is taken
    _check_room_availability(db, body.room_id, body.check_in_date, body.check_out_date)

    guest = _find_or_create_guest(
        db, body.guest_name, body.guest_phone,
        id_type=body.guest_id_type, id_number=body.guest_id_number,
    )

    # Create booking directly as CONFIRMED (skip PENDING for walk-ins)
    booking = Booking(
        room_id=body.room_id,
        guest_id=guest.id,
        check_in_date=body.check_in_date,
        check_out_date=body.check_out_date,
        num_guests=body.num_guests,
        ota_source=OTASource.DIRECT,
        status=BookingStatus.CONFIRMED,
        total_price=body.total_price,
        collected_amount=Decimal("0"),
        notes=body.notes,
        created_by_id=current_user.id,
    )
    db.add(booking)
    db.flush()

    walkin_desc = (
        f"Walk-in — {body.guest_name}, Phòng {room.room_number}, "
        f"{body.check_in_date} → {body.check_out_date}, "
        f"{int(body.total_price):,} VND"
    )
    _log(db, booking.id, current_user.id, "CREATED", walkin_desc)
    log_activity(db, "BOOKING_CREATED", walkin_desc,
                 booking_id=booking.id, room_number=room.room_number,
                 actor_name=current_user.full_name, user_id=current_user.id)

    # Record payment if provided
    if body.deposit_amount > 0:
        try:
            pay_method = PaymentMethod(body.payment_method)
        except ValueError:
            pay_method = PaymentMethod.CASH
        payment = Payment(
            booking_id=booking.id,
            amount=body.deposit_amount,
            method=pay_method,
            notes="Thu khi nhận phòng (walk-in)",
            recorded_by_id=current_user.id,
        )
        db.add(payment)
        db.flush()
        _recalculate_collected(db, booking)
        wi_pay_desc = f"Thu {int(body.deposit_amount):,} VND — {pay_method.value} ({body.guest_name})"
        _log(db, booking.id, current_user.id, "PAYMENT", wi_pay_desc)
        log_activity(db, "PAYMENT", wi_pay_desc,
                     booking_id=booking.id, room_number=room.room_number,
                     actor_name=current_user.full_name, user_id=current_user.id)

    # Check in: CONFIRMED → CHECKED_IN
    booking.status = BookingStatus.CHECKED_IN
    checkin_desc = f"Nhận phòng (walk-in) — CONFIRMED → CHECKED_IN — Phòng {room.room_number}"
    _log(db, booking.id, current_user.id, "STATUS_CHANGED", checkin_desc)
    log_activity(db, "CHECKED_IN", checkin_desc,
                 booking_id=booking.id, room_number=room.room_number,
                 actor_name=current_user.full_name, user_id=current_user.id)

    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")
    return _to_booking_out(booking)


@router.patch("/{booking_id}", response_model=BookingOut)
def update_booking(
    booking_id: int,
    body: BookingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")

    if booking.status in _TERMINAL:
        raise HTTPException(status_code=400, detail="Không thể sửa đặt phòng đã hoàn tất hoặc đã hủy")

    # RECEPTIONISTs can only edit CONFIRMED bookings
    if current_user.role == UserRole.RECEPTIONIST and booking.status != BookingStatus.CONFIRMED:
        raise HTTPException(status_code=403, detail="Lễ tân chỉ được sửa đặt phòng chưa nhận phòng")

    # Compute effective dates (for conflict checking)
    new_check_in = body.check_in_date or booking.check_in_date
    new_check_out = body.check_out_date or booking.check_out_date
    if new_check_out <= new_check_in:
        raise HTTPException(status_code=400, detail="Ngày trả phòng phải sau ngày nhận phòng")

    # Determine effective room (new or existing)
    # body.room_id = None means "don't change"; we need a sentinel to distinguish "clear" from "unchanged"
    new_room_id = body.room_id if body.room_id is not None else booking.room_id
    dates_changed = body.check_in_date is not None or body.check_out_date is not None
    room_changed = body.room_id is not None and body.room_id != booking.room_id

    if new_room_id is not None and (room_changed or dates_changed):
        room = db.get(Room, new_room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Phòng không tồn tại")
        _check_room_availability(db, new_room_id, new_check_in, new_check_out, exclude_booking_id=booking_id)

    # Apply room assignment
    if body.room_id is not None:
        booking.room_id = body.room_id

    # Apply date/booking field changes
    if body.check_in_date is not None:
        booking.check_in_date = body.check_in_date
    if body.check_out_date is not None:
        booking.check_out_date = body.check_out_date
    if body.num_guests is not None:
        booking.num_guests = body.num_guests
    if body.ota_source is not None:
        booking.ota_source = body.ota_source
    if body.total_price is not None:
        booking.total_price = body.total_price
    if body.booking_ref is not None:
        booking.booking_ref = body.booking_ref
    if body.notes is not None:
        booking.notes = body.notes

    # Apply guest field changes
    if body.guest_name is not None or body.guest_phone is not None or body.guest_id_type is not None or body.guest_id_number is not None:
        guest = booking.guest
        if body.guest_name is not None:
            guest.full_name = body.guest_name
        if body.guest_phone is not None:
            guest.phone = body.guest_phone
        if body.guest_id_type is not None:
            guest.id_type = body.guest_id_type
        if body.guest_id_number is not None:
            guest.id_number = body.guest_id_number

    _log(db, booking_id, current_user.id, "UPDATED", "Cập nhật thông tin đặt phòng")

    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)


@router.patch("/{booking_id}/status", response_model=BookingOut)
def update_booking_status(
    booking_id: int,
    body: BookingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")

    allowed = _TRANSITIONS.get(booking.status, {})
    new_status = allowed.get(body.action)
    if not new_status:
        raise HTTPException(
            status_code=400,
            detail=f"Không thể '{body.action}' đặt phòng có trạng thái '{booking.status.value}'",
        )

    # Check-in: must have a room assigned
    if body.action == "check_in":
        effective_room_id = body.room_id or booking.room_id
        if effective_room_id is None:
            raise HTTPException(
                status_code=400,
                detail="Phải chọn phòng trước khi nhận phòng",
            )
        if body.room_id and body.room_id != booking.room_id:
            room = db.get(Room, body.room_id)
            if not room:
                raise HTTPException(status_code=404, detail="Phòng không tồn tại")
            _check_room_availability(db, body.room_id, booking.check_in_date, booking.check_out_date, exclude_booking_id=booking_id)
            booking.room_id = body.room_id

    old_status = booking.status
    booking.status = new_status

    if new_status == BookingStatus.CHECKED_OUT:
        if booking.room:
            booking.room.housekeeping_status = RoomStatus.DIRTY
        booking.guest.times_stayed += 1

    if new_status in [BookingStatus.CANCELLED, BookingStatus.NO_SHOW]:
        for br in booking.bike_rentals:
            if br.status == BikeRentalStatus.ACTIVE:
                br.status = BikeRentalStatus.CANCELLED
                other_active = (
                    db.query(BikeRentalModel)
                    .filter(
                        BikeRentalModel.bike_id == br.bike_id,
                        BikeRentalModel.id != br.id,
                        BikeRentalModel.status == BikeRentalStatus.ACTIVE,
                    )
                    .first()
                )
                if not other_active:
                    br.bike.status = BikeStatus.AVAILABLE

    _TRANSITION_LABELS: dict[str, str] = {
        "confirm":   "Xác nhận đặt phòng",
        "check_in":  "Nhận phòng",
        "check_out": "Trả phòng",
        "cancel":    "Hủy đặt phòng",
        "no_show":   "No-show",
    }
    _ACTION_EVENT: dict[str, str] = {
        "confirm":   "CONFIRMED",
        "check_in":  "CHECKED_IN",
        "check_out": "CHECKED_OUT",
        "cancel":    "CANCELLED",
        "no_show":   "NO_SHOW",
    }
    label = _TRANSITION_LABELS.get(body.action, body.action)
    reason_suffix = f" — Lý do: {body.reason}" if body.reason else ""
    status_desc = f"{label} — {old_status.value} → {new_status.value}{reason_suffix}"
    _log(db, booking_id, current_user.id, "STATUS_CHANGED", status_desc)
    event_type = _ACTION_EVENT.get(body.action, "STATUS_CHANGED")
    room_num = booking.room.room_number if booking.room else None
    log_activity(db, event_type, status_desc,
                 booking_id=booking_id, room_number=room_num,
                 actor_name=current_user.full_name, user_id=current_user.id)

    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)


@router.post("/{booking_id}/archive", response_model=BookingOut)
def archive_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_above),
):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")
    if booking.status == BookingStatus.CHECKED_IN:
        raise HTTPException(status_code=400, detail="Không thể lưu trữ đặt phòng đang có khách ở")
    if booking.is_archived:
        raise HTTPException(status_code=400, detail="Đặt phòng đã được lưu trữ")

    booking.is_archived = True
    booking.archived_at = datetime.now(timezone.utc)
    booking.archived_by_user_id = current_user.id
    _log(db, booking_id, current_user.id, "ARCHIVED", "Đặt phòng đã được lưu trữ")
    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)


@router.post("/{booking_id}/restore", response_model=BookingOut)
def restore_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_above),
):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")
    if not booking.is_archived and booking.status not in [BookingStatus.CANCELLED, BookingStatus.NO_SHOW]:
        raise HTTPException(
            status_code=400,
            detail="Chỉ có thể khôi phục đặt phòng đã lưu trữ hoặc đã hủy/no-show",
        )

    # Re-run conflict detection before restoring an active room assignment
    if booking.room_id:
        _check_room_availability(
            db, booking.room_id, booking.check_in_date, booking.check_out_date,
            exclude_booking_id=booking_id,
        )

    old_status = booking.status
    booking.is_archived = False
    booking.archived_at = None
    booking.archived_by_user_id = None
    booking.status = BookingStatus.PENDING
    _log(
        db, booking_id, current_user.id, "RESTORED",
        f"Đặt phòng đã được khôi phục — {old_status.value} → PENDING",
    )
    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)


@router.get("/{booking_id}/payments", response_model=list[PaymentOut])
def list_payments(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")
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
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")
    if body.amount == 0:
        raise HTTPException(status_code=400, detail="Số tiền không được bằng 0")

    is_refund = body.amount < 0
    # Block new charges on cancelled/no-show; still allow refunds
    if not is_refund and booking.status in [BookingStatus.CANCELLED, BookingStatus.NO_SHOW]:
        raise HTTPException(status_code=400, detail="Không thể thu tiền cho đặt phòng đã hủy")

    new_collected = booking.collected_amount + body.amount
    if not is_refund and new_collected > booking.total_price:
        raise HTTPException(
            status_code=400,
            detail=f"Số tiền vượt quá tổng đặt phòng. Còn lại: {booking.total_price - booking.collected_amount}",
        )
    if is_refund and new_collected < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Không thể hoàn trả quá số tiền đã thu. Đã thu: {booking.collected_amount}",
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

    _METHOD_LABELS = {"CASH": "Tiền mặt", "BANK_TRANSFER": "Chuyển khoản", "OTA_COLLECTED": "OTA"}
    method_label = _METHOD_LABELS.get(str(body.method), str(body.method))
    pay_desc = (
        f"Hoàn trả {abs(int(body.amount)):,} VND — {method_label}"
        if is_refund else
        f"Thu {int(body.amount):,} VND — {method_label}"
    )
    room_suffix = f" · P.{booking.room.room_number}" if booking.room else ""
    guest_suffix = f" ({booking.guest.full_name})"
    _log(db, booking_id, current_user.id, "PAYMENT", pay_desc)
    log_activity(db, "PAYMENT", pay_desc + room_suffix + guest_suffix,
                 booking_id=booking_id,
                 room_number=booking.room.room_number if booking.room else None,
                 actor_name=current_user.full_name, user_id=current_user.id)

    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)


@router.post("/{booking_id}/payments/{payment_id}/void", response_model=BookingOut)
def void_payment(
    booking_id: int,
    payment_id: int,
    body: PaymentVoid,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Void a payment by creating a full reversal entry. Preserves audit trail."""
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")
    payment = db.get(Payment, payment_id)
    if not payment or payment.booking_id != booking_id:
        raise HTTPException(status_code=404, detail="Khoản thanh toán không tồn tại")
    if payment.amount < 0:
        raise HTTPException(status_code=400, detail="Không thể hủy khoản hoàn trả")

    reversal = Payment(
        booking_id=booking_id,
        amount=-payment.amount,
        method=payment.method,
        notes=f"Hủy #{payment_id}: {body.reason}",
        recorded_by_id=current_user.id,
    )
    db.add(reversal)
    db.flush()
    _recalculate_collected(db, booking)

    desc = f"Hủy khoản thu #{payment_id} ({int(payment.amount):,} VND) — {body.reason}"
    room_suffix = f" · P.{booking.room.room_number}" if booking.room else ""
    guest_suffix = f" ({booking.guest.full_name})"
    _log(db, booking_id, current_user.id, "PAYMENT_VOID", desc)
    log_activity(db, "PAYMENT", desc + room_suffix + guest_suffix,
                 booking_id=booking_id,
                 room_number=booking.room.room_number if booking.room else None,
                 actor_name=current_user.full_name, user_id=current_user.id)

    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)


@router.post("/{booking_id}/late-checkout", response_model=BookingOut)
def add_late_checkout_surcharge(
    booking_id: int,
    body: LateCheckoutSurcharge,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")
    if booking.status != BookingStatus.CHECKED_IN:
        raise HTTPException(status_code=400, detail="Chỉ có thể thêm phụ thu cho đặt phòng đang lưu trú")

    from datetime import datetime
    booking.total_price = booking.total_price + body.amount
    timestamp = datetime.now().strftime("%d/%m/%Y %H:%M")
    surcharge_note = f"[Phụ thu trả phòng muộn: +{body.amount:,.0f} VND — {timestamp} — {current_user.full_name}]"
    if body.notes:
        surcharge_note += f" {body.notes}"
    booking.notes = (booking.notes + "\n" + surcharge_note) if booking.notes else surcharge_note

    desc = f"Phụ thu trả phòng muộn +{int(body.amount):,} VND"
    if body.notes:
        desc += f" — {body.notes}"
    _log(db, booking_id, current_user.id, "SURCHARGE", desc)

    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)


@router.get("/logs/recent", response_model=list[BookingLogOut])
def recent_activity(
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if limit > 50:
        limit = 50
    logs = (
        db.query(BookingLog)
        .order_by(BookingLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        BookingLogOut(
            id=log.id,
            booking_id=log.booking_id,
            action=log.action,
            description=log.description,
            created_by_name=log.user.full_name if log.user else None,
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get("/{booking_id}/logs", response_model=list[BookingLogOut])
def get_booking_logs(
    booking_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_above),
):
    if not db.get(Booking, booking_id):
        raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")
    logs = (
        db.query(BookingLog)
        .filter(BookingLog.booking_id == booking_id)
        .order_by(BookingLog.created_at.asc())
        .all()
    )
    return [
        BookingLogOut(
            id=log.id,
            booking_id=log.booking_id,
            action=log.action,
            description=log.description,
            created_by_name=log.user.full_name if log.user else None,
            created_at=log.created_at,
        )
        for log in logs
    ]
