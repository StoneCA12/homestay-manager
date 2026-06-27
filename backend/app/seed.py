"""Run once on startup to populate demo data if the DB is empty."""
from datetime import date, timedelta
from decimal import Decimal

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.booking import Booking
from app.models.commission_rate import CommissionRate
from app.models.enums import BookingStatus, OTASource, RoomStatus, RoomType, UserRole
from app.models.guest import Guest
from app.models.room import Room
from app.models.user import User


def seed() -> None:
    db = SessionLocal()
    try:
        if db.query(User).first():
            return  # already seeded

        # ── users ─────────────────────────────────────────────────────────────
        owner = User(
            email="owner@homestay.com",
            hashed_password=hash_password("owner123"),
            full_name="Nguyen Thi Lan",
            role=UserRole.OWNER,
        )
        receptionist = User(
            email="reception@homestay.com",
            hashed_password=hash_password("recep123"),
            full_name="Tran Van Minh",
            role=UserRole.RECEPTIONIST,
        )
        db.add_all([owner, receptionist])

        # ── rooms (19 rooms: 1 family, 5 window, 6 balcony, 7 regular) ────────
        rooms_data = [
            # (room_number, room_type,        floor, capacity, base_price,   hk_status)
            ("101", RoomType.FAMILY,  1, 4, 1_200_000, RoomStatus.AVAILABLE),
            ("102", RoomType.WINDOW,  1, 2,   550_000, RoomStatus.AVAILABLE),
            ("103", RoomType.WINDOW,  1, 2,   550_000, RoomStatus.DIRTY),
            ("104", RoomType.REGULAR, 1, 2,   400_000, RoomStatus.AVAILABLE),
            ("105", RoomType.REGULAR, 1, 2,   400_000, RoomStatus.AVAILABLE),
            ("201", RoomType.BALCONY, 2, 2,   650_000, RoomStatus.AVAILABLE),
            ("202", RoomType.BALCONY, 2, 2,   650_000, RoomStatus.AVAILABLE),
            ("203", RoomType.WINDOW,  2, 2,   550_000, RoomStatus.CLEANING),
            ("204", RoomType.WINDOW,  2, 2,   550_000, RoomStatus.AVAILABLE),
            ("205", RoomType.REGULAR, 2, 2,   400_000, RoomStatus.AVAILABLE),
            ("301", RoomType.BALCONY, 3, 2,   650_000, RoomStatus.AVAILABLE),
            ("302", RoomType.BALCONY, 3, 2,   650_000, RoomStatus.AVAILABLE),
            ("303", RoomType.BALCONY, 3, 2,   650_000, RoomStatus.AVAILABLE),
            ("304", RoomType.WINDOW,  3, 2,   550_000, RoomStatus.AVAILABLE),
            ("305", RoomType.REGULAR, 3, 2,   400_000, RoomStatus.AVAILABLE),
            ("401", RoomType.BALCONY, 4, 2,   650_000, RoomStatus.AVAILABLE),
            ("402", RoomType.BALCONY, 4, 2,   650_000, RoomStatus.AVAILABLE),
            ("403", RoomType.REGULAR, 4, 2,   400_000, RoomStatus.AVAILABLE),
            ("404", RoomType.REGULAR, 4, 2,   400_000, RoomStatus.AVAILABLE),
        ]
        rooms = []
        for num, rtype, floor, cap, price, hk in rooms_data:
            r = Room(
                room_number=num,
                room_type=rtype,
                floor=floor,
                capacity=cap,
                base_price=Decimal(str(price)),
                housekeeping_status=hk,
            )
            db.add(r)
            rooms.append(r)

        # ── commission rates ───────────────────────────────────────────────────
        commission_data = [
            ("AGODA",       Decimal("0.1500")),
            ("BOOKING_COM", Decimal("0.1000")),
            ("TRAVELOKA",   Decimal("0.1200")),
            ("ZALO",        Decimal("0.0000")),
            ("DIRECT",      Decimal("0.0000")),
        ]
        for ota_source, rate in commission_data:
            db.add(CommissionRate(ota_source=ota_source, rate=rate))

        # ── guests ────────────────────────────────────────────────────────────
        guests = []
        for name, phone in [
            ("Nguyen Van An",  "0901111111"),
            ("Tran Thi Bich",  "0912222222"),
            ("Le Minh Duc",    "0923333333"),
            ("Pham Thi Hoa",   "0934444444"),
        ]:
            g = Guest(full_name=name, phone=phone)
            db.add(g)
            guests.append(g)

        db.flush()

        today = date.today()

        # ── bookings ──────────────────────────────────────────────────────────
        bookings = [
            Booking(
                room_id=rooms[0].id, guest_id=guests[0].id,
                check_in_date=today - timedelta(days=1),
                check_out_date=today + timedelta(days=2),
                status=BookingStatus.CHECKED_IN,
                ota_source=OTASource.AGODA,
                total_price=Decimal("3_600_000"), collected_amount=Decimal("3_600_000"),
                booking_ref="AGD-001234",
            ),
            Booking(
                room_id=rooms[1].id, guest_id=guests[1].id,
                check_in_date=today,
                check_out_date=today + timedelta(days=3),
                status=BookingStatus.CONFIRMED,
                ota_source=OTASource.BOOKING_COM,
                total_price=Decimal("1_650_000"), collected_amount=Decimal("0"),
                booking_ref="BKG-005678",
            ),
            # Unassigned booking (room to be assigned at check-in)
            Booking(
                room_id=None, guest_id=guests[2].id,
                check_in_date=today + timedelta(days=1),
                check_out_date=today + timedelta(days=3),
                status=BookingStatus.CONFIRMED,
                ota_source=OTASource.ZALO,
                total_price=Decimal("800_000"), collected_amount=Decimal("0"),
            ),
            Booking(
                room_id=rooms[5].id, guest_id=guests[3].id,
                check_in_date=today + timedelta(days=1),
                check_out_date=today + timedelta(days=4),
                status=BookingStatus.CONFIRMED,
                ota_source=OTASource.TRAVELOKA,
                total_price=Decimal("1_950_000"), collected_amount=Decimal("0"),
                booking_ref="TVL-009012",
            ),
        ]
        db.add_all(bookings)
        db.commit()
        print("[seed] Database seeded with demo data.")
    except Exception as exc:
        db.rollback()
        print(f"[seed] Seeding failed (skipping): {exc}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
