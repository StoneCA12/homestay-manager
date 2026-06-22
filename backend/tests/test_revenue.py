from datetime import timedelta
from decimal import Decimal

from tests.conftest import TODAY, cookie_for

BASE = "/api/v1/revenue"


# ── /revenue/summary ───────────────────────────────────────────────────────

def test_summary_requires_auth(client):
    assert client.get(f"{BASE}/summary").status_code == 401


def test_summary_receptionist_forbidden(client, receptionist):
    assert client.get(f"{BASE}/summary", cookies=cookie_for(receptionist)).status_code == 403


def test_summary_accessible_by_owner(client, owner):
    resp = client.get(f"{BASE}/summary", cookies=cookie_for(owner))
    assert resp.status_code == 200


def test_summary_accessible_by_admin(client, admin):
    resp = client.get(f"{BASE}/summary", cookies=cookie_for(admin))
    assert resp.status_code == 200


def test_summary_empty_returns_zeros(client, owner):
    resp = client.get(f"{BASE}/summary", cookies=cookie_for(owner))
    data = resp.json()
    assert data["total_bookings"] == 0
    assert Decimal(data["total_revenue"]) == Decimal("0")
    assert Decimal(data["total_collected"]) == Decimal("0")
    assert Decimal(data["outstanding"]) == Decimal("0")
    bpm = data["by_payment_method"]
    assert Decimal(bpm["cash"]) == Decimal("0")
    assert Decimal(bpm["bank_transfer"]) == Decimal("0")
    assert Decimal(bpm["ota_collected"]) == Decimal("0")
    assert Decimal(bpm["total"]) == Decimal("0")


def test_summary_counts_confirmed_booking(client, owner, booking):
    resp = client.get(f"{BASE}/summary", params={
        "start_date": str(TODAY),
        "end_date": str(TODAY + timedelta(days=5)),
    }, cookies=cookie_for(owner))
    data = resp.json()
    assert data["total_bookings"] == 1
    assert Decimal(data["total_revenue"]) == Decimal("3000000")
    assert Decimal(data["total_collected"]) == Decimal("0")
    assert Decimal(data["outstanding"]) == Decimal("3000000")


def test_summary_reflects_payments(client, owner, booking):
    client.post(f"/api/v1/bookings/{booking.id}/payments",
                json={"amount": "1000000", "method": "CASH"}, cookies=cookie_for(owner))
    resp = client.get(f"{BASE}/summary", params={
        "start_date": str(TODAY), "end_date": str(TODAY + timedelta(days=5)),
    }, cookies=cookie_for(owner))
    data = resp.json()
    assert Decimal(data["total_collected"]) == Decimal("1000000")
    assert Decimal(data["outstanding"]) == Decimal("2000000")


def test_summary_payment_method_breakdown(client, owner, booking):
    client.post(f"/api/v1/bookings/{booking.id}/payments",
                json={"amount": "1000000", "method": "CASH"}, cookies=cookie_for(owner))
    client.post(f"/api/v1/bookings/{booking.id}/payments",
                json={"amount": "500000", "method": "BANK_TRANSFER"}, cookies=cookie_for(owner))
    client.post(f"/api/v1/bookings/{booking.id}/payments",
                json={"amount": "200000", "method": "OTA_COLLECTED"}, cookies=cookie_for(owner))
    resp = client.get(f"{BASE}/summary", params={
        "start_date": str(TODAY), "end_date": str(TODAY + timedelta(days=5)),
    }, cookies=cookie_for(owner))
    bpm = resp.json()["by_payment_method"]
    assert Decimal(bpm["cash"]) == Decimal("1000000")
    assert Decimal(bpm["bank_transfer"]) == Decimal("500000")
    assert Decimal(bpm["ota_collected"]) == Decimal("200000")
    assert Decimal(bpm["total"]) == Decimal("1700000")


def test_summary_date_range_excludes_old_bookings(client, owner, db, booking):
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource
    from app.models.guest import Guest
    g = Guest(full_name="Old Guest")
    db.add(g); db.flush()
    old_ci = TODAY - timedelta(days=60)
    old_booking = Booking(
        room_id=booking.room_id,
        guest_id=g.id,
        check_in_date=old_ci,
        check_out_date=old_ci + timedelta(days=2),
        ota_source=OTASource.DIRECT,
        total_price=Decimal("1000000"),
        status=BookingStatus.CONFIRMED,
    )
    db.add(old_booking); db.commit()

    resp = client.get(f"{BASE}/summary", params={
        "start_date": str(TODAY),
        "end_date": str(TODAY + timedelta(days=30)),
    }, cookies=cookie_for(owner))
    assert resp.json()["total_bookings"] == 1  # only the current-period booking


def test_summary_invalid_date_range(client, owner):
    resp = client.get(f"{BASE}/summary", params={
        "start_date": str(TODAY + timedelta(days=5)),
        "end_date": str(TODAY),
    }, cookies=cookie_for(owner))
    assert resp.status_code == 400


