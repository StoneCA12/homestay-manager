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

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    total_rooms: int
    occupied: int
    available: int
    arrivals_today: int
    checkouts_today: int
    dirty: int
