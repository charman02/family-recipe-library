"""add profile visibility + post visibility (visibility model, issei #68)

Introduces:
  - users.profile_visibility ("public" | "private", default "private")
  - posts.visibility ("public" | "friends" | "private", default "friends")

recipes.visibility already exists; its VALUE SET becomes {public, friends, private}.
This migration does NOT rewrite existing recipe rows: a pre-existing "public" recipe
stays public and a "private" one stays private — exactly what they meant before — so
nothing currently visible changes. New recipes default to "friends" or "public" per the
create form (chosen from the author's profile); the recipes column server_default stays
"private" as the bypass safety net.

Data mapping on upgrade:
  - every existing user → profile_visibility "private" (the closed default; no recipe
    becomes newly public because existing public recipes stay public and everything
    else is private).
  - every existing post → visibility "friends" (Phase-1a posts already sat behind the
    friends-scoped feed, so "friends" preserves exactly who could see them).

Both columns are added NOT NULL with a server_default, which backfills existing rows
in a single statement and replays on SQLite (batch not needed for a pure add-column).

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-08-19
"""

from alembic import op
import sqlalchemy as sa


revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Adding a NOT NULL column with a server_default backfills every existing row to
    # that default in one statement (works on SQLite and Postgres alike).
    op.add_column(
        "users",
        sa.Column(
            "profile_visibility",
            sa.String(),
            nullable=False,
            server_default="private",
        ),
    )
    op.add_column(
        "posts",
        sa.Column(
            "visibility",
            sa.String(),
            nullable=False,
            server_default="friends",
        ),
    )


def downgrade() -> None:
    op.drop_column("posts", "visibility")
    op.drop_column("users", "profile_visibility")
