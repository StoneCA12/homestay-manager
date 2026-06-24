from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.guest import Guest
from app.models.user import User

router = APIRouter()


class GuestLookup(BaseModel):
    id: int
    full_name: str
    phone: str | None
    id_type: str | None
    id_number: str | None
    times_stayed: int
    notes: str | None

    model_config = {"from_attributes": True}


@router.get("/lookup", response_model=GuestLookup)
def lookup_guest_by_phone(
    phone: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Find a guest by phone number for booking form autofill."""
    if not phone or len(phone) < 7:
        raise HTTPException(status_code=400, detail="Phone number too short")
    guest = db.query(Guest).filter(Guest.phone == phone).first()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    return guest
