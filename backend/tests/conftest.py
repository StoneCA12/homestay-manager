import os

# Must be set before any app import so pydantic-settings picks up the override.
# We still override get_db below, so DATABASE_URL only needs to satisfy Settings validation.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "Rk7Xq2Pn9Lm4Yw3Zb6Th1Dj8Vc5Fs0Ga")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "480")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("LOGIN_RATE_LIMIT", "1000/minute")

from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.booking import Booking
from app.models.enums import BookingStatus, OTASource, RoomStatus, RoomType, UserRole
from app.models.guest import Guest
from app.models.room import Room
from app.models.user import User

# Single shared in-memory SQLite DB for the whole test session.
# StaticPool means every session/connection reuses the same underlying connection.
_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@event.listens_for(_engine, "connect")
def _fk_pragma(conn, _):
    conn.execute("PRAGMA foreign_keys=ON")

_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


# ── Schema lifecycle ───────────────────────────────────────────────────────
@pytest.fixture(autouse=True)
def reset_schema():
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


# ── Session & client ───────────────────────────────────────────────────────
@pytest.fixture
def db(reset_schema):
    session = _Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def _override():
        yield db

    app.dependency_overrides[get_db] = _override
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ── User fixtures ──────────────────────────────────────────────────────────
@pytest.fixture
def owner(db):
    u = User(
        email="owner@example.com",
        hashed_password=hash_password("pw-owner"),
        full_name="Owner User",
        role=UserRole.OWNER,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def admin(db):
    u = User(
        email="admin@example.com",
        hashed_password=hash_password("pw-admin"),
        full_name="Admin User",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def receptionist(db):
    u = User(
        email="recep@example.com",
        hashed_password=hash_password("pw-recep"),
        full_name="Receptionist User",
        role=UserRole.RECEPTIONIST,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def cookie_for(user: User) -> dict:
    """Return an access_token cookie dict for the given user."""
    return {"access_token": create_access_token(user.email)}


# ── Room fixtures ──────────────────────────────────────────────────────────
@pytest.fixture
def room(db):
    r = Room(
        room_number="101",
        room_type=RoomType.WINDOW,
        floor=1,
        capacity=2,
        base_price=Decimal("1000000"),
        housekeeping_status=RoomStatus.AVAILABLE,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@pytest.fixture
def room2(db):
    r = Room(
        room_number="102",
        room_type=RoomType.REGULAR,
        floor=1,
        capacity=1,
        base_price=Decimal("800000"),
        housekeeping_status=RoomStatus.AVAILABLE,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@pytest.fixture
def guest(db):
    g = Guest(full_name="Nguyen Van A", phone="0901234567")
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


TODAY = date.today()


@pytest.fixture
def booking(db, room, guest, owner):
    b = Booking(
        room_id=room.id,
        guest_id=guest.id,
        check_in_date=TODAY,
        check_out_date=TODAY + timedelta(days=3),
        num_guests=2,
        ota_source=OTASource.DIRECT,
        total_price=Decimal("3000000"),
        status=BookingStatus.CONFIRMED,
        created_by_id=owner.id,
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


@pytest.fixture
def checked_in_booking(db, booking):
    booking.status = BookingStatus.CHECKED_IN
    db.commit()
    db.refresh(booking)
    return booking
