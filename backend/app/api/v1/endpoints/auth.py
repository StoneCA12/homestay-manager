from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.security import create_access_token, extract_token_claims_unsafe, hash_password, verify_password
from app.models.revoked_token import RevokedToken
from app.models.user import User
from app.schemas.user import LoginRequest, PasswordChange, UserOut

router = APIRouter()

_COOKIE = "access_token"
_COOKIE_OPTS = dict(
    httponly=True,
    samesite="strict",
    secure=settings.COOKIE_SECURE,
    path="/",
)


def _authenticate_user(db: Session, email: str, password: str) -> User:
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
    token = create_access_token(user.email)
    response.set_cookie(
        key=_COOKIE,
        value=token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **_COOKIE_OPTS,
    )


@router.post("/login", response_model=UserOut)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def login(request: Request, body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = _authenticate_user(db, body.email, body.password)
    _set_auth_cookie(response, user)
    return UserOut.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if access_token:
        jti, expires_at = extract_token_claims_unsafe(access_token)
        if jti and expires_at:
            # Lazy cleanup: remove already-expired entries while inserting
            db.query(RevokedToken).filter(
                RevokedToken.expires_at < datetime.now(timezone.utc)
            ).delete(synchronize_session=False)
            db.add(RevokedToken(jti=jti, expires_at=expires_at))
            db.commit()
    response.delete_cookie(key=_COOKIE, path="/", samesite="strict")


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải có ít nhất 8 ký tự")
    current_user.hashed_password = hash_password(body.new_password)
    db.commit()
