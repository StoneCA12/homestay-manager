from fastapi import APIRouter
from app.api.v1.endpoints import auth, rooms, bookings, housekeeping, revenue

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(rooms.router, prefix="/rooms", tags=["rooms"])
router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
router.include_router(housekeeping.router, prefix="/housekeeping", tags=["housekeeping"])
router.include_router(revenue.router, prefix="/revenue", tags=["revenue"])
