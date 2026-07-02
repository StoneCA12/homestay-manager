from datetime import timedelta
from decimal import Decimal

from tests.conftest import TODAY, cookie_for

BASE = "/api/v1/xe-may"


def _make_bike(db, daily_rate="100000", name="Wave Alpha"):
    from app.models.bike import Bike
    bike = Bike(name=name, daily_rate=Decimal(daily_rate))
    db.add(bike)
    db.commit()
    db.refresh(bike)
    return bike


def _create_rental(client, user, bike_id, booking_id, start=None, end=None):
    return client.post(f"{BASE}/rentals", json={
        "bike_id": bike_id,
        "booking_id": booking_id,
        "start_date": str(start or TODAY),
        "end_date": str(end or TODAY + timedelta(days=2)),
    }, cookies=cookie_for(user))


def test_create_rental_adds_cost_to_booking_total_price(client, db, owner, booking):
    original_total = booking.total_price
    bike = _make_bike(db, daily_rate="100000")
    resp = _create_rental(client, owner, bike.id, booking.id, start=TODAY, end=TODAY + timedelta(days=2))
    assert resp.status_code == 201
    assert resp.json()["total_amount"] == "200000.00"
    db.refresh(booking)
    assert booking.total_price == original_total + Decimal("200000")


def test_update_rental_dates_adjusts_booking_total_price(client, db, owner, booking):
    bike = _make_bike(db, daily_rate="100000")
    rental_id = _create_rental(client, owner, bike.id, booking.id, start=TODAY, end=TODAY + timedelta(days=2)).json()["id"]
    db.refresh(booking)
    total_after_create = booking.total_price

    resp = client.patch(f"{BASE}/rentals/{rental_id}", json={
        "end_date": str(TODAY + timedelta(days=4)),
    }, cookies=cookie_for(owner))
    assert resp.status_code == 200
    assert resp.json()["total_amount"] == "400000.00"
    db.refresh(booking)
    assert booking.total_price == total_after_create + Decimal("200000")


def test_cancel_rental_subtracts_cost_from_booking_total_price(client, db, owner, booking):
    original_total = booking.total_price
    bike = _make_bike(db, daily_rate="100000")
    rental_id = _create_rental(client, owner, bike.id, booking.id, start=TODAY, end=TODAY + timedelta(days=2)).json()["id"]

    resp = client.delete(f"{BASE}/rentals/{rental_id}", cookies=cookie_for(owner))
    assert resp.status_code == 204
    db.refresh(booking)
    assert booking.total_price == original_total


def test_cancel_rental_reverses_collected_payment(client, db, owner, booking):
    bike = _make_bike(db, daily_rate="100000")
    rental_id = _create_rental(client, owner, bike.id, booking.id, start=TODAY, end=TODAY + timedelta(days=2)).json()["id"]
    db.refresh(booking)
    total_after_create = booking.total_price

    pay_resp = client.post(f"{BASE}/rentals/{rental_id}/payments", json={
        "amount": "200000", "method": "CASH",
    }, cookies=cookie_for(owner))
    assert pay_resp.status_code == 201
    assert pay_resp.json()["collected_amount"] == "200000.00"

    resp = client.delete(f"{BASE}/rentals/{rental_id}", cookies=cookie_for(owner))
    assert resp.status_code == 204

    db.refresh(booking)
    assert booking.total_price == total_after_create - Decimal("200000")

    from app.models.bike_rental import BikeRental
    rental = db.get(BikeRental, rental_id)
    assert rental.collected_amount == Decimal("0")
    assert rental.status.value == "CANCELLED"


