from decimal import Decimal

from tests.conftest import cookie_for

BASE = "/api/v1/settings"


def _seed_rate(db, ota_source="AGODA", rate="0.1500"):
    from app.models.commission_rate import CommissionRate
    r = CommissionRate(ota_source=ota_source, rate=Decimal(rate))
    db.add(r)
    db.commit()
    return r


def test_owner_can_list_commission_rates(client, db, owner):
    _seed_rate(db)
    resp = client.get(f"{BASE}/commission-rates", cookies=cookie_for(owner))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_admin_can_list_commission_rates(client, db, admin):
    _seed_rate(db)
    resp = client.get(f"{BASE}/commission-rates", cookies=cookie_for(admin))
    assert resp.status_code == 200


def test_receptionist_cannot_list_commission_rates(client, db, receptionist):
    _seed_rate(db)
    resp = client.get(f"{BASE}/commission-rates", cookies=cookie_for(receptionist))
    assert resp.status_code == 403


def test_list_commission_rates_requires_auth(client):
    resp = client.get(f"{BASE}/commission-rates")
    assert resp.status_code == 401


def test_receptionist_cannot_update_commission_rate(client, db, receptionist):
    _seed_rate(db)
    resp = client.patch(
        f"{BASE}/commission-rates/AGODA",
        json={"rate": 0.2},
        cookies=cookie_for(receptionist),
    )
    assert resp.status_code == 403


def test_admin_can_update_commission_rate(client, db, admin):
    _seed_rate(db)
    resp = client.patch(
        f"{BASE}/commission-rates/AGODA",
        json={"rate": 0.2},
        cookies=cookie_for(admin),
    )
    assert resp.status_code == 200
    assert Decimal(resp.json()["rate"]) == Decimal("0.2")
