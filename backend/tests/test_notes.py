from tests.conftest import cookie_for

BASE = "/api/v1/notes"


def _create_note(client, user, entity_type="ROOM", entity_id=1, category="HOUSEKEEPING", content="Note content"):
    return client.post(f"{BASE}/", json={
        "entity_type": entity_type,
        "entity_id": entity_id,
        "category": category,
        "content": content,
    }, cookies=cookie_for(user))


# ── Create / list (existing append-only behavior) ──────────────────────────

def test_create_room_note(client, owner, room):
    resp = _create_note(client, owner, entity_id=room.id)
    assert resp.status_code == 201


def test_receptionist_can_create_room_note(client, receptionist, room):
    resp = _create_note(client, receptionist, entity_id=room.id, category="RECEPTION")
    assert resp.status_code == 201


def test_list_room_notes(client, owner, room):
    _create_note(client, owner, entity_id=room.id)
    resp = client.get(f"{BASE}/", params={"entity_type": "ROOM", "entity_id": room.id}, cookies=cookie_for(owner))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ── Delete: room notes only ─────────────────────────────────────────────────

def test_owner_can_delete_room_note(client, owner, room):
    note_id = _create_note(client, owner, entity_id=room.id).json()["id"]
    resp = client.delete(f"{BASE}/{note_id}", cookies=cookie_for(owner))
    assert resp.status_code == 204
    listed = client.get(f"{BASE}/", params={"entity_type": "ROOM", "entity_id": room.id}, cookies=cookie_for(owner))
    assert listed.json() == []


def test_receptionist_can_delete_room_note(client, owner, receptionist, room):
    # Owner creates the note; receptionist can still delete it (anyone-can-delete policy).
    note_id = _create_note(client, owner, entity_id=room.id).json()["id"]
    resp = client.delete(f"{BASE}/{note_id}", cookies=cookie_for(receptionist))
    assert resp.status_code == 204


def test_receptionist_cannot_delete_owner_category_note(client, owner, receptionist, room):
    note_id = _create_note(client, owner, entity_id=room.id, category="OWNER").json()["id"]
    resp = client.delete(f"{BASE}/{note_id}", cookies=cookie_for(receptionist))
    assert resp.status_code == 403


def test_owner_can_delete_owner_category_note(client, owner, room):
    note_id = _create_note(client, owner, entity_id=room.id, category="OWNER").json()["id"]
    resp = client.delete(f"{BASE}/{note_id}", cookies=cookie_for(owner))
    assert resp.status_code == 204


def test_cannot_delete_booking_note(client, owner, booking):
    note_id = _create_note(client, owner, entity_type="BOOKING", entity_id=booking.id).json()["id"]
    resp = client.delete(f"{BASE}/{note_id}", cookies=cookie_for(owner))
    assert resp.status_code == 400


def test_cannot_delete_guest_note(client, owner, guest):
    note_id = _create_note(client, owner, entity_type="GUEST", entity_id=guest.id).json()["id"]
    resp = client.delete(f"{BASE}/{note_id}", cookies=cookie_for(owner))
    assert resp.status_code == 400


def test_delete_note_not_found(client, owner):
    resp = client.delete(f"{BASE}/99999", cookies=cookie_for(owner))
    assert resp.status_code == 404


def test_delete_note_requires_auth(client, owner, room):
    note_id = _create_note(client, owner, entity_id=room.id).json()["id"]
    resp = client.delete(f"{BASE}/{note_id}")
    assert resp.status_code == 401
