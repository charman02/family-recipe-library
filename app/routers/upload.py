import logging

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.auth import get_current_user
from app.models.user import User
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

# Max upload size: 10 MB. Reject before sending to Cloudinary.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# KNOWN GAP — orphaned assets. Every upload lands in Cloudinary immediately, but
# nothing here or in the client ever deletes one, so photos that get removed,
# replaced, or uploaded into a form the user then abandons stay in storage
# forever. There is deliberately NO delete endpoint, because a correct one is a
# larger change than a delete call:
#
#   1. Ownership has to be recorded. Cloudinary deletes take a public_id, and
#      nothing persists which user uploaded which public_id. A DELETE that just
#      trusts a client-supplied id/URL would let any authenticated user destroy
#      any other user's photos — an authorization hole, not a cleanup feature.
#      Fixing it means an `upload` table (public_id, user_id, created_at) that
#      the delete path can authorize against.
#   2. It has to be reference-aware. The same URL can already be the saved
#      cover of a live recipe (the edit form loads it), so "the user removed it
#      from the form" does not mean "no recipe points at it" — and the form may
#      never be saved. Deleting on removal can break a still-saved recipe.
#   3. The abandoned-form case is unreachable from the client anyway. Nobody
#      calls delete when a tab is closed, so the leak needs a sweep regardless:
#      a scheduled job that deletes assets older than a grace period which no
#      recipe's cover_photo_url references. That job — not a client-driven
#      delete — is the actual fix, and it subsumes cases 1 and 2.
#
# Until that lands the leak is bounded and cheap (one ~800x600 auto-quality
# image per removed pick), which is why it is documented rather than papered
# over with a risky endpoint. Note that adding public_id to the response below
# is safe on its own but pointless without the sweep, so it is left out.

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
)


@router.post("/recipe-photo")
def upload_recipe_photo(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user)
):
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are supported")

    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large (max 10 MB)")

    try:
        result = cloudinary.uploader.upload(
            file.file,
            folder="issei/recipes",
            transformation=[{"width": 800, "height": 600, "crop": "fill"}, {"quality": "auto"}],
        )
        return {"url": result["secure_url"]}
    except Exception:
        logger.exception("Cloudinary upload failed for user %s", current_user.id)
        raise HTTPException(status_code=502, detail="Image upload failed. Please try again.")


@router.post("/avatar")
def upload_avatar(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user)
):
    """A profile picture. Same guards + Cloudinary pipeline as recipe photos, but a
    SQUARE crop (400x400) with face-gravity so the crop centers on a face — a landscape
    800x600 recipe crop reads wrong for an avatar. Its own folder keeps avatars separate
    from recipe covers. Returns the URL; the client saves it via PATCH /auth/me.

    Same known orphan-asset gap as recipe uploads (see the note at the top of this file):
    replacing your photo leaves the old asset in Cloudinary until the future sweep."""
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are supported")

    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large (max 10 MB)")

    try:
        result = cloudinary.uploader.upload(
            file.file,
            folder="issei/avatars",
            transformation=[
                {"width": 400, "height": 400, "crop": "fill", "gravity": "face"},
                {"quality": "auto"},
            ],
        )
        return {"url": result["secure_url"]}
    except Exception:
        logger.exception("Cloudinary avatar upload failed for user %s", current_user.id)
        raise HTTPException(status_code=502, detail="Image upload failed. Please try again.")
