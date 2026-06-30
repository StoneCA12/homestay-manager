from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import cast, func
from sqlalchemy import Date as SADate
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin_or_above
from app.models import (
    ActivityLog, Booking, BookingLog, HousekeepingLog, Payment, Room,
)
from app.models.bike_rental import BikeRental
from app.models.daily_snapshot import DailySnapshot
from app.models.enums import BikeRentalStatus, BookingStatus, PaymentMethod, RoomStatus
from app.models.user import User
from app.schemas.end_of_day import (
    EndOfDayReport,
    EodBikeActivity,
    EodBookingRow,
    EodOutstanding,
    EodPaymentRow,
    EodRevenueByMethod,
    EodRoomCleaned,
)

router = APIRouter()


def _booking_row(b: Booking) -> EodBookingRow:
    return EodBookingRow(
        id=b.id,
        room_number=b.room.room_number if b.room else None,
        guest_name=b.guest.full_name,
        check_in_date=b.check_in_date,
        check_out_date=b.check_out_date,
        total_price=b.total_price,
        collected_amount=b.collected_amount,
        status=b.status,
        ota_source=b.ota_source,
    )


def _payment_row(p: Payment) -> EodPaymentRow:
    b = p.booking
    return EodPaymentRow(
        id=p.id,
        booking_id=p.booking_id,
        guest_name=b.guest.full_name if b and b.guest else "",
        room_number=b.room.room_number if b and b.room else None,
        amount=p.amount,
        method=p.method,
        paid_at=p.paid_at,
        recorded_by=p.recorded_by.full_name if p.recorded_by else None,
    )


def _bike_row(r: BikeRental) -> EodBikeActivity:
    return EodBikeActivity(
        bike_name=r.bike.name,
        plate_number=r.bike.plate_number,
        room_number=r.booking.room.room_number if r.booking and r.booking.room else None,
        guest_name=r.booking.guest.full_name if r.booking and r.booking.guest else "",
    )


