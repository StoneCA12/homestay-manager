from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.bike_rental import BikeRental as BikeRentalModel
from app.models.booking import Booking
from app.models.enums import BikeRentalStatus, BikeStatus, BookingStatus, RoomStatus, UserRole
from app.models.guest import Guest
from app.models.payment import Payment
from app.models.room import Room
from app.models.user import User
from app.schemas.booking import (
    BookingCreate,
    BookingOut,
    BookingStatusUpdate,
    BookingUpdate,
    CalendarBooking,
    LateCheckoutSurcharge,
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
# Terminal statuses — no edits allowed
_TERMINAL = [BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED, BookingStatus.NO_SHOW]


def _to_booking_out(b: Booking) -> BookingOut:
    return BookingOut(
        id=b.id,
        booking_ref=b.booking_ref,
        room_id=b.room_id,
        room_number=b.room.room_number if b.room else None,
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
                f"Phòng đã có đặt từ {conflict.check_in_date} đến {conflict.check_out_date} "
                f"(đặt phòng #{conflict.id})"
            ),
        )


def _recalculate_collected(db: Session, booking: Booking) -> None:
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
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Booking).join(Booking.guest)
    if booking_status:
        q = q.filter(Booking.status == booking_status)
    if start_date:
        q = q.filter(Booking.check_out_date >= start_date)
    if end_date:
        q = q.filter(Booking.check_in_date <= end_date)
    if search:
        q = q.filter(Guest.full_name.ilike(f"%{search}%"))
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

    db.commit()
    db.refresh(booking)
    return _to_booking_out(booking)
