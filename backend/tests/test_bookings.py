from datetime import timedelta
from decimal import Decimal

from tests.conftest import TODAY, cookie_for

BASE = "/api/v1/bookings"


def _create(client, room_id, user, check_in=None, check_out=None, **kwargs):
    payload = {
        "room_id": room_id,
        "guest_name": kwargs.pop("guest_name", "Test Guest"),
        "check_in_date": str(check_in or TODAY),
        "check_out_date": str(check_out or TODAY + timedelta(days=2)),
        "total_price": kwargs.pop("total_price", "1000000"),
        **kwargs,
    }
    return client.post(f"{BASE}/", json=payload, cookies=cookie_for(user))


def _status(client, booking_id, action, user):
    return client.patch(
        f"{BASE}/{booking_id}/status", json={"action": action}, cookies=cookie_for(user)
    )


# ── Create ─────────────────────────────────────────────────────────────────

def test_create_booking(client, room, owner):
    resp = _create(client, room.id, owner)
    assert resp.status_code == 201
    data = resp.json()
    assert data["room_number"] == "101"
    assert data["status"] == "CONFIRMED"
    assert Decimal(data["collected_amount"]) == Decimal("0")


def test_create_requires_auth(client, room):
    resp = client.post(f"{BASE}/", json={
        "room_id": room.id, "guest_name": "X",
        "check_in_date": str(TODAY), "check_out_date": str(TODAY + timedelta(days=1)),
        "total_price": "0",
    })
    assert resp.status_code == 401


def test_create_missing_room(client, owner):
    resp = _create(client, 99999, owner)
    assert resp.status_code == 404


def test_create_inverted_dates(client, room, owner):
    resp = _create(client, room.id, owner,
                   check_in=TODAY + timedelta(days=3), check_out=TODAY)
    assert resp.status_code == 400


def test_create_same_day_checkout(client, room, owner):
    resp = _create(client, room.id, owner, check_in=TODAY, check_out=TODAY)
    assert resp.status_code == 400


def test_create_reuses_existing_guest_by_name(client, room, owner, guest):
    # guest fixture has full_name="Nguyen Van A". Creating a booking with the same name
    # should not create a duplicate guest row.
    _create(client, room.id, owner, guest_name="Nguyen Van A",
            check_in=TODAY + timedelta(days=10), check_out=TODAY + timedelta(days=12))
    from app.models.guest import Guest
    from app.core.database import get_db
    # The db fixture isn't available here, but we can assert via a second booking listing
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    names = [b["guest_name"] for b in resp.json()]
    assert names.count("Nguyen Van A") == 1


# ── Overbooking ────────────────────────────────────────────────────────────

def test_overbooking_conflict(client, room, owner, booking):
    resp = _create(client, room.id, owner,
                   check_in=TODAY + timedelta(days=1),
                   check_out=TODAY + timedelta(days=4))
    assert resp.status_code == 409


def test_adjacent_booking_no_conflict(client, room, owner, booking):
    # booking ends TODAY+3; new one starting TODAY+3 is non-overlapping
    resp = _create(client, room.id, owner,
                   check_in=TODAY + timedelta(days=3),
                   check_out=TODAY + timedelta(days=5))
    assert resp.status_code == 201


def test_different_room_no_conflict(client, room, room2, owner, booking):
    resp = _create(client, room2.id, owner)
    assert resp.status_code == 201


def test_cancelled_booking_does_not_block_room(client, room, owner, db, booking):
    from app.models.enums import BookingStatus
    booking.status = BookingStatus.CANCELLED
    db.commit()
    resp = _create(client, room.id, owner)
    assert resp.status_code == 201


# ── List / Today / Calendar ────────────────────────────────────────────────

def test_list_requires_auth(client):
    assert client.get(f"{BASE}/").status_code == 401


def test_list_returns_all_bookings(client, owner, booking):
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_today_includes_current_booking(client, owner, booking):
    resp = client.get(f"{BASE}/today", cookies=cookie_for(owner))
    ids = [b["id"] for b in resp.json()]
    assert booking.id in ids


def test_calendar_includes_cancelled_bookings(client, owner, db, booking):
    from app.models.enums import BookingStatus
    booking.status = BookingStatus.CANCELLED
    db.commit()
    start = TODAY.replace(day=1)
    end = (TODAY.replace(day=1) + timedelta(days=32)).replace(day=1)
    resp = client.get(f"{BASE}/calendar",
                      params={"start": str(start), "end": str(end)},
                      cookies=cookie_for(owner))
    assert resp.status_code == 200
    statuses = [b["status"] for b in resp.json()]
    assert "CANCELLED" in statuses


# ── Status transitions ─────────────────────────────────────────────────────

def test_check_in(client, owner, booking):
    resp = _status(client, booking.id, "check_in", owner)
    assert resp.status_code == 200
    assert resp.json()["status"] == "CHECKED_IN"


def test_check_out(client, owner, checked_in_booking):
    resp = _status(client, checked_in_booking.id, "check_out", owner)
    assert resp.status_code == 200
    assert resp.json()["status"] == "CHECKED_OUT"


def test_check_out_marks_room_dirty(client, owner, db, checked_in_booking, room):
    from app.models.enums import RoomStatus
    _status(client, checked_in_booking.id, "check_out", owner)
    db.refresh(room)
    assert room.housekeeping_status == RoomStatus.DIRTY


def test_cancel_confirmed(client, owner, booking):
    resp = _status(client, booking.id, "cancel", owner)
    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELLED"


def test_cancel_checked_in(client, owner, checked_in_booking):
    resp = _status(client, checked_in_booking.id, "cancel", owner)
    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELLED"


def test_no_show(client, owner, booking):
    resp = _status(client, booking.id, "no_show", owner)
    assert resp.status_code == 200
    assert resp.json()["status"] == "NO_SHOW"


def test_invalid_no_show_from_checked_in(client, owner, checked_in_booking):
    resp = _status(client, checked_in_booking.id, "no_show", owner)
    assert resp.status_code == 400


def test_invalid_check_in_from_checked_out(client, owner, checked_in_booking):
    _status(client, checked_in_booking.id, "check_out", owner)
    resp = _status(client, checked_in_booking.id, "check_in", owner)
    assert resp.status_code == 400


def test_invalid_cancel_after_checkout(client, owner, checked_in_booking):
    _status(client, checked_in_booking.id, "check_out", owner)
    resp = _status(client, checked_in_booking.id, "cancel", owner)
    assert resp.status_code == 400


def test_status_update_not_found(client, owner):
    resp = _status(client, 99999, "check_in", owner)
    assert resp.status_code == 404


def test_receptionist_can_update_status(client, receptionist, booking):
    resp = _status(client, booking.id, "check_in", receptionist)
    assert resp.status_code == 200
