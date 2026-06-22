from decimal import Decimal

from tests.conftest import cookie_for

BASE = "/api/v1/bookings"


def _pay(client, booking_id, user, amount="500000", method="CASH", notes=None):
    payload = {"amount": amount, "method": method}
    if notes:
        payload["notes"] = notes
    return client.post(f"{BASE}/{booking_id}/payments", json=payload, cookies=cookie_for(user))


# ── List payments ──────────────────────────────────────────────────────────

def test_list_payments_empty(client, owner, booking):
    resp = client.get(f"{BASE}/{booking.id}/payments", cookies=cookie_for(owner))
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_payments_after_adding(client, owner, booking):
    _pay(client, booking.id, owner, amount="1000000", method="BANK_TRANSFER", notes="partial")
    resp = client.get(f"{BASE}/{booking.id}/payments", cookies=cookie_for(owner))
    payments = resp.json()
    assert len(payments) == 1
    p = payments[0]
    assert p["method"] == "BANK_TRANSFER"
    assert Decimal(p["amount"]) == Decimal("1000000")
    assert p["notes"] == "partial"
    assert p["booking_id"] == booking.id


def test_list_payments_not_found(client, owner):
    resp = client.get(f"{BASE}/99999/payments", cookies=cookie_for(owner))
    assert resp.status_code == 404


def test_list_payments_requires_auth(client, booking):
    assert client.get(f"{BASE}/{booking.id}/payments").status_code == 401


# ── Add payment ────────────────────────────────────────────────────────────

def test_add_payment_updates_collected_amount(client, owner, booking):
    resp = _pay(client, booking.id, owner, amount="1000000")
    assert resp.status_code == 201
    assert Decimal(resp.json()["collected_amount"]) == Decimal("1000000")


def test_add_multiple_payments_accumulate(client, owner, booking):
    _pay(client, booking.id, owner, amount="1000000")
    resp = _pay(client, booking.id, owner, amount="500000")
    assert resp.status_code == 201
    assert Decimal(resp.json()["collected_amount"]) == Decimal("1500000")


def test_add_payment_exact_total(client, owner, booking):
    # total_price = 3_000_000; paying it all at once
    resp = _pay(client, booking.id, owner, amount="3000000")
    assert resp.status_code == 201
    assert Decimal(resp.json()["collected_amount"]) == Decimal("3000000")


def test_all_payment_methods_accepted(client, owner, booking):
    for method, amount in [("CASH", "100000"), ("BANK_TRANSFER", "100000"), ("OTA_COLLECTED", "100000")]:
        resp = _pay(client, booking.id, owner, amount=amount, method=method)
        assert resp.status_code == 201, f"Method {method} failed: {resp.json()}"
    history = client.get(f"{BASE}/{booking.id}/payments", cookies=cookie_for(owner)).json()
    assert len(history) == 3


def test_payment_exceeds_total(client, owner, booking):
    resp = _pay(client, booking.id, owner, amount="4000000")
    assert resp.status_code == 400


def test_payment_second_installment_exceeds_total(client, owner, booking):
    _pay(client, booking.id, owner, amount="2000000")
    resp = _pay(client, booking.id, owner, amount="2000000")  # 2M + 2M > 3M
    assert resp.status_code == 400


def test_payment_not_found(client, owner):
    resp = _pay(client, 99999, owner, amount="100000")
    assert resp.status_code == 404


def test_payment_for_cancelled_booking(client, owner, db, booking):
    from app.models.enums import BookingStatus
    booking.status = BookingStatus.CANCELLED
    db.commit()
    assert _pay(client, booking.id, owner, amount="500000").status_code == 400


def test_payment_for_no_show_booking(client, owner, db, booking):
    from app.models.enums import BookingStatus
    booking.status = BookingStatus.NO_SHOW
    db.commit()
    assert _pay(client, booking.id, owner, amount="500000").status_code == 400


def test_payment_for_checked_out_booking_allowed(client, owner, checked_in_booking):
    # Corrective payments after checkout are permitted
    client.patch(
        f"{BASE}/{checked_in_booking.id}/status",
        json={"action": "check_out"},
        cookies=cookie_for(owner),
    )
    resp = _pay(client, checked_in_booking.id, owner, amount="1000000")
    assert resp.status_code == 201


def test_receptionist_can_add_payment(client, receptionist, booking):
    resp = _pay(client, booking.id, receptionist, amount="500000")
    assert resp.status_code == 201


def test_payment_requires_auth(client, booking):
    assert client.post(f"{BASE}/{booking.id}/payments",
                       json={"amount": "100000", "method": "CASH"}).status_code == 401


def test_recorded_by_name_set(client, owner, booking):
    _pay(client, booking.id, owner, amount="500000")
    history = client.get(f"{BASE}/{booking.id}/payments", cookies=cookie_for(owner)).json()
    assert history[0]["recorded_by_name"] == "Owner User"
