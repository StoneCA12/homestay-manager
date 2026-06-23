from tests.conftest import cookie_for

AUTH = "/api/v1/auth"


def test_login_success(client, owner):
    resp = client.post(f"{AUTH}/login", json={"email": "owner@example.com", "password": "pw-owner"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "owner@example.com"
    assert data["role"] == "OWNER"
    assert "access_token" in resp.cookies


def test_login_wrong_password(client, owner):
    resp = client.post(f"{AUTH}/login", json={"email": "owner@example.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_unknown_email(client):
    resp = client.post(f"{AUTH}/login", json={"email": "ghost@x.com", "password": "pw"})
    assert resp.status_code == 401


def test_login_inactive_user(client, db, owner):
    owner.is_active = False
    db.commit()
    resp = client.post(f"{AUTH}/login", json={"email": "owner@example.com", "password": "pw-owner"})
    assert resp.status_code == 403


def test_me_returns_current_user(client, owner):
    resp = client.get(f"{AUTH}/me", cookies=cookie_for(owner))
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "owner@example.com"
    assert data["role"] == "OWNER"


def test_me_receptionist_role(client, receptionist):
    resp = client.get(f"{AUTH}/me", cookies=cookie_for(receptionist))
    assert resp.status_code == 200
    assert resp.json()["role"] == "RECEPTIONIST"


def test_me_unauthenticated(client):
    assert client.get(f"{AUTH}/me").status_code == 401


def test_me_invalid_token(client):
    resp = client.get(f"{AUTH}/me", cookies={"access_token": "not.a.jwt.token"})
    assert resp.status_code == 401


def test_logout(client, owner):
    resp = client.post(f"{AUTH}/logout", cookies=cookie_for(owner))
    assert resp.status_code == 204


def test_revoked_token_rejected_after_logout(client, owner):
    # Obtain a real token via login, then logout, then verify the token is rejected.
    login_resp = client.post(f"{AUTH}/login", json={"email": "owner@example.com", "password": "pw-owner"})
    assert login_resp.status_code == 200
    token = login_resp.cookies["access_token"]

    client.post(f"{AUTH}/logout", cookies={"access_token": token})

    me_resp = client.get(f"{AUTH}/me", cookies={"access_token": token})
    assert me_resp.status_code == 401
