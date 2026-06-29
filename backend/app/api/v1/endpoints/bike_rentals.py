from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin_or_above, require_owner
from app.models.bike import Bike
from app.models.bike_payment import BikePayment
from app.models.bike_rental import BikeRental
from app.models.booking import Booking
from app.models.enums import BikeRentalStatus, BikeStatus
from app.models.user import User


def _find_available_bikes(
    db: Session,
    start_date: date,
    end_date: date,
    exclude_bike_id: int,
    limit: int = 3,
) -> list[dict]:
    from sqlalchemy import select
    conflicting_ids = (
        select(BikeRental.bike_id)
        .where(
            BikeRental.status == BikeRentalStatus.ACTIVE,
            BikeRental.start_date <= end_date,
            BikeRental.end_date >= start_date,
        )
    )
    available = (
        db.query(Bike)
        .filter(
            Bike.id != exclude_bike_id,
            Bike.status != BikeStatus.MAINTENANCE,
            ~Bike.id.in_(conflicting_ids),
        )
        .order_by(Bike.name)
        .limit(limit)
        .all()
    )
    return [
        {
            "bike_id": b.id,
            "bike_name": b.name,
            "plate_number": b.plate_number,
            "daily_rate": str(b.daily_rate),
        }
        for b in available
    ]


def _check_bike_availability(
    db: Session,
    bike_id: int,
    start_date: date,
    end_date: date,
    exclude_rental_id: int | None = None,
) -> None:
    q = db.query(BikeRental).filter(
        BikeRental.bike_id == bike_id,
        BikeRental.status == BikeRentalStatus.ACTIVE,
        BikeRental.start_date <= end_date,
        BikeRental.end_date >= start_date,
    )
    if exclude_rental_id:
        q = q.filter(BikeRental.id != exclude_rental_id)
    conflict = q.first()
    if not conflict:
        return

    bike = db.get(Bike, bike_id)
    bike_label = bike.name if bike else f"xe #{bike_id}"
    suggestions = _find_available_bikes(db, start_date, end_date, bike_id)
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "type": "BIKE_CONFLICT",
            "message": (
                f"{bike_label} đã được đặt từ {conflict.start_date} "
                f"đến {conflict.end_date}"
            ),
            "conflict": {
                "rental_id": conflict.id,
                "guest_name": conflict.booking.guest.full_name if conflict.booking and conflict.booking.guest else "—",
                "start_date": str(conflict.start_date),
                "end_date": str(conflict.end_date),
                "room_number": conflict.booking.room.room_number if conflict.booking and conflict.booking.room else None,
            },
            "suggestions": suggestions,
        },
    )
from app.schemas.bike import (
    BikeCreate,
    BikeOut,
    BikePaymentCreate,
    BikePaymentOut,
    BikeRentalCreate,
    BikeRentalOut,
    BikeRentalReport,
    BikeRentalReportRow,
    BikeRentalUpdate,
    BikeUpdate,
)

router = APIRouter()

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _calc_days(start: date, end: date) -> int:
    return max(1, (end - start).days)


def _to_rental_out(r: BikeRental) -> BikeRentalOut:
    return BikeRentalOut(
        id=r.id,
        bike_id=r.bike_id,
        bike_name=r.bike.name,
        plate_number=r.bike.plate_number,
        booking_id=r.booking_id,
        room_number=r.booking.room.room_number if r.booking.room else None,
        guest_name=r.booking.guest.full_name,
        start_date=r.start_date,
        end_date=r.end_date,
        num_days=r.num_days,
        daily_rate=r.daily_rate,
        total_amount=r.total_amount,
        collected_amount=r.collected_amount,
        status=r.status,
        notes=r.notes,
        created_by_name=r.created_by_user.full_name if r.created_by_user else None,
        created_at=r.created_at,
        updated_at=r.updated_at,
        payments=[
            BikePaymentOut(
                id=p.id,
                bike_rental_id=p.bike_rental_id,
                amount=p.amount,
                method=p.method,
                paid_at=p.paid_at,
                recorded_by_name=p.recorded_by.full_name if p.recorded_by else None,
                notes=p.notes,
            )
            for p in r.payments
        ],
    )


def _recalc_collected(db: Session, rental: BikeRental) -> None:
    total = (
        db.query(func.sum(BikePayment.amount))
        .filter(BikePayment.bike_rental_id == rental.id)
        .scalar()
    ) or Decimal("0")
    rental.collected_amount = total


