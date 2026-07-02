from tests.conftest import cookie_for

BASE = "/api/v1/reports"


def test_owner_can_view_end_of_day(client, owner):
    resp = client.get(f"{BASE}/end-of-day", cookies=cookie_for(owner))
    assert resp.status_code == 200


def test_admin_can_view_end_of_day(client, admin):
    resp = client.get(f"{BASE}/end-of-day", cookies=cookie_for(admin))
    assert resp.status_code == 200


def test_receptionist_cannot_view_end_of_day(client, receptionist):
    resp = client.get(f"{BASE}/end-of-day", cookies=cookie_for(receptionist))
    assert resp.status_code == 403


def test_view_end_of_day_requires_auth(client):
    resp = client.get(f"{BASE}/end-of-day")
    assert resp.status_code == 401


def test_receptionist_cannot_generate_end_of_day(client, receptionist):
    resp = client.post(f"{BASE}/end-of-day/generate", cookies=cookie_for(receptionist))
    assert resp.status_code == 403


def test_owner_can_generate_end_of_day(client, owner):
    resp = client.post(f"{BASE}/end-of-day/generate", cookies=cookie_for(owner))
    assert resp.status_code == 200