def test_booking_cancel_auto_cancels_bike_rentals_and_adjusts_total_price(client, db, owner, booking):
    bike = _make_bike(db, daily_rate="100000")
    rental_id = _create_rental(client, owner, bike.id, booking.id, start=TODAY, end=TODAY + timedelta(days=2)).json()["id"]
    db.refresh(booking)
    total_after_create = booking.total_price

    client.post(f"{BASE}/rentals/{rental_id}/payments", json={
        "amount": "150000", "method": "CASH",
    }, cookies=cookie_for(owner))

    resp = client.patch(
        f"/api/v1/bookings/{booking.id}/status",
        json={"action": "cancel"},
        cookies=cookie_for(owner),
    )
    assert resp.status_code == 200

    db.refresh(booking)
    assert booking.total_price == total_after_create - Decimal("200000")

    from app.models.bike_rental import BikeRental
    rental = db.get(BikeRental, rental_id)
    assert rental.status.value == "CANCELLED"
    assert rental.collected_amount == Decimal("0")


def test_bike_payment_does_not_double_add_to_booking_total_price(client, db, owner, booking):
    bike = _make_bike(db, daily_rate="100000")
    rental_id = _create_rental(client, owner, bike.id, booking.id, start=TODAY, end=TODAY + timedelta(days=2)).json()["id"]
    db.refresh(booking)
    total_after_create = booking.total_price

    client.post(f"{BASE}/rentals/{rental_id}/payments", json={
        "amount": "200000", "method": "CASH",
    }, cookies=cookie_for(owner))

    db.refresh(booking)
    assert booking.total_price == total_after_create


def test_receptionist_can_create_rental(client, db, receptionist, booking):
    bike = _make_bike(db, daily_rate="100000")
    resp = _create_rental(client, receptionist, bike.id, booking.id, start=TODAY, end=TODAY + timedelta(days=2))
    assert resp.status_code == 201


# ── Early return with partial refund ────────────────────────────────────────

def test_return_early_recomputes_cost_and_refunds_overpayment(client, db, owner, booking):
    bike = _make_bike(db, daily_rate="100000")
    start = TODAY - timedelta(days=2)
    end = TODAY + timedelta(days=3)
    rental_resp = _create_rental(client, owner, bike.id, booking.id, start=start, end=end)
    rental_id = rental_resp.json()["id"]
    assert rental_resp.json()["total_amount"] == "500000.00"  # 5 booked days
    db.refresh(booking)
    total_after_create = booking.total_price

    client.post(f"{BASE}/rentals/{rental_id}/payments", json={
        "amount": "500000", "method": "CASH",
    }, cookies=cookie_for(owner))

    resp = client.patch(f"{BASE}/rentals/{rental_id}/return", cookies=cookie_for(owner))
    assert resp.status_code == 200
    data = resp.json()
    assert data["num_days"] == 2  # today - start_date
    assert data["total_amount"] == "200000.00"
    assert data["collected_amount"] == "200000.00"
    assert data["status"] == "RETURNED"
    refund_entries = [p for p in data["payments"] if Decimal(p["amount"]) < 0]
    assert len(refund_entries) == 1
    assert Decimal(refund_entries[0]["amount"]) == Decimal("-300000")

    db.refresh(booking)
    assert booking.total_price == total_after_create - Decimal("300000")


def test_return_on_or_after_end_date_does_not_recompute(client, db, owner, booking):
    bike = _make_bike(db, daily_rate="100000")
    rental_resp = _create_rental(client, owner, bike.id, booking.id, start=TODAY, end=TODAY)
    rental_id = rental_resp.json()["id"]
    db.refresh(booking)
    total_after_create = booking.total_price

    resp = client.patch(f"{BASE}/rentals/{rental_id}/return", cookies=cookie_for(owner))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_amount"] == rental_resp.json()["total_amount"]
    db.refresh(booking)
    assert booking.total_price == total_after_create


def test_return_early_with_no_prior_payment_needs_no_refund(client, db, owner, booking):
    bike = _make_bike(db, daily_rate="100000")
    start = TODAY - timedelta(days=1)
    end = TODAY + timedelta(days=5)
    rental_id = _create_rental(client, owner, bike.id, booking.id, start=start, end=end).json()["id"]

    resp = client.patch(f"{BASE}/rentals/{rental_id}/return", cookies=cookie_for(owner))
    assert resp.status_code == 200
    data = resp.json()
    assert data["collected_amount"] == "0.00"
    assert data["payments"] == []