def test_summary_by_source_breakdown(client, owner, db, room, guest):
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource
    b = Booking(
        room_id=room.id, guest_id=guest.id,
        check_in_date=TODAY, check_out_date=TODAY + timedelta(days=2),
        ota_source=OTASource.AGODA,
        total_price=Decimal("2000000"),
        status=BookingStatus.CONFIRMED,
        created_by_id=owner.id,
    )
    db.add(b); db.commit()
    resp = client.get(f"{BASE}/summary", params={
        "start_date": str(TODAY), "end_date": str(TODAY + timedelta(days=5)),
    }, cookies=cookie_for(owner))
    by_source = {s["source"]: s for s in resp.json()["by_source"]}
    assert "AGODA" in by_source
    assert Decimal(by_source["AGODA"]["commission_rate"]) == Decimal("0.18")


# ── /revenue/daily ─────────────────────────────────────────────────────────

def test_daily_requires_auth(client):
    assert client.get(f"{BASE}/daily").status_code == 401


def test_daily_receptionist_forbidden(client, receptionist):
    assert client.get(f"{BASE}/daily", cookies=cookie_for(receptionist)).status_code == 403


def test_daily_accessible_by_admin(client, admin):
    assert client.get(f"{BASE}/daily", cookies=cookie_for(admin)).status_code == 200


def test_daily_structure(client, owner):
    resp = client.get(f"{BASE}/daily", cookies=cookie_for(owner))
    data = resp.json()
    assert "date" in data
    assert "active_bookings" in data
    assert "total_booked" in data
    assert "total_collected" in data
    assert "outstanding" in data


def test_daily_counts_todays_bookings(client, owner, booking):
    resp = client.get(f"{BASE}/daily", cookies=cookie_for(owner))
    data = resp.json()
    assert data["active_bookings"] >= 1
    assert Decimal(data["total_booked"]) >= Decimal("3000000")


# ── /revenue/daily-report ──────────────────────────────────────────────────

def test_daily_report_requires_auth(client):
    assert client.get(f"{BASE}/daily-report").status_code == 401


def test_daily_report_accessible_by_receptionist(client, receptionist):
    assert client.get(f"{BASE}/daily-report", cookies=cookie_for(receptionist)).status_code == 200


def test_daily_report_structure(client, owner):
    resp = client.get(f"{BASE}/daily-report", cookies=cookie_for(owner))
    data = resp.json()
    for key in ("date", "arrivals", "departures", "in_house", "tomorrow_arrivals", "revenue", "housekeeping"):
        assert key in data, f"Missing key: {key}"


def test_daily_report_arrivals(client, owner, booking):
    resp = client.get(f"{BASE}/daily-report",
                      params={"report_date": str(TODAY)},
                      cookies=cookie_for(owner))
    arrival_ids = [a["id"] for a in resp.json()["arrivals"]]
    assert booking.id in arrival_ids


def test_daily_report_departures(client, owner, db, room, guest):
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource
    yesterday = TODAY - timedelta(days=1)
    b = Booking(
        room_id=room.id, guest_id=guest.id,
        check_in_date=yesterday, check_out_date=TODAY,
        ota_source=OTASource.DIRECT,
        total_price=Decimal("1000000"),
        status=BookingStatus.CHECKED_IN,
        created_by_id=owner.id,
    )
    db.add(b); db.commit()
    resp = client.get(f"{BASE}/daily-report",
                      params={"report_date": str(TODAY)},
                      cookies=cookie_for(owner))
    departure_ids = [d["id"] for d in resp.json()["departures"]]
    assert b.id in departure_ids


def test_daily_report_in_house(client, owner, db, room, guest):
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource
    yesterday = TODAY - timedelta(days=1)
    tomorrow = TODAY + timedelta(days=1)
    b = Booking(
        room_id=room.id, guest_id=guest.id,
        check_in_date=yesterday, check_out_date=tomorrow,
        ota_source=OTASource.DIRECT,
        total_price=Decimal("2000000"),
        status=BookingStatus.CHECKED_IN,
        created_by_id=owner.id,
    )
    db.add(b); db.commit()
    resp = client.get(f"{BASE}/daily-report",
                      params={"report_date": str(TODAY)},
                      cookies=cookie_for(owner))
    in_house_ids = [r["id"] for r in resp.json()["in_house"]]
    assert b.id in in_house_ids


def test_daily_report_tomorrow_arrivals(client, owner, db, room, guest):
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource
    tomorrow = TODAY + timedelta(days=1)
    b = Booking(
        room_id=room.id, guest_id=guest.id,
        check_in_date=tomorrow, check_out_date=tomorrow + timedelta(days=2),
        ota_source=OTASource.DIRECT,
        total_price=Decimal("2000000"),
        status=BookingStatus.CONFIRMED,
        created_by_id=owner.id,
    )
    db.add(b); db.commit()
    resp = client.get(f"{BASE}/daily-report",
                      params={"report_date": str(TODAY)},
                      cookies=cookie_for(owner))
    tomorrow_ids = [r["id"] for r in resp.json()["tomorrow_arrivals"]]
    assert b.id in tomorrow_ids


def test_daily_report_housekeeping_counts(client, owner, db, room):
    from app.models.enums import RoomStatus
    from app.models.room import Room
    # Add a second dirty room
    r2 = Room(room_number="201", room_type="SINGLE", floor=2, capacity=1,
               base_price=Decimal("500000"), housekeeping_status=RoomStatus.DIRTY)
    db.add(r2); db.commit()
    resp = client.get(f"{BASE}/daily-report", cookies=cookie_for(owner))
    hk = resp.json()["housekeeping"]
    assert hk["dirty"] >= 1
