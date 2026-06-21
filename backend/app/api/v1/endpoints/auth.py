from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.user import LoginRequest, UserOut

router = APIRouter()

_COOKIE = "access_token"
_COOKIE_OPTS = dict(
    httponly=True,
    samesite="strict",
    secure=settings.COOKIE_SECURE,
    path="/",
)


def _authenticate_user(db: Session, email: str, password: str) -> User:
    """Verify credentials and return the User. Raises HTTP 401/403 on failure."""
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    return user


def _set_auth_cookie(response: Response, user: User) -> None:
    """Mint a JWT and attach it as an httpOnly cookie to the response."""
    token = create_access_token(user.email)
    response.set_cookie(
        key=_COOKIE,
        value=token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **_COOKIE_OPTS,
    )


@router.post("/login", response_model=UserOut)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = _authenticate_user(db, body.email, body.password)
    _set_auth_cookie(response, user)
    return UserOut.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(key=_COOKIE, path="/", samesite="strict")


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
