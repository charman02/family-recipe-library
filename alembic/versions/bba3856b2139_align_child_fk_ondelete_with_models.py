"""Align child FK ondelete with models

Revision ID: bba3856b2139
Revises: 0894735d3ccd
Create Date: 2026-06-29 10:22:50.255199

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bba3856b2139'
down_revision: Union[str, Sequence[str], None] = '0894735d3ccd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# c96af0203c3d created every child FK below without a name. Postgres auto-named
# them '<table>_<column>_fkey'; SQLite stores them nameless, so dropping them by
# that name fails with "No such constraint" on a from-scratch SQLite build. This
# convention lets batch mode label the reflected nameless FKs the way Postgres
# did, so the drops resolve on both dialects. Only consulted when batch mode
# recreates the table (SQLite); Postgres emits plain ALTER ... DROP CONSTRAINT
# and never reads it.
NAMING_CONVENTION = {"fk": "%(table_name)s_%(column_0_name)s_fkey"}


def upgrade() -> None:
    """Recreate child FKs with the ON DELETE behavior declared in the models."""
    with op.batch_alter_table('steps', naming_convention=NAMING_CONVENTION) as batch_op:
        batch_op.drop_constraint('steps_recipe_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'steps_recipe_id_fkey', 'recipes', ['recipe_id'], ['id'], ondelete='CASCADE'
        )
    with op.batch_alter_table('ingredient_sections', naming_convention=NAMING_CONVENTION) as batch_op:
        batch_op.drop_constraint('ingredient_sections_recipe_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'ingredient_sections_recipe_id_fkey', 'recipes', ['recipe_id'], ['id'], ondelete='CASCADE'
        )
    with op.batch_alter_table('ingredients', naming_convention=NAMING_CONVENTION) as batch_op:
        batch_op.drop_constraint('ingredients_recipe_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'ingredients_recipe_id_fkey', 'recipes', ['recipe_id'], ['id'], ondelete='CASCADE'
        )
        batch_op.drop_constraint('ingredients_section_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'ingredients_section_id_fkey', 'ingredient_sections', ['section_id'], ['id'], ondelete='SET NULL'
        )


def downgrade() -> None:
    """Restore child FKs without ON DELETE behavior (NO ACTION)."""
    with op.batch_alter_table('ingredients', naming_convention=NAMING_CONVENTION) as batch_op:
        batch_op.drop_constraint('ingredients_section_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'ingredients_section_id_fkey', 'ingredient_sections', ['section_id'], ['id']
        )
        batch_op.drop_constraint('ingredients_recipe_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'ingredients_recipe_id_fkey', 'recipes', ['recipe_id'], ['id']
        )
    with op.batch_alter_table('ingredient_sections', naming_convention=NAMING_CONVENTION) as batch_op:
        batch_op.drop_constraint('ingredient_sections_recipe_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'ingredient_sections_recipe_id_fkey', 'recipes', ['recipe_id'], ['id']
        )
    with op.batch_alter_table('steps', naming_convention=NAMING_CONVENTION) as batch_op:
        batch_op.drop_constraint('steps_recipe_id_fkey', type_='foreignkey')
        batch_op.create_foreign_key(
            'steps_recipe_id_fkey', 'recipes', ['recipe_id'], ['id']
        )
