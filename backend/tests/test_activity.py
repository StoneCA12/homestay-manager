from tests.conftest import cookie_for

BASE = "/api/v1/activity"
BOOKINGS_BASE = "/api/v1/bookings"


def test_owner_can_view_activity(client, owner):
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.status_code == 200


def test_admin_cannot_view_activity(client, admin):
    resp = client.get(f"{BASE}/", cookies=cookie_for(admin))
    assert resp.status_code == 403


def test_receptionist_cannot_view_activity(client, receptionist):
    resp = client.get(f"{BASE}/", cookies=cookie_for(receptionist))
    assert resp.status_code == 403


def test_activity_requires_auth(client):
    resp = client.get(f"{BASE}/")
    assert resp.status_code == 401


def test_checkin_activity_log_includes_guest_name(client, owner, booking, guest):
    resp = client.patch(
        f"{BOOKINGS_BASE}/{booking.id}/status",
        json={"action": "check_in"},
        cookies=cookie_for(owner),
    )
    assert resp.status_code == 200

    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.status_code == 200
    items = resp.json()
    checkin_entry = next(i for i in items if i["event_type"] == "CHECKED_IN")
    assert checkin_entry["guest_name"] == guest.full_name
