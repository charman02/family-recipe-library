"""Add blocks (#85 — the safety primitive)

Additive. Unique constraint inline in create_table because SQLite has no
ALTER TABLE ADD CONSTRAINT and this chain has to replay there.

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
"""

import sqlalchemy as sa
from alembic import op

revision = "a3b4c5d6e7f8"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "blocks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("blocker_id", sa.Integer(), nullable=False),
        sa.Column("blocked_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False
        ),
        sa.ForeignKeyConstraint(["blocker_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["blocked_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_block_pair"),
    )
    op.create_index(op.f("ix_blocks_blocker_id"), "blocks", ["blocker_id"], unique=False)
    op.create_index(op.f("ix_blocks_blocked_id"), "blocks", ["blocked_id"], unique=False)


def downgrade():
    op.drop_index(op.f("ix_blocks_blocked_id"), table_name="blocks")
    op.drop_index(op.f("ix_blocks_blocker_id"), table_name="blocks")
    op.drop_table("blocks")
