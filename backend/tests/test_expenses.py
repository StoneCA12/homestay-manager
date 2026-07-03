from datetime import timedelta
from decimal import Decimal

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


def test_admin_can_add_all_but_salaries(client, admin):
    for cat in ("CLEANING", "SUPPLIES", "OTHER", "UTILITIES", "MAINTENANCE"):
        resp = _expense(client, admin, category=cat)
        assert resp.status_code == 201, f"{cat}: {resp.json()}"


def test_admin_blocked_from_salaries(client, admin):
    resp = _expense(client, admin, category="SALARIES")
    assert resp.status_code == 403


def test_receptionist_can_add_all_but_salaries(client, receptionist):
    for cat in ("CLEANING", "SUPPLIES", "OTHER", "UTILITIES", "MAINTENANCE"):
        resp = _expense(client, receptionist, category=cat)
        assert resp.status_code == 201, f"{cat}: {resp.json()}"


def test_receptionist_blocked_from_salaries(client, receptionist):
    resp = _expense(client, receptionist, category="SALARIES")
    assert resp.status_code == 403


def test_create_expense_response_shape(client, owner):
    resp = _expense(client, owner, category="SALARIES", amount="5000000")
    data = resp.json()
    assert data["category"] == "SALARIES"
    assert Decimal(data["amount"]) == Decimal("5000000")
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


def test_receptionist_sees_all_but_salaries(client, owner, receptionist):
    _expense(client, owner, category="SALARIES", amount="5000000")
    _expense(client, owner, category="CLEANING", amount="200000")
    _expense(client, owner, category="UTILITIES", amount="150000")
    resp = client.get(f"{BASE}/", cookies=cookie_for(receptionist))
    categories = [e["category"] for e in resp.json()]
    assert "SALARIES" not in categories
    assert "CLEANING" in categories
    assert "UTILITIES" in categories


def test_admin_sees_all_but_salaries(client, owner, admin):
    _expense(client, owner, category="SALARIES", amount="5000000")
    _expense(client, owner, category="CLEANING", amount="200000")
    resp = client.get(f"{BASE}/", cookies=cookie_for(admin))
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


# ── Update ─────────────────────────────────────────────────────────────────

def test_admin_cannot_patch_salary_amount_without_touching_category(client, owner, admin):
    resp = _expense(client, owner, category="SALARIES", amount="5000000")
    expense_id = resp.json()["id"]
    # No `category` field in the payload — this is the exact bypass: omitting
    # category must not let a non-owner slip past the owner-only-category guard.
    resp = client.patch(f"{BASE}/{expense_id}", json={"amount": "9999999"}, cookies=cookie_for(admin))
    assert resp.status_code == 403

    # Confirm the amount was NOT changed server-side.
    check = client.get(f"{BASE}/", cookies=cookie_for(owner))
    updated = next(e for e in check.json() if e["id"] == expense_id)
    assert Decimal(updated["amount"]) == Decimal("5000000")


def test_receptionist_cannot_patch_salary_amount_without_touching_category(client, owner, receptionist):
    resp = _expense(client, owner, category="SALARIES", amount="5000000")
    expense_id = resp.json()["id"]
    resp = client.patch(f"{BASE}/{expense_id}", json={"amount": "1"}, cookies=cookie_for(receptionist))
    assert resp.status_code == 403


def test_admin_cannot_recategorize_salary_expense_away(client, owner, admin):
    resp = _expense(client, owner, category="SALARIES", amount="5000000")
    expense_id = resp.json()["id"]
    resp = client.patch(f"{BASE}/{expense_id}", json={"category": "CLEANING"}, cookies=cookie_for(admin))
    assert resp.status_code == 403


def test_admin_cannot_recategorize_expense_to_salary(client, owner, admin):
    resp = _expense(client, owner, category="CLEANING", amount="100000")
    expense_id = resp.json()["id"]
    resp = client.patch(f"{BASE}/{expense_id}", json={"category": "SALARIES"}, cookies=cookie_for(admin))
    assert resp.status_code == 403


def test_owner_can_patch_salary_expense(client, owner):
    resp = _expense(client, owner, category="SALARIES", amount="5000000")
    expense_id = resp.json()["id"]
    resp = client.patch(f"{BASE}/{expense_id}", json={"amount": "6000000"}, cookies=cookie_for(owner))
    assert resp.status_code == 200
    assert Decimal(resp.json()["amount"]) == Decimal("6000000")


def test_admin_can_patch_non_salary_expense(client, admin):
    resp = _expense(client, admin, category="CLEANING", amount="100000")
    expense_id = resp.json()["id"]
    resp = client.patch(f"{BASE}/{expense_id}", json={"amount": "200000"}, cookies=cookie_for(admin))
    assert resp.status_code == 200


# ── Delete ─────────────────────────────────────────────────────────────────

def test_admin_cannot_delete_salary_expense(client, owner, admin):
    resp = _expense(client, owner, category="SALARIES", amount="5000000")
    expense_id = resp.json()["id"]
    resp = client.delete(f"{BASE}/{expense_id}", cookies=cookie_for(admin))
    assert resp.status_code == 403

    check = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert any(e["id"] == expense_id for e in check.json())


def test_receptionist_cannot_delete_any_expense(client, owner, receptionist):
    resp = _expense(client, owner, category="CLEANING", amount="100000")
    expense_id = resp.json()["id"]
    resp = client.delete(f"{BASE}/{expense_id}", cookies=cookie_for(receptionist))
    assert resp.status_code == 403


def test_owner_can_delete_salary_expense(client, owner):
    resp = _expense(client, owner, category="SALARIES", amount="5000000")
    expense_id = resp.json()["id"]
    resp = client.delete(f"{BASE}/{expense_id}", cookies=cookie_for(owner))
    assert resp.status_code == 204


def test_admin_can_delete_non_salary_expense(client, admin):
    resp = _expense(client, admin, category="CLEANING", amount="100000")
    expense_id = resp.json()["id"]
    resp = client.delete(f"{BASE}/{expense_id}", cookies=cookie_for(admin))
    assert resp.status_code == 204
