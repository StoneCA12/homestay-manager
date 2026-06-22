from datetime import timedelta
from decimal import Decimal

from tests.conftest import TODAY, cookie_for

BASE = "/api/v1/rooms"


# ── List rooms ─────────────────────────────────────────────────────────────

def test_list_requires_auth(client):
    assert client.get(f"{BASE}/").status_code == 401


def test_list_empty(client, owner):
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_returns_rooms(client, owner, room):
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["room_number"] == "101"


def test_list_room_fields(client, owner, room):
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    r = resp.json()[0]
    assert r["id"] == room.id
    assert r["room_type"] == "DOUBLE"
    assert r["floor"] == 1
    assert r["capacity"] == 2
    assert Decimal(r["base_price"]) == Decimal("1000000")
    assert "display_status" in r
    assert "housekeeping_status" in r


# ── Display status ─────────────────────────────────────────────────────────

def test_display_status_available(client, owner, room):
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.json()[0]["display_status"] == "AVAILABLE"


def test_display_status_dirty(client, owner, db, room):
    from app.models.enums import RoomStatus
    room.housekeeping_status = RoomStatus.DIRTY
    db.commit()
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.json()[0]["display_status"] == "DIRTY"


def test_display_status_cleaning(client, owner, db, room):
    from app.models.enums import RoomStatus
    room.housekeeping_status = RoomStatus.CLEANING
    db.commit()
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.json()[0]["display_status"] == "CLEANING"


def test_display_status_out_of_order(client, owner, db, room):
    from app.models.enums import RoomStatus
    room.housekeeping_status = RoomStatus.OUT_OF_ORDER
    db.commit()
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.json()[0]["display_status"] == "OUT_OF_ORDER"


def test_display_status_arrival_today(client, owner, db, room, guest):
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource
    b = Booking(
        room_id=room.id, guest_id=guest.id,
        check_in_date=TODAY, check_out_date=TODAY + timedelta(days=2),
        ota_source=OTASource.DIRECT,
        total_price=Decimal("1000000"),
        status=BookingStatus.CONFIRMED,
        created_by_id=owner.id,
    )
    db.add(b); db.commit()
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    r = resp.json()[0]
    assert r["display_status"] == "ARRIVAL_TODAY"
    assert r["guest_name"] == "Nguyen Van A"
    assert r["check_out_date"] == str(TODAY + timedelta(days=2))


def test_display_status_checkout_today(client, owner, db, room, guest):
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource
    b = Booking(
        room_id=room.id, guest_id=guest.id,
        check_in_date=TODAY - timedelta(days=2), check_out_date=TODAY,
        ota_source=OTASource.DIRECT,
        total_price=Decimal("2000000"),
        status=BookingStatus.CHECKED_IN,
        created_by_id=owner.id,
    )
    db.add(b); db.commit()
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.json()[0]["display_status"] == "CHECKOUT_TODAY"


def test_display_status_occupied(client, owner, db, room, guest):
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource
    b = Booking(
        room_id=room.id, guest_id=guest.id,
        check_in_date=TODAY - timedelta(days=1), check_out_date=TODAY + timedelta(days=1),
        ota_source=OTASource.DIRECT,
        total_price=Decimal("2000000"),
        status=BookingStatus.CHECKED_IN,
        created_by_id=owner.id,
    )
    db.add(b); db.commit()
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.json()[0]["display_status"] == "OCCUPIED"


def test_dirty_takes_precedence_over_active_booking(client, owner, db, room, guest):
    # Even if a booking is active, DIRTY housekeeping status wins
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource, RoomStatus
    room.housekeeping_status = RoomStatus.DIRTY
    b = Booking(
        room_id=room.id, guest_id=guest.id,
        check_in_date=TODAY, check_out_date=TODAY + timedelta(days=2),
        ota_source=OTASource.DIRECT,
        total_price=Decimal("1000000"),
        status=BookingStatus.CONFIRMED,
        created_by_id=owner.id,
    )
    db.add(b); db.commit()
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.json()[0]["display_status"] == "DIRTY"


def test_receptionist_can_list_rooms(client, receptionist, room):
    resp = client.get(f"{BASE}/", cookies=cookie_for(receptionist))
    assert resp.status_code == 200


# ── Dashboard stats ────────────────────────────────────────────────────────

def test_stats_requires_auth(client):
    assert client.get(f"{BASE}/stats").status_code == 401


def test_stats_empty(client, owner):
    resp = client.get(f"{BASE}/stats", cookies=cookie_for(owner))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rooms"] == 0
    assert data["occupied"] == 0
    assert data["available"] == 0
    assert data["arrivals_today"] == 0
    assert data["checkouts_today"] == 0
    assert data["dirty"] == 0


def test_stats_counts_available(client, owner, room):
    resp = client.get(f"{BASE}/stats", cookies=cookie_for(owner))
    data = resp.json()
    assert data["total_rooms"] == 1
    assert data["available"] == 1
    assert data["dirty"] == 0


def test_stats_counts_dirty(client, owner, db, room):
    from app.models.enums import RoomStatus
    room.housekeeping_status = RoomStatus.DIRTY
    db.commit()
    resp = client.get(f"{BASE}/stats", cookies=cookie_for(owner))
    data = resp.json()
    assert data["dirty"] == 1
    assert data["available"] == 0


def test_stats_counts_arrivals(client, owner, db, room, guest):
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource
    b = Booking(
        room_id=room.id, guest_id=guest.id,
        check_in_date=TODAY, check_out_date=TODAY + timedelta(days=2),
        ota_source=OTASource.DIRECT,
        total_price=Decimal("1000000"),
        status=BookingStatus.CONFIRMED,
        created_by_id=owner.id,
    )
    db.add(b); db.commit()
    resp = client.get(f"{BASE}/stats", cookies=cookie_for(owner))
    assert resp.json()["arrivals_today"] == 1


def test_stats_counts_checkouts(client, owner, db, room, guest):
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource
    b = Booking(
        room_id=room.id, guest_id=guest.id,
        check_in_date=TODAY - timedelta(days=2), check_out_date=TODAY,
        ota_source=OTASource.DIRECT,
        total_price=Decimal("2000000"),
        status=BookingStatus.CHECKED_IN,
        created_by_id=owner.id,
    )
    db.add(b); db.commit()
    resp = client.get(f"{BASE}/stats", cookies=cookie_for(owner))
    assert resp.json()["checkouts_today"] == 1


def test_stats_multiple_rooms(client, owner, room, room2):
    resp = client.get(f"{BASE}/stats", cookies=cookie_for(owner))
    assert resp.json()["total_rooms"] == 2
    assert resp.json()["available"] == 2
