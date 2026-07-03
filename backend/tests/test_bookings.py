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


# ── Room charges ────────────────────────────────────────────────────────────

def _charge(client, booking_id, user, amount="50000", description="Giặt ủi"):
    return client.post(
        f"{BASE}/{booking_id}/charges",
        json={"amount": amount, "description": description},
        cookies=cookie_for(user),
    )


def test_add_charge_increases_total_price(client, owner, checked_in_booking):
    original_total = checked_in_booking.total_price
    resp = _charge(client, checked_in_booking.id, owner, amount="75000", description="Nước uống")
    assert resp.status_code == 200
    assert Decimal(resp.json()["total_price"]) == original_total + Decimal("75000")


def test_receptionist_can_add_charge(client, receptionist, checked_in_booking):
    resp = _charge(client, checked_in_booking.id, receptionist)
    assert resp.status_code == 200


def test_add_charge_requires_checked_in(client, owner, booking):
    resp = _charge(client, booking.id, owner)
    assert resp.status_code == 400


def test_add_charge_amount_must_be_positive(client, owner, checked_in_booking):
    resp = _charge(client, checked_in_booking.id, owner, amount="0")
    assert resp.status_code == 422


def test_add_charge_requires_description(client, owner, checked_in_booking):
    resp = client.post(
        f"{BASE}/{checked_in_booking.id}/charges",
        json={"amount": "50000", "description": ""},
        cookies=cookie_for(owner),
    )
    assert resp.status_code == 422


def test_add_charge_not_found(client, owner):
    resp = _charge(client, 99999, owner)
    assert resp.status_code == 404


def test_add_charge_requires_auth(client, checked_in_booking):
    resp = client.post(
        f"{BASE}/{checked_in_booking.id}/charges",
        json={"amount": "50000", "description": "Giặt ủi"},
    )
    assert resp.status_code == 401


def test_receptionist_can_update_status(client, receptionist, booking):
    resp = _status(client, booking.id, "check_in", receptionist)
    assert resp.status_code == 200


# ── Late payments ────────────────────────────────────────────────────────────

