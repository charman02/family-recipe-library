from typing import Annotated, Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict, StringConstraints


# The whole point of the note. Trim first, then require one character: that's what
# rejects "" and "   " with a single rule, the same way PersonName does in
# schemas/user.py — a form submitted by leaning on the spacebar satisfies a
# browser's `required` and arrives as nothing.
#
# 2000 is sized to the job: comfortably more than a detailed bug report with steps
# to reproduce (a few hundred characters), and far short of a pasted log or an
# accidental select-all. The bound exists so a runaway paste fails at the door
# with a sentence the sender can act on, instead of being stored and read by
# nobody.
FeedbackBody = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
]


class FeedbackCreate(BaseModel):
    body: FeedbackBody
    # Context the CLIENT supplies, both optional and both capped. Untrusted by
    # construction — a caller can put anything in either — but neither is used for
    # authorization or interpolated anywhere, so they are hints for whoever reads
    # the report, and the cap is what stops them being used as free storage.
    path: Optional[Annotated[str, StringConstraints(max_length=200)]] = None
    app_version: Optional[Annotated[str, StringConstraints(max_length=50)]] = None


class FeedbackResponse(BaseModel):
    id: int
    body: str
    path: Optional[str] = None
    app_version: Optional[str] = None
    created_at: datetime

    # user_id is deliberately absent. The only read path returns the caller's own
    # notes, so echoing their own id back tells them nothing — and leaving it out
    # means no future endpoint can widen the reader set and start leaking who
    # wrote what just by reusing this model.

    model_config = ConfigDict(from_attributes=True)
