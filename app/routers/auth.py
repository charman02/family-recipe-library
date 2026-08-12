from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.handoff import Handoff
from app.schemas.user import UserCreate, UserResponse, AccountUpdate
from app.auth import hash_password, verify_password, create_access_token, get_current_user

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
