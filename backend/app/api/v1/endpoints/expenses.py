from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import ExpenseCategory, UserRole
from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseOut

router = APIRouter()

_RECEPTIONIST_CATEGORIES = {
    ExpenseCategory.CLEANING,
    ExpenseCategory.SUPPLIES,
    ExpenseCategory.OTHER,
}


def _to_expense_out(e: Expense) -> ExpenseOut:
    return ExpenseOut(
        id=e.id,
        category=e.category,
        amount=e.amount,
        expense_date=e.expense_date,
        description=e.description,
        room_id=e.room_id,
        recorded_by_name=e.recorded_by.full_name if e.recorded_by else None,
        created_at=e.created_at,
    )


@router.get("/", response_model=list[ExpenseOut])
def list_expenses(
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Expense)
    if start_date:
        q = q.filter(Expense.expense_date >= start_date)
    if end_date:
        q = q.filter(Expense.expense_date <= end_date)
    if current_user.role == UserRole.RECEPTIONIST:
        q = q.filter(Expense.category.in_(list(_RECEPTIONIST_CATEGORIES)))
    return [_to_expense_out(e) for e in q.order_by(Expense.expense_date.desc()).all()]


@router.post("/", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    body: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.RECEPTIONIST and body.category not in _RECEPTIONIST_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Receptionist cannot record expenses in category '{body.category.value}'",
        )

    expense = Expense(
        category=body.category,
        amount=body.amount,
        expense_date=body.expense_date,
        description=body.description,
        room_id=body.room_id,
        recorded_by_id=current_user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return _to_expense_out(expense)
