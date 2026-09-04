"""Add recipe_requests and notifications (#79 — the request → fulfill loop)

Two new tables, both additive. Unique constraint declared INLINE in create_table because
SQLite has no ALTER TABLE ADD CONSTRAINT and this chain has to replay there.

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
"""

import sqlalchemy as sa
from alembic import op

revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "recipe_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("requester_id", sa.Integer(), nullable=False),
        sa.Column("state", sa.String(), server_default="pending", nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("post_id", "requester_id", name="uq_recipe_request_post_requester"),
    )
    op.create_index(
        op.f("ix_recipe_requests_post_id"), "recipe_requests", ["post_id"], unique=False
    )
    op.create_index(
        op.f("ix_recipe_requests_requester_id"), "recipe_requests", ["requester_id"], unique=False
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("post_id", sa.Integer(), nullable=True),
        sa.Column("recipe_id", sa.Integer(), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        # Recipient and actor CASCADE (no one to show it to / no one to name); the
        # references SET NULL so a notification about a deleted post degrades to an
        # un-clickable line instead of disappearing or breaking the key.
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
    op.create_index(
        op.f("ix_notifications_created_at"), "notifications", ["created_at"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_notifications_created_at"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")
    op.drop_index(op.f("ix_recipe_requests_requester_id"), table_name="recipe_requests")
    op.drop_index(op.f("ix_recipe_requests_post_id"), table_name="recipe_requests")
    op.drop_table("recipe_requests")