# ─── Bikes (fleet management) ─────────────────────────────────────────────────

@router.get("/bikes", response_model=list[BikeOut])
def list_bikes(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(Bike).order_by(Bike.name).all()


@router.post("/bikes", response_model=BikeOut, status_code=status.HTTP_201_CREATED)
def create_bike(
    body: BikeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_above),
):
    bike = Bike(
        name=body.name,
        plate_number=body.plate_number,
        daily_rate=body.daily_rate,
        notes=body.notes,
    )
    db.add(bike)
    db.commit()
    db.refresh(bike)
    return bike


@router.patch("/bikes/{bike_id}", response_model=BikeOut)
def update_bike(
    bike_id: int,
    body: BikeUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_above),
):
    bike = db.get(Bike, bike_id)
    if not bike:
        raise HTTPException(status_code=404, detail="Xe không tồn tại")
    if body.name is not None:
        bike.name = body.name
    if body.plate_number is not None:
        bike.plate_number = body.plate_number
    if body.daily_rate is not None:
        bike.daily_rate = body.daily_rate
    if body.status is not None:
        bike.status = body.status
    if body.notes is not None:
        bike.notes = body.notes
    db.commit()
    db.refresh(bike)
    return bike


@router.delete("/bikes/{bike_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bike(
    bike_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_owner),
):
    bike = db.get(Bike, bike_id)
    if not bike:
        raise HTTPException(status_code=404, detail="Xe không tồn tại")
    active = (
        db.query(BikeRental)
        .filter(BikeRental.bike_id == bike_id, BikeRental.status == BikeRentalStatus.ACTIVE)
        .first()
    )
    if active:
        raise HTTPException(status_code=400, detail="Không thể xóa xe đang được thuê")
    db.delete(bike)
    db.commit()


# ─── Bike rentals ─────────────────────────────────────────────────────────────

