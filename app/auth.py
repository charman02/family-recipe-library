import os
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings

# OAuth2 scheme - tells FastAPI where to find the bearer token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
# The same scheme, but a missing/invalid token yields None instead of a 401. For an endpoint
# that is deliberately public yet must still respect the CALLER when there is one — Browse is
# the case (#85): anyone may read it, but a signed-in reader must not be shown recipes by
# someone they've blocked.
oauth2_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def hash_password(plain_password: str) -> str:
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.algorithm)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.algorithm])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    from app.models.user import User

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_optional), db: Session = Depends(get_db)
):
    """The signed-in user, or None — never raises.

    Deliberately separate from `get_current_user` rather than a flag on it: an endpoint either
    REQUIRES a user or it doesn't, and a single function that sometimes 401s and sometimes
    returns None is the kind of ambiguity that leaks. Every existing protected route keeps
    using the strict one.

    A malformed or expired token is treated exactly like no token: None. The caller is then
    an anonymous reader, which for a public feed is a valid state, not an error.
    """
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.algorithm])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            return None
        # int() is INSIDE the try on purpose: a validly-signed token whose `sub` isn't a
        # number would otherwise raise ValueError out of a function documented as never
        # raising — and this one guards `/recipes/browse`, the app's only anonymous JSON
        # endpoint, so that would be a 500 where the honest answer is "no user".
        uid = int(user_id)
    except (JWTError, ValueError):
        return None

    from app.models.user import User

    return db.query(User).filter(User.id == uid).first()
