import uuid
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
import jwt
from fastapi import HTTPException, status

from app.core.config import settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire, "jti": str(uuid.uuid4())}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> tuple[str, str]:
    """Decode a JWT and return (subject, jti). Raises HTTP 401 on failure."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        subject: str | None = payload.get("sub")
        jti: str | None = payload.get("jti")
        if not subject or not jti:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return subject, jti
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def extract_token_claims_unsafe(token: str) -> tuple[str | None, datetime | None]:
    """Extract (jti, expires_at) without raising — used only at logout to revoke the token."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[ALGORITHM],
            options={"verify_exp": False},
        )
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            return jti, datetime.fromtimestamp(exp, tz=timezone.utc)
    except jwt.InvalidTokenError:
        pass
    return None, None
