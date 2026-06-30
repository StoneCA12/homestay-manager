from fastapi import APIRouter

from app.api.v1.endpoints import activity, auth, bike_rentals, bookings, expenses, guests, housekeeping, notes, reports, revenue, rooms, search, settings, users

router = APIRouter()

router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(rooms.router, prefix="/rooms", tags=["rooms"])
router.include_router(bookings.router, prefix="/bookings", tags=["bookings"])
router.include_router(guests.router, prefix="/guests", tags=["guests"])
router.include_router(housekeeping.router, prefix="/housekeeping", tags=["housekeeping"])
router.include_router(revenue.router, prefix="/revenue", tags=["revenue"])
router.include_router(expenses.router, prefix="/expenses", tags=["expenses"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(settings.router, prefix="/settings", tags=["settings"])
router.include_router(bike_rentals.router, prefix="/xe-may", tags=["xe-may"])
router.include_router(activity.router, prefix="/activity", tags=["activity"])
router.include_router(search.router, prefix="/search", tags=["search"])
router.include_router(notes.router, prefix="/notes", tags=["notes"])
router.include_router(reports.router, prefix="/reports", tags=["reports"])
