from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin_or_above
from app.models.booking import Booking
from app.models.enums import BookingStatus, PaymentMethod, RoomStatus
from app.models.payment import Payment
from app.models.room import Room
from app.models.user import User
from app.schemas.revenue import (
    BookingSummaryRow,
    DailyReport,
    DailyRevenue,
    HousekeepingSummary,
    MonthlyRevenue,
    PaymentMethodBreakdown,
    RevenueSummary,
    SourceBreakdown,
)

router = APIRouter()

_COUNTED = [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]

_COMMISSION: dict[str, Decimal] = {
    "AGODA":       Decimal("0.18"),
    "BOOKING_COM": Decimal("0.15"),
    "TRAVELOKA":   Decimal("0.18"),
    "DIRECT":      Decimal("0.00"),
}


def _aggregate_by_source(bookings: list[Booking]) -> list[SourceBreakdown]:
    by_source: dict[str, dict] = {}
    for b in bookings:
        src = b.ota_source.value
        if src not in by_source:
            by_source[src] = {"bookings": 0, "revenue": Decimal(0), "collected": Decimal(0)}
        by_source[src]["bookings"] += 1
        by_source[src]["revenue"] += b.total_price
        by_source[src]["collected"] += b.collected_amount

    result = []
    for src, d in by_source.items():
        rate = _COMMISSION.get(src, Decimal(0))
        net = d["revenue"] * (1 - rate)
        result.append(SourceBreakdown(
            source=src,
            bookings=d["bookings"],
            revenue=d["revenue"],
            collected=d["collected"],
            commission_rate=rate,
            net_revenue=net,
        ))
    return result


def _payment_method_breakdown(db: Session, booking_ids: list[int]) -> PaymentMethodBreakdown:
    if not booking_ids:
        zero = Decimal(0)
        return PaymentMethodBreakdown(cash=zero, bank_transfer=zero, ota_collected=zero, total=zero)

    rows = (
        db.query(Payment.method, func.sum(Payment.amount).label("total"))
        .filter(Payment.booking_id.in_(booking_ids))
        .group_by(Payment.method)
        .all()
    )
    totals = {r.method: r.total for r in rows}
    cash = totals.get(PaymentMethod.CASH, Decimal(0))
    bank = totals.get(PaymentMethod.BANK_TRANSFER, Decimal(0))
    ota = totals.get(PaymentMethod.OTA_COLLECTED, Decimal(0))
    return PaymentMethodBreakdown(
        cash=cash,
        bank_transfer=bank,
        ota_collected=ota,
        total=cash + bank + ota,
    )


def _to_summary_row(b: Booking) -> BookingSummaryRow:
    return BookingSummaryRow(
        id=b.id,
        room_number=b.room.room_number,
        guest_name=b.guest.full_name,
        check_in_date=b.check_in_date,
        check_out_date=b.check_out_date,
        total_price=b.total_price,
        collected_amount=b.collected_amount,
        status=b.status,
        ota_source=b.ota_source,
    )


@router.get("/daily", response_model=DailyRevenue)
def daily_revenue(db: Session = Depends(get_db), _: User = Depends(require_admin_or_above)):
    today = date.today()
    bookings = (
        db.query(Booking)
        .filter(
            Booking.status.in_(_COUNTED),
            Booking.check_in_date <= today,
            Booking.check_out_date >= today,
        )
        .all()
    )
    total_booked = sum((b.total_price for b in bookings), Decimal(0))
    total_collected = sum((b.collected_amount for b in bookings), Decimal(0))
    return DailyRevenue(
        date=today,
        active_bookings=len(bookings),
        total_booked=total_booked,
        total_collected=total_collected,
        outstanding=total_booked - total_collected,
    )


@router.get("/summary", response_model=MonthlyRevenue)
def revenue_summary(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_above),
):
    today = date.today()
    if not start_date:
        start_date = today.replace(day=1)
    if not end_date:
        end_date = today

    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")

    bookings = (
        db.query(Booking)
        .filter(
            Booking.status.in_(_COUNTED),
            Booking.check_in_date >= start_date,
            Booking.check_in_date <= end_date,
        )
        .all()
    )

    by_source = _aggregate_by_source(bookings)
    total_net = sum((s.net_revenue for s in by_source), Decimal(0))
    total_revenue = sum((b.total_price for b in bookings), Decimal(0))
    total_collected = sum((b.collected_amount for b in bookings), Decimal(0))
    booking_ids = [b.id for b in bookings]

    return MonthlyRevenue(
        start_date=start_date,
        end_date=end_date,
        total_bookings=len(bookings),
        total_revenue=total_revenue,
        total_collected=total_collected,
        total_net_revenue=total_net,
        outstanding=total_revenue - total_collected,
        by_source=by_source,
        by_payment_method=_payment_method_breakdown(db, booking_ids),
    )


@router.get("/daily-report", response_model=DailyReport)
def daily_report(
    report_date: date | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    target = report_date or date.today()
    tomorrow = target + timedelta(days=1)

    arrivals = (
        db.query(Booking)
        .filter(
            Booking.check_in_date == target,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
        )
        .order_by(Booking.check_in_date)
        .all()
    )

    departures = (
        db.query(Booking)
        .filter(
            Booking.check_out_date == target,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]),
        )
        .order_by(Booking.check_in_date)
        .all()
    )

    in_house = (
        db.query(Booking)
        .filter(
            Booking.check_in_date < target,
            Booking.check_out_date > target,
            Booking.status == BookingStatus.CHECKED_IN,
        )
        .order_by(Booking.check_out_date)
        .all()
    )

    tomorrow_arrivals = (
        db.query(Booking)
        .filter(
            Booking.check_in_date == tomorrow,
            Booking.status == BookingStatus.CONFIRMED,
        )
        .order_by(Booking.check_in_date)
        .all()
    )

    active_today = {b.id: b for b in arrivals + in_house + departures}.values()
    total_booked = sum((b.total_price for b in active_today), Decimal(0))
    total_collected = sum((b.collected_amount for b in active_today), Decimal(0))

    rooms = db.query(Room).all()
    hk = HousekeepingSummary(
        dirty=sum(1 for r in rooms if r.housekeeping_status == RoomStatus.DIRTY),
        cleaning=sum(1 for r in rooms if r.housekeeping_status == RoomStatus.CLEANING),
        out_of_order=sum(1 for r in rooms if r.housekeeping_status == RoomStatus.OUT_OF_ORDER),
        available=sum(1 for r in rooms if r.housekeeping_status == RoomStatus.AVAILABLE),
    )

    return DailyReport(
        date=target,
        arrivals=[_to_summary_row(b) for b in arrivals],
        departures=[_to_summary_row(b) for b in departures],
        in_house=[_to_summary_row(b) for b in in_house],
        tomorrow_arrivals=[_to_summary_row(b) for b in tomorrow_arrivals],
        revenue=RevenueSummary(
            total_booked=total_booked,
            total_collected=total_collected,
            outstanding=total_booked - total_collected,
        ),
        housekeeping=hk,
    )