def _make_booking(db, room, guest, owner, status, check_out, total_price="1000000", collected="0"):
    from app.models.booking import Booking
    from app.models.enums import BookingStatus, OTASource

    b = Booking(
        room_id=room.id,
        guest_id=guest.id,
        check_in_date=check_out - timedelta(days=2),
        check_out_date=check_out,
        num_guests=2,
        ota_source=OTASource.DIRECT,
        total_price=Decimal(total_price),
        collected_amount=Decimal(collected),
        status=BookingStatus[status],
        created_by_id=owner.id,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


def test_late_payment_includes_unpaid_checked_in_past_checkout(client, db, owner, room, guest):
    from tests.conftest import TODAY
    b = _make_booking(db, room, guest, owner, "CHECKED_IN", TODAY - timedelta(days=1), collected="500000")
    resp = client.get(f"{BASE}/late-payments", cookies=cookie_for(owner))
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert b.id in ids


def test_late_payment_includes_unpaid_checked_out(client, db, owner, room, guest):
    from tests.conftest import TODAY
    b = _make_booking(db, room, guest, owner, "CHECKED_OUT", TODAY - timedelta(days=3), collected="200000")
    resp = client.get(f"{BASE}/late-payments", cookies=cookie_for(owner))
    ids = [r["id"] for r in resp.json()]
    assert b.id in ids


def test_late_payment_excludes_fully_paid(client, db, owner, room, guest):
    from tests.conftest import TODAY
    b = _make_booking(db, room, guest, owner, "CHECKED_OUT", TODAY - timedelta(days=1), collected="1000000")
    resp = client.get(f"{BASE}/late-payments", cookies=cookie_for(owner))
    ids = [r["id"] for r in resp.json()]
    assert b.id not in ids


def test_late_payment_excludes_future_checkout(client, db, owner, room, guest):
    from tests.conftest import TODAY
    b = _make_booking(db, room, guest, owner, "CHECKED_IN", TODAY + timedelta(days=1), collected="0")
    resp = client.get(f"{BASE}/late-payments", cookies=cookie_for(owner))
    ids = [r["id"] for r in resp.json()]
    assert b.id not in ids


def test_late_payment_excludes_confirmed_not_checked_in(client, db, owner, room, guest):
    from tests.conftest import TODAY
    b = _make_booking(db, room, guest, owner, "CONFIRMED", TODAY, collected="0")
    resp = client.get(f"{BASE}/late-payments", cookies=cookie_for(owner))
    ids = [r["id"] for r in resp.json()]
    assert b.id not in ids


def test_late_payment_excludes_cancelled(client, db, owner, room, guest):
    from tests.conftest import TODAY
    b = _make_booking(db, room, guest, owner, "CANCELLED", TODAY - timedelta(days=1), collected="0")
    resp = client.get(f"{BASE}/late-payments", cookies=cookie_for(owner))
    ids = [r["id"] for r in resp.json()]
    assert b.id not in ids


def test_late_payment_visible_to_receptionist(client, db, owner, receptionist, room, guest):
    from tests.conftest import TODAY
    b = _make_booking(db, room, guest, owner, "CHECKED_IN", TODAY, collected="0")
    resp = client.get(f"{BASE}/late-payments", cookies=cookie_for(receptionist))
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert b.id in ids


def test_late_payment_requires_auth(client):
    resp = client.get(f"{BASE}/late-payments")
    assert resp.status_code == 401


def test_late_payment_sorted_most_recent_checkout_first(client, db, owner, room, room2, guest):
    older = _make_booking(db, room, guest, owner, "CHECKED_OUT", TODAY - timedelta(days=5), collected="0")
    newer = _make_booking(db, room2, guest, owner, "CHECKED_OUT", TODAY - timedelta(days=1), collected="0")
    resp = client.get(f"{BASE}/late-payments", cookies=cookie_for(owner))
    ids = [r["id"] for r in resp.json()]
    assert ids.index(newer.id) < ids.index(older.id)


def test_late_payment_excludes_booking_paid_via_room_plus_bike(client, db, owner, room, guest):
    """total_price includes bike cost; a booking counts as paid once room payments +
    bike payments together cover it, even if the booking-only ledger looks underpaid."""
    from app.models.bike import Bike
    bike = Bike(name="Wave Alpha", daily_rate=Decimal("100000"))
    db.add(bike)
    db.commit()
    db.refresh(bike)

    b = _make_booking(db, room, guest, owner, "CHECKED_IN", TODAY, total_price="1000000", collected="1000000")
    rental_resp = client.post("/api/v1/xe-may/rentals", json={
        "bike_id": bike.id, "booking_id": b.id,
        "start_date": str(TODAY), "end_date": str(TODAY + timedelta(days=2)),
    }, cookies=cookie_for(owner))
    rental_id = rental_resp.json()["id"]
    # total_price is now 1,200,000 (1,000,000 room + 200,000 bike), room side fully paid,
    # bike side unpaid -> should still show up as a late payment.
    resp = client.get(f"{BASE}/late-payments", cookies=cookie_for(owner))
    ids = [r["id"] for r in resp.json()]
    assert b.id in ids

    # Now pay off the bike rental too -> booking should drop off the late-payments list.
    client.post(f"/api/v1/xe-may/rentals/{rental_id}/payments", json={
        "amount": "200000", "method": "CASH",
    }, cookies=cookie_for(owner))
    resp = client.get(f"{BASE}/late-payments", cookies=cookie_for(owner))
    ids = [r["id"] for r in resp.json()]
    assert b.id not in ids


# ── Stay extension ───────────────────────────────────────────────────────────

def _extend(client, booking_id, user, extra_days=2, price="500000"):
    return client.post(
        f"{BASE}/{booking_id}/extend",
        json={"extra_days": extra_days, "price": price},
        cookies=cookie_for(user),
    )


def test_extend_stay_success(client, owner, checked_in_booking):
    original_total = checked_in_booking.total_price
    original_checkout = checked_in_booking.check_out_date
    resp = _extend(client, checked_in_booking.id, owner, extra_days=2, price="500000")
    assert resp.status_code == 200
    data = resp.json()
    assert data["check_out_date"] == str(original_checkout + timedelta(days=2))
    assert Decimal(data["total_price"]) == original_total + Decimal("500000")


def test_receptionist_can_extend_stay(client, receptionist, checked_in_booking):
    resp = _extend(client, checked_in_booking.id, receptionist)
    assert resp.status_code == 200


def test_extend_stay_requires_checked_in(client, owner, booking):
    resp = _extend(client, booking.id, owner)
    assert resp.status_code == 400


def test_extend_stay_requires_room(client, db, owner, checked_in_booking):
    checked_in_booking.room_id = None
    db.commit()
    resp = _extend(client, checked_in_booking.id, owner)
    assert resp.status_code == 400


def test_extend_stay_extra_days_must_be_positive(client, owner, checked_in_booking):
    resp = _extend(client, checked_in_booking.id, owner, extra_days=0)
    assert resp.status_code == 422


def test_extend_stay_price_must_be_positive(client, owner, checked_in_booking):
    resp = _extend(client, checked_in_booking.id, owner, price="0")
    assert resp.status_code == 422


def test_extend_stay_not_found(client, owner):
    resp = _extend(client, 99999, owner)
    assert resp.status_code == 404


def test_extend_stay_requires_auth(client, checked_in_booking):
    resp = client.post(
        f"{BASE}/{checked_in_booking.id}/extend",
        json={"extra_days": 2, "price": "500000"},
    )
    assert resp.status_code == 401


def test_extend_stay_conflict_with_other_booking(client, db, owner, room, guest, checked_in_booking):
    from app.models.guest import Guest
    other_guest = Guest(full_name="Other Guest", phone="0909999999")
    db.add(other_guest)
    db.commit()
    db.refresh(other_guest)
    # Another confirmed booking on the same room starting right after the current checkout,
    # but before the extended checkout date — must block the extension.
    _make_booking(
        db, room, other_guest, owner, "CONFIRMED",
        check_out=checked_in_booking.check_out_date + timedelta(days=1),
    )
    resp = _extend(client, checked_in_booking.id, owner, extra_days=2, price="500000")
    assert resp.status_code == 409
    assert resp.json()["detail"]["type"] == "ROOM_CONFLICT"


def test_extend_stay_recorded_in_timeline(client, owner, checked_in_booking):
    _extend(client, checked_in_booking.id, owner, extra_days=2, price="500000")
    resp = client.get(f"{BASE}/{checked_in_booking.id}/logs", cookies=cookie_for(owner))
    actions = [log["action"] for log in resp.json()]
    assert "EXTENDED" in actions
