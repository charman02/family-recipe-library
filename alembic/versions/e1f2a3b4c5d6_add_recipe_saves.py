"""add recipe_saves

Backs #57: keeping a recipe you did not write. Purely additive — no existing table or
column is touched, so there is nothing to back-fill and nothing that can break an
existing row.

A save is a BOOKMARK, not a copy: one recipe FK, pointing at the cook's single live
row. Deliberately NOT here (see app/models/recipe_save.py for the full reasoning): any
second recipe reference, which would be lineage's parent_recipe_id under a new name; and
any relation/kind column, which would be lineage_relation.

CASCADE on both FKs — the shelf entry is meaningless without either side.
UNIQUE(user_id, recipe_id) makes keeping idempotent at the database, not just in the
router, so a double tap or a concurrent double POST cannot create two rows.

The unique constraint is declared INSIDE create_table rather than added afterwards:
SQLite has no ALTER TABLE ADD CONSTRAINT, and the friendships migration
(a7b8c9d0e1f2) is the working precedent for this shape. No batch_alter_table is used
because there is no ALTER here at all.

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-08-20
"""

from alembic import op
import sqlalchemy as sa


revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recipe_saves",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipe_id",
            sa.Integer(),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # nullable=False to match the model's `Mapped[datetime]` (non-Optional). Omitting
        # it left the column nullable in the migration while create_all made it NOT NULL —
        # exactly the two-definitions-of-one-schema drift tests/test_migrations.py exists
        # to catch, and it did.
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "recipe_id", name="uq_recipe_save_user_recipe"),
    )
    # Both FKs are queried on their own: user_id for "my shelf", recipe_id for the
    # per-recipe "have I kept this?" check on the recipe page.
    op.create_index("ix_recipe_saves_user_id", "recipe_saves", ["user_id"])
    op.create_index("ix_recipe_saves_recipe_id", "recipe_saves", ["recipe_id"])


def downgrade() -> None:
    op.drop_index("ix_recipe_saves_recipe_id", table_name="recipe_saves")
    op.drop_index("ix_recipe_saves_user_id", table_name="recipe_saves")
    op.drop_table("recipe_saves")