@router.get("/rentals", response_model=list[BikeRentalOut])
def list_rentals(
    booking_id: int | None = None,
    rental_status: BikeRentalStatus | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(BikeRental)
    if booking_id is not None:
        q = q.filter(BikeRental.booking_id == booking_id)
    if rental_status is not None:
        q = q.filter(BikeRental.status == rental_status)
    if start_date:
        q = q.filter(BikeRental.end_date >= start_date)
    if end_date:
        q = q.filter(BikeRental.start_date <= end_date)
    return [_to_rental_out(r) for r in q.order_by(BikeRental.start_date.desc()).all()]


@router.post("/rentals", response_model=BikeRentalOut, status_code=status.HTTP_201_CREATED)
def create_rental(
    body: BikeRentalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.end_date < body.start_date:
        raise HTTPException(status_code=400, detail="Ngày trả phải sau hoặc bằng ngày nhận")

    bike = db.get(Bike, body.bike_id)
    if not bike:
        raise HTTPException(status_code=404, detail="Xe không tồn tại")
    if bike.status == BikeStatus.MAINTENANCE:
        raise HTTPException(status_code=400, detail="Xe đang bảo trì, không thể cho thuê")

    booking = db.get(Booking, body.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Đặt phòng không tồn tại")

    _check_bike_availability(db, body.bike_id, body.start_date, body.end_date)

    num_days = _calc_days(body.start_date, body.end_date)
    total = bike.daily_rate * num_days

    rental = BikeRental(
        bike_id=body.bike_id,
        booking_id=body.booking_id,
        start_date=body.start_date,
        end_date=body.end_date,
        num_days=num_days,
        daily_rate=bike.daily_rate,
        total_amount=total,
        notes=body.notes,
        created_by_id=current_user.id,
    )
    db.add(rental)
    bike.status = BikeStatus.RENTED
    db.commit()
    db.refresh(rental)
    return _to_rental_out(rental)


@router.patch("/rentals/{rental_id}", response_model=BikeRentalOut)
def update_rental(
    rental_id: int,
    body: BikeRentalUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_above),
):
    rental = db.get(BikeRental, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Thuê xe không tồn tại")
    if rental.status != BikeRentalStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Chỉ có thể sửa thuê xe đang hoạt động")

    new_start = body.start_date or rental.start_date
    new_end = body.end_date or rental.end_date
    if new_end < new_start:
        raise HTTPException(status_code=400, detail="Ngày trả phải sau hoặc bằng ngày nhận")

    if body.start_date is not None or body.end_date is not None:
        _check_bike_availability(db, rental.bike_id, new_start, new_end, exclude_rental_id=rental_id)

    if body.start_date is not None:
        rental.start_date = body.start_date
    if body.end_date is not None:
        rental.end_date = body.end_date
    if body.notes is not None:
        rental.notes = body.notes

    rental.num_days = _calc_days(rental.start_date, rental.end_date)
    rental.total_amount = rental.daily_rate * rental.num_days
    db.commit()
    db.refresh(rental)
    return _to_rental_out(rental)


@router.patch("/rentals/{rental_id}/return", response_model=BikeRentalOut)
def return_rental(
    rental_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rental = db.get(BikeRental, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Thuê xe không tồn tại")
    if rental.status != BikeRentalStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Thuê xe đã kết thúc hoặc đã hủy")

    rental.status = BikeRentalStatus.RETURNED
    # Only set bike to available if no other active rentals
    other = (
        db.query(BikeRental)
        .filter(
            BikeRental.bike_id == rental.bike_id,
            BikeRental.id != rental_id,
            BikeRental.status == BikeRentalStatus.ACTIVE,
        )
        .first()
    )
    if not other:
        rental.bike.status = BikeStatus.AVAILABLE

    db.commit()
    db.refresh(rental)
    return _to_rental_out(rental)


@router.delete("/rentals/{rental_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_rental(
    rental_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_above),
):
    rental = db.get(BikeRental, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Thuê xe không tồn tại")

    rental.status = BikeRentalStatus.CANCELLED
    other = (
        db.query(BikeRental)
        .filter(
            BikeRental.bike_id == rental.bike_id,
            BikeRental.id != rental_id,
            BikeRental.status == BikeRentalStatus.ACTIVE,
        )
        .first()
    )
    if not other:
        rental.bike.status = BikeStatus.AVAILABLE

    db.commit()


# ─── Bike payments ────────────────────────────────────────────────────────────

@router.post("/rentals/{rental_id}/payments", response_model=BikeRentalOut, status_code=status.HTTP_201_CREATED)
def add_payment(
    rental_id: int,
    body: BikePaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rental = db.get(BikeRental, rental_id)
    if not rental:
        raise HTTPException(status_code=404, detail="Thuê xe không tồn tại")
    if rental.status == BikeRentalStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Không thể thu tiền cho thuê xe đã hủy")

    outstanding = rental.total_amount - rental.collected_amount
    if body.amount > outstanding:
        raise HTTPException(
            status_code=400,
            detail=f"Số tiền vượt quá số còn lại ({outstanding:,.0f}đ)",
        )

    payment = BikePayment(
        bike_rental_id=rental_id,
        amount=body.amount,
        method=body.method,
        notes=body.notes,
        recorded_by_id=current_user.id,
    )
    db.add(payment)
    db.flush()
    _recalc_collected(db, rental)
    db.commit()
    db.refresh(rental)
    return _to_rental_out(rental)


# ─── Monthly report ───────────────────────────────────────────────────────────

@router.get("/report", response_model=BikeRentalReport)
def monthly_report(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_above),
):
    rentals = (
        db.query(BikeRental)
        .filter(
            BikeRental.status != BikeRentalStatus.CANCELLED,
            BikeRental.start_date <= end_date,
            BikeRental.end_date >= start_date,
        )
        .order_by(BikeRental.booking_id, BikeRental.start_date)
        .all()
    )

    # Group by booking
    booking_map: dict[int, list[BikeRental]] = {}
    for r in rentals:
        booking_map.setdefault(r.booking_id, []).append(r)

    rows: list[BikeRentalReportRow] = []
    grand_expected = Decimal("0")
    grand_collected = Decimal("0")

    for booking_id, bkr in booking_map.items():
        booking = bkr[0].booking
        expected = sum(r.total_amount for r in bkr)
        collected = sum(r.collected_amount for r in bkr)
        rows.append(BikeRentalReportRow(
            booking_id=booking_id,
            room_number=booking.room.room_number if booking.room else None,
            guest_name=booking.guest.full_name,
            check_in_date=booking.check_in_date,
            check_out_date=booking.check_out_date,
            rentals=[_to_rental_out(r) for r in bkr],
            total_expected=expected,
            total_collected=collected,
            outstanding=expected - collected,
        ))
        grand_expected += expected
        grand_collected += collected

    return BikeRentalReport(
        start_date=start_date,
        end_date=end_date,
        rows=rows,
        grand_expected=grand_expected,
        grand_collected=grand_collected,
        grand_outstanding=grand_expected - grand_collected,
    )
