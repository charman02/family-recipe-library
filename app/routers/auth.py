import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.handoff import Handoff
from app.models.password_reset import PasswordResetToken
from app.schemas.user import UserCreate, UserResponse, AccountUpdate
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.services.email import send_password_reset_email

logger = logging.getLogger(__name__)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )
    hashed = hash_password(user_in.password)
    new_user = User(
        email=user_in.email,
        hashed_password=hashed,
        first_name=user_in.first_name,
        last_name=user_in.last_name,
    )
    db.add(new_user)
    db.commit()
    # re-read from db to populate server-generated fields (id, created_at)
    db.refresh(new_user)
    # Auto-accept any pending recipe invites addressed to this email (sharing spec §4.2).
    pending = (
        db.query(Handoff)
        .filter(Handoff.to_email == new_user.email, Handoff.state == "pending")
        .all()
    )
    for h in pending:
        h.to_user_id = new_user.id
        h.state = "accepted"
    if pending:
        db.commit()
        db.refresh(new_user)
    return new_user


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
        },
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    update: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Edit the signed-in account: name, email, and/or password.

    Only fields present in the body change. Email and password changes require the
    correct current_password (they alter the login identity); a name change does
    not. Email must be unique. On success the whole (updated) user is returned so
    the client can refresh its cached copy.
    """
    changing_email = update.email is not None and update.email != current_user.email
    changing_password = update.new_password is not None

    # Sensitive changes are gated on the current password. Checked once, up front,
    # so an email+password change in one request can't half-apply.
    if changing_email or changing_password:
        if not update.current_password or not verify_password(
            update.current_password, current_user.hashed_password
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your current password isn't right.",
            )

    if changing_email:
        taken = (
            db.query(User)
            .filter(User.email == update.email, User.id != current_user.id)
            .first()
        )
        if taken:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="That email is already in use.",
            )
        current_user.email = update.email

    if changing_password:
        current_user.hashed_password = hash_password(update.new_password)

    if update.first_name is not None:
        current_user.first_name = update.first_name
    if update.last_name is not None:
        current_user.last_name = update.last_name

    db.commit()
    db.refresh(current_user)
    return current_user


class DeleteAccountRequest(BaseModel):
    password: str


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    body: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete the signed-in account and all associated data."""
    if not verify_password(body.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your password isn't right.",
        )
    db.delete(current_user)
    db.commit()


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request a password-reset email.

    Always returns 204 — even when the email is not registered — so the
    response gives no information about which accounts exist.
    """
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        return

    # Invalidate any still-pending tokens for this user so there is at most
    # one live link at a time (avoids confusion if someone clicks an old one).
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used.is_(False),
    ).delete()

    token = str(uuid.uuid4())
    record = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        used=False,
    )
    db.add(record)
    db.commit()

    try:
        send_password_reset_email(user.email, token)
    except Exception:
        logger.exception("SES send failed for %s", user.email)
        # Don't surface the SES error to the client — the response must stay
        # silent whether or not the email account exists.


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Consume a reset token and update the password."""
    if len(body.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters.",
        )

    record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token == body.token,
            PasswordResetToken.used.is_(False),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired.",
        )

    user = db.query(User).filter(User.id == record.user_id).first()
    user.hashed_password = hash_password(body.new_password)
    record.used = True
    db.commit()
