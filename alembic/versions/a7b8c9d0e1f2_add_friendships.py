"""add friendships

Backs the social feature's friend graph (Phase 0): symmetric, both-accept
friendships. Purely additive — nothing existing is altered. One row per ordered
(requester, addressee) pair; the reverse pair is refused at the router.

CASCADE on both user FKs: a friendship disappears with either account.

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-08-18
"""

from alembic import op
import sqlalchemy as sa


revision = "a7b8c9d0e1f2"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "friendships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "requester_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "addressee_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Normalized unordered pair (min id, max id) — the unique constraint sits
        # on THESE so one friendship per pair holds even when A→B and B→A race.
        sa.Column("pair_low", sa.Integer(), nullable=False),
        sa.Column("pair_high", sa.Integer(), nullable=False),
        sa.Column("state", sa.String(), server_default="pending", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("pair_low", "pair_high", name="uq_friendship_pair"),
    )
    op.create_index("ix_friendships_requester_id", "friendships", ["requester_id"])
    op.create_index("ix_friendships_addressee_id", "friendships", ["addressee_id"])
    op.create_index("ix_friendships_pair_low", "friendships", ["pair_low"])
    op.create_index("ix_friendships_pair_high", "friendships", ["pair_high"])


def downgrade() -> None:
    op.drop_index("ix_friendships_pair_high", table_name="friendships")
    op.drop_index("ix_friendships_pair_low", table_name="friendships")
    op.drop_index("ix_friendships_addressee_id", table_name="friendships")
    op.drop_index("ix_friendships_requester_id", table_name="friendships")
    op.drop_table("friendships")
