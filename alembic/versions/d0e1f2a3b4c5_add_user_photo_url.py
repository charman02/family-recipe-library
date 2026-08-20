"""add user photo_url (profile pictures, issei #33)

Adds users.photo_url — a nullable Cloudinary URL for a user's profile picture. NULL
means "no photo": the UI falls back to the first-letter monogram, so no default and no
backfill are needed. Purely additive, replays on SQLite.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa


revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable, no server_default: absence of a photo is a real state (→ monogram),
    # not a value to backfill.
    op.add_column("users", sa.Column("photo_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "photo_url")
