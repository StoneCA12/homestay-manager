from datetime import timedelta

from tests.conftest import TODAY, cookie_for

BASE = "/api/v1/expenses"


def _expense(client, user, category="CLEANING", amount="100000", expense_date=None):
    return client.post(f"{BASE}/", json={
        "category": category,
        "amount": amount,
        "expense_date": str(expense_date or TODAY),
    }, cookies=cookie_for(user))


# ── Create ─────────────────────────────────────────────────────────────────

def test_owner_can_add_all_categories(client, owner):
    for cat in ("CLEANING", "SUPPLIES", "OTHER", "UTILITIES", "SALARIES", "MAINTENANCE"):
        resp = _expense(client, owner, category=cat)
        assert resp.status_code == 201, f"{cat}: {resp.json()}"


def test_admin_can_add_all_categories(client, admin):
    for cat in ("CLEANING", "SUPPLIES", "OTHER", "UTILITIES", "SALARIES", "MAINTENANCE"):
        resp = _expense(client, admin, category=cat)
        assert resp.status_code == 201, f"{cat}: {resp.json()}"


def test_receptionist_can_add_allowed_categories(client, receptionist):
    for cat in ("CLEANING", "SUPPLIES", "OTHER"):
        resp = _expense(client, receptionist, category=cat)
        assert resp.status_code == 201, f"{cat}: {resp.json()}"


def test_receptionist_blocked_from_restricted_categories(client, receptionist):
    for cat in ("UTILITIES", "SALARIES", "MAINTENANCE"):
        resp = _expense(client, receptionist, category=cat)
        assert resp.status_code == 403, f"Expected 403 for {cat}, got {resp.status_code}"


def test_create_expense_response_shape(client, owner):
    resp = _expense(client, owner, category="SALARIES", amount="5000000")
    data = resp.json()
    assert data["category"] == "SALARIES"
    assert data["amount"] == "5000000"
    assert data["expense_date"] == str(TODAY)
    assert data["recorded_by_name"] == "Owner User"


def test_expense_amount_must_be_positive(client, owner):
    resp = client.post(f"{BASE}/", json={
        "category": "CLEANING", "amount": "0", "expense_date": str(TODAY),
    }, cookies=cookie_for(owner))
    assert resp.status_code == 422


def test_expense_negative_amount_rejected(client, owner):
    resp = client.post(f"{BASE}/", json={
        "category": "CLEANING", "amount": "-500", "expense_date": str(TODAY),
    }, cookies=cookie_for(owner))
    assert resp.status_code == 422


def test_create_requires_auth(client):
    resp = client.post(f"{BASE}/", json={
        "category": "CLEANING", "amount": "100", "expense_date": str(TODAY),
    })
    assert resp.status_code == 401


# ── List ───────────────────────────────────────────────────────────────────

def test_list_empty(client, owner):
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_returns_created_expenses(client, owner):
    _expense(client, owner, category="SALARIES", amount="5000000")
    _expense(client, owner, category="CLEANING", amount="200000")
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert len(resp.json()) == 2


def test_list_requires_auth(client):
    assert client.get(f"{BASE}/").status_code == 401


def test_receptionist_cannot_see_restricted_categories(client, owner, receptionist):
    _expense(client, owner, category="SALARIES", amount="5000000")
    _expense(client, owner, category="CLEANING", amount="200000")
    resp = client.get(f"{BASE}/", cookies=cookie_for(receptionist))
    categories = [e["category"] for e in resp.json()]
    assert "SALARIES" not in categories
    assert "CLEANING" in categories


def test_list_date_filter_start(client, owner):
    yesterday = TODAY - timedelta(days=1)
    _expense(client, owner, category="CLEANING", expense_date=yesterday)
    _expense(client, owner, category="SUPPLIES", expense_date=TODAY)
    resp = client.get(f"{BASE}/", params={"start_date": str(TODAY)}, cookies=cookie_for(owner))
    data = resp.json()
    assert len(data) == 1
    assert data[0]["category"] == "SUPPLIES"


def test_list_date_filter_end(client, owner):
    tomorrow = TODAY + timedelta(days=1)
    _expense(client, owner, category="CLEANING", expense_date=TODAY)
    _expense(client, owner, category="SUPPLIES", expense_date=tomorrow)
    resp = client.get(f"{BASE}/", params={"end_date": str(TODAY)}, cookies=cookie_for(owner))
    data = resp.json()
    assert len(data) == 1
    assert data[0]["category"] == "CLEANING"


def test_list_date_filter_range(client, owner):
    past = TODAY - timedelta(days=10)
    future = TODAY + timedelta(days=10)
    _expense(client, owner, category="CLEANING", expense_date=past)
    _expense(client, owner, category="SUPPLIES", expense_date=TODAY)
    _expense(client, owner, category="OTHER", expense_date=future)
    resp = client.get(f"{BASE}/", params={
        "start_date": str(TODAY - timedelta(days=1)),
        "end_date": str(TODAY + timedelta(days=1)),
    }, cookies=cookie_for(owner))
    assert len(resp.json()) == 1
    assert resp.json()[0]["category"] == "SUPPLIES"
