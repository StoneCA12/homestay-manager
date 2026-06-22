from tests.conftest import cookie_for

BASE = "/api/v1/housekeeping"


def test_update_status_requires_auth(client, room):
    resp = client.patch(f"{BASE}/{room.id}/status", json={"to_status": "CLEANING"})
    assert resp.status_code == 401


def test_update_status_not_found(client, owner):
    resp = client.patch(f"{BASE}/99999/status",
                        json={"to_status": "CLEANING"}, cookies=cookie_for(owner))
    assert resp.status_code == 404


def test_update_status_available_to_cleaning(client, owner, db, room):
    from app.models.enums import RoomStatus
    resp = client.patch(f"{BASE}/{room.id}/status",
                        json={"to_status": "CLEANING"}, cookies=cookie_for(owner))
    assert resp.status_code == 200
    assert resp.json()["new_status"] == "CLEANING"
    db.refresh(room)
    assert room.housekeeping_status == RoomStatus.CLEANING


def test_update_status_cleaning_to_available(client, owner, db, room):
    from app.models.enums import RoomStatus
    room.housekeeping_status = RoomStatus.CLEANING
    db.commit()
    resp = client.patch(f"{BASE}/{room.id}/status",
                        json={"to_status": "AVAILABLE"}, cookies=cookie_for(owner))
    assert resp.status_code == 200
    db.refresh(room)
    assert room.housekeeping_status == RoomStatus.AVAILABLE


def test_update_status_to_out_of_order(client, owner, db, room):
    from app.models.enums import RoomStatus
    resp = client.patch(f"{BASE}/{room.id}/status",
                        json={"to_status": "OUT_OF_ORDER", "notes": "Broken AC"},
                        cookies=cookie_for(owner))
    assert resp.status_code == 200
    db.refresh(room)
    assert room.housekeeping_status == RoomStatus.OUT_OF_ORDER


def test_update_status_all_valid_transitions(client, owner, db, room):
    from app.models.enums import RoomStatus
    for status in ("DIRTY", "CLEANING", "OUT_OF_ORDER", "AVAILABLE"):
        resp = client.patch(f"{BASE}/{room.id}/status",
                            json={"to_status": status}, cookies=cookie_for(owner))
        assert resp.status_code == 200, f"Failed for {status}: {resp.json()}"
        db.refresh(room)
        assert room.housekeeping_status.value == status


def test_update_status_writes_audit_log(client, owner, db, room):
    from app.models.housekeeping import HousekeepingLog
    from app.models.enums import RoomStatus
    client.patch(f"{BASE}/{room.id}/status",
                 json={"to_status": "CLEANING", "notes": "routine"},
                 cookies=cookie_for(owner))
    log = db.query(HousekeepingLog).filter(HousekeepingLog.room_id == room.id).first()
    assert log is not None
    assert log.to_status == RoomStatus.CLEANING
    assert log.from_status == RoomStatus.AVAILABLE
    assert log.notes == "routine"
    assert log.changed_by_id == owner.id


def test_update_status_receptionist_allowed(client, receptionist, room):
    resp = client.patch(f"{BASE}/{room.id}/status",
                        json={"to_status": "CLEANING"}, cookies=cookie_for(receptionist))
    assert resp.status_code == 200


def test_update_status_response_contains_room_id(client, owner, room):
    resp = client.patch(f"{BASE}/{room.id}/status",
                        json={"to_status": "DIRTY"}, cookies=cookie_for(owner))
    assert resp.json()["room_id"] == room.id
