from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin_or_above
from app.models.commission_rate import CommissionRate
from app.models.user import User

router = APIRouter()


class CommissionRateOut(BaseModel):
    ota_source: str
    rate: Decimal

    model_config = {"from_attributes": True}


class CommissionRateUpdate(BaseModel):
    rate: Decimal = Field(ge=0, le=1, description="Rate as a decimal, e.g. 0.15 for 15%")


@router.get("/commission-rates", response_model=list[CommissionRateOut])
def list_commission_rates(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_above),
):
    return db.query(CommissionRate).order_by(CommissionRate.ota_source).all()


@router.patch("/commission-rates/{ota_source}", response_model=CommissionRateOut)
def update_commission_rate(
    ota_source: str,
    body: CommissionRateUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_above),
):
    rate = db.get(CommissionRate, ota_source.upper())
    if not rate:
        raise HTTPException(status_code=404, detail=f"OTA source '{ota_source}' not found")
    rate.rate = body.rate
    db.commit()
    db.refresh(rate)
    return rate
