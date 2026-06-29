import enum
from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.models.enums import RoomStatus, RoomType


class DisplayStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    ARRIVAL_TODAY = "ARRIVAL_TODAY"
    CHECKOUT_TODAY = "CHECKOUT_TODAY"
    DIRTY = "DIRTY"
    CLEANING = "CLEANING"
    OUT_OF_ORDER = "OUT_OF_ORDER"
    OVERBOOKING = "OVERBOOKING"


class RoomOut(BaseModel):
    id: int
    room_number: str
    room_type: RoomType
    floor: int
    capacity: int
    base_price: Decimal
    housekeeping_status: RoomStatus
    display_status: DisplayStatus
    guest_name: str | None = None
    check_out_date: date | None = None
    active_bike_names: list[str] = []
    outstanding_balance: Decimal | None = None
    active_booking_id: int | None = None

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_rooms: int
    occupied: int
    available: int
    arrivals_today: int
    checkouts_today: int
    dirty: int
    occupancy_warning_dates: list[date] = []  # upcoming days with >= 75% occupancy


class RoomCreate(BaseModel):
    room_number: str
    room_type: RoomType
    floor: int = 1
    capacity: int = 2
    base_price: Decimal


class RoomUpdate(BaseModel):
    room_number: str | None = None
    room_type: RoomType | None = None
    floor: int | None = None
    capacity: int | None = None
    base_price: Decimal | None = None
    housekeeping_status: RoomStatus | None = None
