"""add step photo_url

An optional technique photo per step. The recipient of a handoff has often never
tasted OR seen the dish, and prose can't carry "fold the dumpling like this" or
"cook until it looks like this" — the photo is the only honest way to hand over
that part of the knowledge.

Nullable with no server default, so this is additive and back-compatible: every
existing step reads as having no photo, and no backfill is needed. Plain
add_column rather than batch_alter_table — adding a nullable column is the one
ALTER SQLite performs in place, so no table rebuild is required (unlike
c1d2e3f4a5b6, which had to drop columns).

Revision ID: d4e5f6a7b8c9
Revises: c1d2e3f4a5b6
Create Date: 2026-08-03
"""

from alembic import op
import sqlalchemy as sa


revision = "d4e5f6a7b8c9"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Text, matching recipes.cover_photo_url: a Cloudinary URL carries
    # transformation segments and has no length bound worth guessing at.
    op.add_column("steps", sa.Column("photo_url", sa.Text(), nullable=True))


def downgrade() -> None:
    # Drops the column and with it every step photo URL. The Cloudinary assets
    # themselves survive (nothing in this app deletes them — see the orphaned-
    # asset note in app/routers/upload.py), but the association is gone.
    op.drop_column("steps", "photo_url")