def generate_eod_report(db: Session, target_date: date) -> EndOfDayReport:
    # ── Arrivals: bookings whose CHECK_IN activity was logged today ──
    checked_in_ids = {
        row[0]
        for row in db.query(ActivityLog.booking_id).filter(
            ActivityLog.event_type == "CHECKED_IN",
            cast(ActivityLog.created_at, SADate) == target_date,
            ActivityLog.booking_id.isnot(None),
        ).all()
    }
    if checked_in_ids:
        checked_in_bookings = db.query(Booking).filter(Booking.id.in_(checked_in_ids)).all()
    else:
        checked_in_bookings = []
    arrivals_on_time = [b for b in checked_in_bookings if b.check_in_date == target_date]
    arrivals_late    = [b for b in checked_in_bookings if b.check_in_date < target_date]

    arrivals_no_show = (
        db.query(Booking)
        .filter(
            Booking.check_in_date == target_date,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.NO_SHOW]),
        )
        .all()
    )

    # ── Departures: bookings whose CHECK_OUT activity was logged today ──
    checked_out_ids = {
        row[0]
        for row in db.query(ActivityLog.booking_id).filter(
            ActivityLog.event_type == "CHECKED_OUT",
            cast(ActivityLog.created_at, SADate) == target_date,
            ActivityLog.booking_id.isnot(None),
        ).all()
    }
    if checked_out_ids:
        checked_out_bookings = db.query(Booking).filter(Booking.id.in_(checked_out_ids)).all()
    else:
        checked_out_bookings = []
    departures_on_time = [b for b in checked_out_bookings if b.check_out_date == target_date]
    departures_late    = [b for b in checked_out_bookings if b.check_out_date < target_date]

    # ── Revenue: all payments received today ──
    payments_today = (
        db.query(Payment)
        .filter(cast(Payment.paid_at, SADate) == target_date)
        .order_by(Payment.paid_at)
        .all()
    )
    method_totals: dict[str, Decimal] = {
        PaymentMethod.CASH.value: Decimal(0),
        PaymentMethod.BANK_TRANSFER.value: Decimal(0),
        PaymentMethod.OTA_COLLECTED.value: Decimal(0),
    }
    for p in payments_today:
        if p.amount > 0:
            key = p.method.value
            method_totals[key] = method_totals[key] + p.amount
    revenue = EodRevenueByMethod(
        cash=method_totals[PaymentMethod.CASH.value],
        bank_transfer=method_totals[PaymentMethod.BANK_TRANSFER.value],
        ota_collected=method_totals[PaymentMethod.OTA_COLLECTED.value],
        total=sum(method_totals.values()),
    )

    # ── Rooms cleaned today (to_status = AVAILABLE) ──
    cleaned_logs = (
        db.query(HousekeepingLog)
        .filter(
            HousekeepingLog.to_status == RoomStatus.AVAILABLE,
            cast(HousekeepingLog.created_at, SADate) == target_date,
        )
        .all()
    )
    rooms_cleaned = [
        EodRoomCleaned(
            room_number=log.room.room_number,
            cleaned_by=log.changed_by_user.full_name if log.changed_by_user else None,
            cleaned_at=log.created_at,
        )
        for log in cleaned_logs
    ]

    # ── Bikes assigned today ──
    bikes_assigned_q = (
        db.query(BikeRental)
        .filter(
            cast(BikeRental.created_at, SADate) == target_date,
            BikeRental.status != BikeRentalStatus.CANCELLED,
        )
        .all()
    )

    # ── Bikes returned today ──
    bikes_returned_q = (
        db.query(BikeRental)
        .filter(
            cast(BikeRental.updated_at, SADate) == target_date,
            BikeRental.status == BikeRentalStatus.RETURNED,
        )
        .all()
    )

    # ── Occupancy tonight ──
    total_rooms = db.query(func.count(Room.id)).scalar() or 0
    occupied_tonight = (
        db.query(func.count(Booking.id))
        .filter(
            Booking.check_in_date <= target_date,
            Booking.check_out_date > target_date,
            Booking.status == BookingStatus.CHECKED_IN,
        )
        .scalar()
    ) or 0

    # ── Outstanding balances (currently checked in) ──
    outstanding_q = (
        db.query(Booking)
        .filter(
            Booking.status == BookingStatus.CHECKED_IN,
            Booking.total_price > Booking.collected_amount,
        )
        .all()
    )

    # ── Booking activity counts ──
    bookings_created_count = (
        db.query(func.count(ActivityLog.id))
        .filter(
            ActivityLog.event_type == "BOOKING_CREATED",
            cast(ActivityLog.created_at, SADate) == target_date,
        )
        .scalar()
    ) or 0
    bookings_cancelled_count = (
        db.query(func.count(ActivityLog.id))
        .filter(
            ActivityLog.event_type == "CANCELLED",
            cast(ActivityLog.created_at, SADate) == target_date,
        )
        .scalar()
    ) or 0
    bookings_modified_count = (
        db.query(func.count(BookingLog.id))
        .filter(
            BookingLog.action == "UPDATED",
            cast(BookingLog.created_at, SADate) == target_date,
        )
        .scalar()
    ) or 0

    return EndOfDayReport(
        report_date=target_date,
        generated_at=datetime.utcnow(),
        is_snapshot=False,
        arrivals_on_time=[_booking_row(b) for b in arrivals_on_time],
        arrivals_late=[_booking_row(b) for b in arrivals_late],
        arrivals_no_show=[_booking_row(b) for b in arrivals_no_show],
        departures_on_time=[_booking_row(b) for b in departures_on_time],
        departures_late=[_booking_row(b) for b in departures_late],
        revenue=revenue,
        payments=[_payment_row(p) for p in payments_today],
        rooms_cleaned=rooms_cleaned,
        bikes_assigned=[_bike_row(r) for r in bikes_assigned_q],
        bikes_returned=[_bike_row(r) for r in bikes_returned_q],
        total_rooms=total_rooms,
        occupied_tonight=occupied_tonight,
        outstanding_balances=[
            EodOutstanding(
                booking_id=b.id,
                room_number=b.room.room_number if b.room else None,
                guest_name=b.guest.full_name,
                outstanding=b.total_price - b.collected_amount,
                check_out_date=b.check_out_date,
            )
            for b in outstanding_q
        ],
        bookings_created_count=bookings_created_count,
        bookings_cancelled_count=bookings_cancelled_count,
        bookings_modified_count=bookings_modified_count,
    )


@router.get("/end-of-day", response_model=EndOfDayReport)
def get_end_of_day(
    report_date: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    target = report_date or date.today()
    # Only use stored snapshot for past dates — today is always computed live
    if target < date.today():
        snapshot = db.query(DailySnapshot).filter(DailySnapshot.report_date == target).first()
        if snapshot:
            report = EndOfDayReport.model_validate_json(snapshot.report_json)
            report.is_snapshot = True
            return report
    return generate_eod_report(db, target)


@router.post("/end-of-day/generate", response_model=EndOfDayReport)
def trigger_generate(
    report_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_above),
):
    target = report_date or date.today()
    report = generate_eod_report(db, target)
    report_json = report.model_dump_json()

    snapshot = db.query(DailySnapshot).filter(DailySnapshot.report_date == target).first()
    if snapshot:
        snapshot.report_json = report_json
        snapshot.generated_at = datetime.utcnow()
        snapshot.generated_by_id = current_user.id
    else:
        db.add(DailySnapshot(
            report_date=target,
            report_json=report_json,
            generated_by_id=current_user.id,
        ))
    db.commit()
    return report
