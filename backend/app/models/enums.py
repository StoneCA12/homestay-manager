import enum


class UserRole(str, enum.Enum):
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    RECEPTIONIST = "RECEPTIONIST"


class RoomType(str, enum.Enum):
    FAMILY = "FAMILY"
    WINDOW = "WINDOW"
    BALCONY = "BALCONY"
    REGULAR = "REGULAR"


class RoomStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    DIRTY = "DIRTY"
    CLEANING = "CLEANING"
    OUT_OF_ORDER = "OUT_OF_ORDER"


class BookingStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    CHECKED_OUT = "CHECKED_OUT"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class OTASource(str, enum.Enum):
    AGODA = "AGODA"
    BOOKING_COM = "BOOKING_COM"
    TRAVELOKA = "TRAVELOKA"
    ZALO = "ZALO"
    DIRECT = "DIRECT"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    BANK_TRANSFER = "BANK_TRANSFER"
    OTA_COLLECTED = "OTA_COLLECTED"


class BikeStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    RENTED = "RENTED"
    MAINTENANCE = "MAINTENANCE"


class BikeRentalStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    RETURNED = "RETURNED"
    CANCELLED = "CANCELLED"


class ExpenseCategory(str, enum.Enum):
    CLEANING = "CLEANING"
    SUPPLIES = "SUPPLIES"
    OTHER = "OTHER"
    UTILITIES = "UTILITIES"
    SALARIES = "SALARIES"
    MAINTENANCE = "MAINTENANCE"
