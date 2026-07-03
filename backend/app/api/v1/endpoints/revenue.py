from datetime import date, timedelta
from decimal import Decimal
import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin_or_above
from app.models.bike_rental import BikeRental as BikeRentalModel
from app.models.booking import Booking
from app.models.commission_rate import CommissionRate
from app.models.enums import BikeRentalStatus, BookingStatus, PaymentMethod, RoomStatus
from app.models.payment import Payment
from app.models.room import Room
from app.models.user import User
from app.schemas.revenue import (
    BikeReturnRow,
    BookingSummaryRow,
    DailyReport,
    DailyRevenue,
    HousekeepingSummary,
    MonthlyRevenue,
    PaymentMethodBreakdown,
    RevenueSummary,
    RoomTypeBreakdown,
    SourceBreakdown,
)

router = APIRouter()

# Revenue is recognized only for stays that have actually started — CONFIRMED bookings
# are future/unrealized reservations (no stay has happened, guest could still cancel or
# no-show) and must not be counted as revenue, only as pipeline/occupancy forecast data
# elsewhere. Financial totals here must reflect actual completed-or-in-progress stays.
_COUNTED = [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT]

# Fallback rates if commission_rates table is empty or source not found
_FALLBACK_COMMISSION: dict[str, Decimal] = {
    "AGODA":       Decimal("0.15"),
    "BOOKING_COM": Decimal("0.10"),
    "TRAVELOKA":   Decimal("0.12"),
    "ZALO":        Decimal("0.00"),
    "DIRECT":      Decimal("0.00"),
}


def _load_commission_rates(db: Session) -> dict[str, Decimal]:
    rows = db.query(CommissionRate).all()
    if rows:
        return {r.ota_source: r.rate for r in rows}
    return _FALLBACK_COMMISSION


def _aggregate_by_source(bookings: list[Booking], commission: dict[str, Decimal]) -> list[SourceBreakdown]:
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
        rate = commission.get(src, Decimal(0))
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
        room_number=b.room.room_number if b.room else None,
        guest_name=b.guest.full_name,
        check_in_date=b.check_in_date,
        check_out_date=b.check_out_date,
        total_price=b.total_price,
        collected_amount=b.collected_amount,
        status=b.status,
        ota_source=b.ota_source,
    )


def _aggregate_by_room_type(
    bookings: list[Booking],
    commission: dict[str, Decimal],
    period_start: date,
    period_end: date,
) -> list[RoomTypeBreakdown]:
    by_type: dict[str, dict] = {}
    for b in bookings:
        rtype = b.room.room_type.value if b.room else "UNASSIGNED"
        if rtype not in by_type:
            by_type[rtype] = {"bookings": 0, "revenue": Decimal(0), "net": Decimal(0), "nights": 0}
        by_type[rtype]["bookings"] += 1
        by_type[rtype]["revenue"] += b.total_price
        rate = commission.get(b.ota_source.value, Decimal(0))
        by_type[rtype]["net"] += b.total_price * (1 - rate)
        # count nights overlapping with the period
        overlap_start = max(b.check_in_date, period_start)
        overlap_end = min(b.check_out_date, period_end + timedelta(days=1))
        nights = max(0, (overlap_end - overlap_start).days)
        by_type[rtype]["nights"] += nights
    return [
        RoomTypeBreakdown(
            room_type=rt,
            bookings=d["bookings"],
            revenue=d["revenue"],
            net_revenue=d["net"],
            nights=d["nights"],
        )
        for rt, d in sorted(by_type.items())
    ]


