"""drop lineage columns and ghost_ancestors

The app is a person→person bridge — one recipe handed to one person — not a
family-lineage network, so recipes no longer form trees. This removes the
substrate: the self-referential parent edge, the relation label, and the
ghost-ancestor table.

SAFETY, checked against production before writing this (read-only):
  live recipes ....................... 3
  recipes WITH a parent_recipe_id .... 0   ← the tree was never used
  ghost_ancestor rows ................ 1   ← orphaned; owner approved dropping it
No row loses a parent it actually had, and every recipe was already its own root,
so the simplified can_view/effective_visibility cannot change any existing
authorization outcome.

`origin_attribution` on recipes is deliberately KEPT — it's the byline ("from
Lola Remedios · Cebu") and the only part of the origin idea that survives. The
ghost_ancestors table stored the same person as a row so recipe #1 could read as
a two-generation tree; nothing reads it now.

DOWNGRADE restores the schema but NOT the data: the dropped parent edges and
ghost rows are gone. That's acceptable here only because both are provably empty
or orphaned in every environment this runs against.

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-08-03
"""

from alembic import op
import sqlalchemy as sa


revision = "c1d2e3f4a5b6"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch_alter_table so this also runs on SQLite (local dev), which cannot
    # ALTER away a column or a constraint in place.
    with op.batch_alter_table("recipes") as batch:
        batch.drop_index("ix_recipes_parent_recipe_id")
        batch.drop_column("parent_recipe_id")
        batch.drop_column("lineage_relation")

    op.drop_table("ghost_ancestors")


def downgrade() -> None:
    op.create_table(
        "ghost_ancestors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "recipe_id",
            sa.Integer(),
            sa.ForeignKey("recipes.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("place", sa.String(), nullable=True),
        sa.Column("year", sa.String(), nullable=True),
        sa.Column("memory", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
    )

    with op.batch_alter_table("recipes") as batch:
        batch.add_column(
            sa.Column(
                "lineage_relation", sa.String(), server_default="root", nullable=False
            )
        )
        batch.add_column(sa.Column("parent_recipe_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_recipes_parent_recipe_id",
            "recipes",
            ["parent_recipe_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_index("ix_recipes_parent_recipe_id", ["parent_recipe_id"])
