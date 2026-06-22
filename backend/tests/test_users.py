from tests.conftest import cookie_for

BASE = "/api/v1/users"


def _create_user(client, user, email="new@example.com", password="newpass123",
                 full_name="New User", role="RECEPTIONIST"):
    return client.post(f"{BASE}/", json={
        "email": email, "password": password,
        "full_name": full_name, "role": role,
    }, cookies=cookie_for(user))


# ── List users ─────────────────────────────────────────────────────────────

def test_list_requires_auth(client):
    assert client.get(f"{BASE}/").status_code == 401


def test_list_receptionist_forbidden(client, receptionist):
    assert client.get(f"{BASE}/", cookies=cookie_for(receptionist)).status_code == 403


def test_list_owner_can_list(client, owner):
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_list_admin_can_list(client, admin):
    resp = client.get(f"{BASE}/", cookies=cookie_for(admin))
    assert resp.status_code == 200


def test_list_contains_all_users(client, owner, admin, receptionist):
    resp = client.get(f"{BASE}/", cookies=cookie_for(owner))
    emails = [u["email"] for u in resp.json()]
    assert "owner@example.com" in emails
    assert "admin@example.com" in emails
    assert "recep@example.com" in emails


# ── Create user ────────────────────────────────────────────────────────────

def test_create_requires_auth(client):
    assert client.post(f"{BASE}/", json={
        "email": "x@x.com", "password": "pw", "full_name": "X", "role": "RECEPTIONIST",
    }).status_code == 401


def test_owner_can_create_user(client, owner):
    resp = _create_user(client, owner)
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "new@example.com"
    assert data["role"] == "RECEPTIONIST"
    assert data["is_active"] is True


def test_create_any_role(client, owner):
    for role in ("OWNER", "ADMIN", "RECEPTIONIST"):
        resp = _create_user(client, owner,
                            email=f"{role.lower()}2@example.com", role=role)
        assert resp.status_code == 201, f"Role {role}: {resp.json()}"
        assert resp.json()["role"] == role


def test_admin_cannot_create_user(client, admin):
    assert _create_user(client, admin).status_code == 403


def test_receptionist_cannot_create_user(client, receptionist):
    assert _create_user(client, receptionist).status_code == 403


def test_create_duplicate_email(client, owner):
    _create_user(client, owner)
    resp = _create_user(client, owner)  # same email again
    assert resp.status_code == 409


def test_create_response_omits_password(client, owner):
    resp = _create_user(client, owner)
    assert "password" not in resp.json()
    assert "hashed_password" not in resp.json()


# ── Deactivate / reactivate ────────────────────────────────────────────────

def test_deactivate_requires_auth(client, receptionist):
    assert client.patch(f"{BASE}/{receptionist.id}/deactivate").status_code == 401


def test_deactivate_admin_forbidden(client, admin, receptionist):
    assert client.patch(f"{BASE}/{receptionist.id}/deactivate",
                        cookies=cookie_for(admin)).status_code == 403


def test_deactivate_receptionist_forbidden(client, receptionist, owner):
    assert client.patch(f"{BASE}/{owner.id}/deactivate",
                        cookies=cookie_for(receptionist)).status_code == 403


def test_owner_can_deactivate_other_user(client, owner, receptionist):
    resp = client.patch(f"{BASE}/{receptionist.id}/deactivate", cookies=cookie_for(owner))
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_deactivate_toggles_back_to_active(client, owner, receptionist):
    client.patch(f"{BASE}/{receptionist.id}/deactivate", cookies=cookie_for(owner))
    resp = client.patch(f"{BASE}/{receptionist.id}/deactivate", cookies=cookie_for(owner))
    assert resp.json()["is_active"] is True


def test_owner_cannot_deactivate_self(client, owner):
    resp = client.patch(f"{BASE}/{owner.id}/deactivate", cookies=cookie_for(owner))
    assert resp.status_code == 400


def test_deactivate_not_found(client, owner):
    resp = client.patch(f"{BASE}/99999/deactivate", cookies=cookie_for(owner))
    assert resp.status_code == 404