def _compute_occupancy_rate(
    bookings: list[Booking],
    total_rooms: int,
    period_start: date,
    period_end: date,
) -> Decimal:
    period_days = max(1, (period_end - period_start).days + 1)
    available_nights = total_rooms * period_days
    booked_nights = 0
    for b in bookings:
        overlap_start = max(b.check_in_date, period_start)
        overlap_end = min(b.check_out_date, period_end + timedelta(days=1))
        booked_nights += max(0, (overlap_end - overlap_start).days)
    return Decimal(str(round(booked_nights / available_nights, 4))) if available_nights else Decimal(0)


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

    commission = _load_commission_rates(db)
    by_source = _aggregate_by_source(bookings, commission)
    total_net = sum((s.net_revenue for s in by_source), Decimal(0))
    total_revenue = sum((b.total_price for b in bookings), Decimal(0))
    total_collected = sum((b.collected_amount for b in bookings), Decimal(0))
    booking_ids = [b.id for b in bookings]

    total_rooms = db.query(func.count(Room.id)).scalar() or 1
    by_room_type = _aggregate_by_room_type(bookings, commission, start_date, end_date)
    occupancy_rate = _compute_occupancy_rate(bookings, total_rooms, start_date, end_date)

    # Bike rental revenue is now folded into total_price/total_revenue above (same
    # recognition convention as room revenue: by the booking's check-in date, not by
    # transaction date). These fields are a breakdown of *how much of total_revenue*
    # came from bike rentals, for the same booking set — not an addition on top of it.
    bike_rentals_in_period = (
        db.query(BikeRentalModel)
        .filter(
            BikeRentalModel.booking_id.in_(booking_ids),
            BikeRentalModel.status != BikeRentalStatus.CANCELLED,
        )
        .all()
    ) if booking_ids else []
    bike_revenue = sum((r.total_amount for r in bike_rentals_in_period), Decimal(0))
    bike_collected = sum((r.collected_amount for r in bike_rentals_in_period), Decimal(0))

    return MonthlyRevenue(
        start_date=start_date,
        end_date=end_date,
        total_bookings=len(bookings),
        total_revenue=total_revenue,
        total_collected=total_collected,
        total_net_revenue=total_net,
        outstanding=total_revenue - total_collected,
        occupancy_rate=occupancy_rate,
        by_source=by_source,
        by_room_type=by_room_type,
        by_payment_method=_payment_method_breakdown(db, booking_ids),
        bike_revenue=bike_revenue,
        bike_collected=bike_collected,
        bike_outstanding=bike_revenue - bike_collected,
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

    active_today = list({b.id: b for b in arrivals + in_house + departures}.values())
    total_booked = sum((b.total_price for b in active_today), Decimal(0))
    total_collected = sum((b.collected_amount for b in active_today), Decimal(0))

    rooms = db.query(Room).all()
    hk = HousekeepingSummary(
        dirty=sum(1 for r in rooms if r.housekeeping_status == RoomStatus.DIRTY),
        cleaning=sum(1 for r in rooms if r.housekeeping_status == RoomStatus.CLEANING),
        out_of_order=sum(1 for r in rooms if r.housekeeping_status == RoomStatus.OUT_OF_ORDER),
        available=sum(1 for r in rooms if r.housekeeping_status == RoomStatus.AVAILABLE),
    )

    # Batch-load active bike rentals for all relevant bookings
    active_booking_ids = [b.id for b in active_today]
    active_rentals = (
        db.query(BikeRentalModel)
        .filter(
            BikeRentalModel.booking_id.in_(active_booking_ids),
            BikeRentalModel.status == BikeRentalStatus.ACTIVE,
        )
        .all()
    ) if active_booking_ids else []

    # Per-booking bike summary: {booking_id: (names, collected)}. total_price already
    # includes bike rental cost (folded in at rental creation/extension), so this tracks
    # how much of that has been collected via the separate bike payment ledger.
    bike_by_booking: dict[int, tuple[list[str], Decimal]] = {}
    for r in active_rentals:
        names, collected = bike_by_booking.get(r.booking_id, ([], Decimal(0)))
        names = names + [r.bike.name]
        collected = collected + r.collected_amount
        bike_by_booking[r.booking_id] = (names, collected)

    def _row(b: Booking) -> BookingSummaryRow:
        names, collected = bike_by_booking.get(b.id, ([], Decimal(0)))
        return BookingSummaryRow(
            id=b.id,
            room_number=b.room.room_number if b.room else None,
            guest_name=b.guest.full_name,
            check_in_date=b.check_in_date,
            check_out_date=b.check_out_date,
            total_price=b.total_price,
            collected_amount=b.collected_amount,
            status=b.status,
            ota_source=b.ota_source,
            bike_names=names,
            bike_collected=collected,
        )

    # Bikes due to be returned today
    bike_returns_q = (
        db.query(BikeRentalModel)
        .filter(
            BikeRentalModel.end_date == target,
            BikeRentalModel.status == BikeRentalStatus.ACTIVE,
        )
        .all()
    )
    bike_returns_today = [
        BikeReturnRow(
            bike_rental_id=r.id,
            booking_id=r.booking_id,
            bike_name=r.bike.name,
            plate_number=r.bike.plate_number,
            room_number=r.booking.room.room_number if r.booking and r.booking.room else None,
            guest_name=r.booking.guest.full_name if r.booking and r.booking.guest else "",
            outstanding=max(Decimal(0), r.total_amount - r.collected_amount),
        )
        for r in bike_returns_q
    ]

    active_bike_count = (
        db.query(func.count(BikeRentalModel.id))
        .filter(BikeRentalModel.status == BikeRentalStatus.ACTIVE)
        .scalar()
    ) or 0

    return DailyReport(
        date=target,
        arrivals=[_row(b) for b in arrivals],
        departures=[_row(b) for b in departures],
        in_house=[_row(b) for b in in_house],
        tomorrow_arrivals=[_to_summary_row(b) for b in tomorrow_arrivals],
        revenue=RevenueSummary(
            total_booked=total_booked,
            total_collected=total_collected,
            outstanding=total_booked - total_collected,
        ),
        housekeeping=hk,
        bike_returns_today=bike_returns_today,
        active_bike_count=active_bike_count,
    )
