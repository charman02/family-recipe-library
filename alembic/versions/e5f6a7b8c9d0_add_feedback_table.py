"""add feedback table

Backs the in-app feedback form that replaces the external hosted one. A new
table, so this is purely additive: nothing existing is read, rewritten, or
dropped, and the downgrade is a clean drop.

CHAIN NOTE (read before rebasing this branch): down_revision is d4e5f6a7b8c9
(steps.photo_url), which was written concurrently on this same branch. That
revision was ALREADY PRESENT in the working tree when this one was authored, so
this is stacked on the observed id rather than a guess — the chain is linear and
`test_migrations.py`'s single-head assertion holds as it stands. If d4e5f6a7b8c9
is reordered or dropped during linearization, repoint down_revision here to
whatever ends up preceding it; nothing else in this file depends on it, since the
two revisions touch different tables.

`user_id` is CASCADE on delete, matching handoffs and cook_events: there is no
account-deletion path today, but when one lands, a person's notes about the app
should go with the account that wrote them.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-08-03
"""

from alembic import op
import sqlalchemy as sa


revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # Text, matching the model: a real bug report runs to paragraphs, and the
        # only length limit worth having is the deliberate one in the Pydantic
        # schema rather than an incidental column width.
        sa.Column("body", sa.Text(), nullable=False),
        # Both nullable with no default: an unset app version must read as
        # "unknown", never as a fabricated build string.
        sa.Column("path", sa.String(), nullable=True),
        sa.Column("app_version", sa.String(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade() -> None:
    # Drops every note anyone sent. Acceptable only because this table is
    # write-only reference material — nothing in the app reads it to make a
    # decision, so losing it breaks no behaviour.
    op.drop_table("feedback")
