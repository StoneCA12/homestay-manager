"""Run once on startup to populate demo data if the DB is empty."""
from datetime import date, timedelta
from decimal import Decimal

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.booking import Booking
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

        # ── rooms ─────────────────────────────────────────────────────────────
        rooms_data = [
            ("101", RoomType.SINGLE,  1, 1, 350_000,  RoomStatus.AVAILABLE),
            ("102", RoomType.DOUBLE,  1, 2, 500_000,  RoomStatus.AVAILABLE),
            ("103", RoomType.TWIN,    1, 2, 500_000,  RoomStatus.DIRTY),
            ("201", RoomType.DOUBLE,  2, 2, 550_000,  RoomStatus.AVAILABLE),
            ("202", RoomType.TRIPLE,  2, 3, 700_000,  RoomStatus.AVAILABLE),
            ("203", RoomType.SUITE,   2, 4, 1_200_000, RoomStatus.CLEANING),
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

        # ── guests ────────────────────────────────────────────────────────────
        guests_data = [
            ("Nguyen Van An",    "nvanan@gmail.com",       "+84901111111", "Vietnamese"),
            ("Tran Thi Bich",    "tranbich@gmail.com",     "+84912222222", "Vietnamese"),
            ("James Anderson",   "james.a@gmail.com",      "+12125551234", "American"),
            ("Li Wei",           "liwei88@gmail.com",      "+8613011112222","Chinese"),
        ]
        guests = []
        for name, email, phone, nat in guests_data:
            g = Guest(full_name=name, email=email, phone=phone, nationality=nat)
            db.add(g)
            guests.append(g)

        db.flush()  # get IDs before creating bookings

        today = date.today()

        # ── bookings ──────────────────────────────────────────────────────────
        # 101 → occupied (checked in yesterday, leaves in 2 days)
        # 102 → arrival today
        # 103 → checkout today  (+ dirty housekeeping from fixture above)
        # 201 → available (no booking)
        # 202 → upcoming (tomorrow arrival)
        # 203 → cleaning (no active booking)
        bookings = [
            Booking(
                room_id=rooms[0].id, guest_id=guests[0].id,
                check_in_date=today - timedelta(days=1),
                check_out_date=today + timedelta(days=2),
                status=BookingStatus.CHECKED_IN,
                ota_source=OTASource.AGODA,
                total_price=Decimal("1_050_000"), collected_amount=Decimal("1_050_000"),
                booking_ref="AGD-001234",
            ),
            Booking(
                room_id=rooms[1].id, guest_id=guests[1].id,
                check_in_date=today,
                check_out_date=today + timedelta(days=3),
                status=BookingStatus.CONFIRMED,
                ota_source=OTASource.BOOKING_COM,
                total_price=Decimal("1_500_000"), collected_amount=Decimal("0"),
                booking_ref="BKG-005678",
            ),
            Booking(
                room_id=rooms[2].id, guest_id=guests[2].id,
                check_in_date=today - timedelta(days=2),
                check_out_date=today,
                status=BookingStatus.CHECKED_IN,
                ota_source=OTASource.DIRECT,
                total_price=Decimal("1_000_000"), collected_amount=Decimal("1_000_000"),
            ),
            Booking(
                room_id=rooms[4].id, guest_id=guests[3].id,
                check_in_date=today + timedelta(days=1),
                check_out_date=today + timedelta(days=4),
                status=BookingStatus.CONFIRMED,
                ota_source=OTASource.TRAVELOKA,
                total_price=Decimal("2_100_000"), collected_amount=Decimal("0"),
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
