from typing import Annotated
from pydantic import BaseModel, EmailStr, Field, ConfigDict, StringConstraints
from datetime import datetime


# A person's name is load-bearing here: every recipe carries a byline, so a name
# that renders as nothing leaves a dish with no one attached to it. Stripping
# first and then requiring one character is what rejects "" and "   " with the
# same rule. 80 is generous enough for long multi-part names while keeping a
# byline something the layout can hold.
PersonName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
]


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str


# The name rules live on the INPUT model only, deliberately. UserResponse also
# inherits UserBase, and tightening it there would turn any already-stored blank
# name into a 500 on read — punishing the existing account for a rule it was
# created before. New accounts can't get in without a real name; old ones stay
# readable.
class UserCreate(UserBase):
    first_name: PersonName
    last_name: PersonName
    # 72 bytes is bcrypt's own ceiling — anything longer is silently truncated,
    # so accepting it would mean accepting a password we don't fully check.
    password: str = Field(min_length=8, max_length=72)


class UserResponse(UserBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
