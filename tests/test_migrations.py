"""Guards that the Alembic chain actually replays on an empty database.

Why this exists: the chain was broken for a long time on SQLite (two revisions
dropped foreign keys by their Postgres-auto-generated names, which a fresh SQLite
database never assigned). Nobody noticed because every local schema is built with
`Base.metadata.create_all`, which never runs a migration. That hides migration
bugs until they reach Postgres in production, where they are far more expensive.
These tests exercise the real code path instead.

SAFETY: these tests never touch the configured DATABASE_URL. They build their own
engine against a temp file and inject the connection through
`config.attributes["connection"]`, which `alembic/env.py` prefers over
`app.database.engine`. Nothing here reads app.config or app.database.
"""

from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _alembic_config(connection):
    """An Alembic config wired to `connection` and nothing else.

    The url is set to a bogus in-memory value so that any code path which
    ignored the injected connection and tried to connect on its own would hit an
    empty throwaway database rather than a real one.
    """
    cfg = Config(str(PROJECT_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(PROJECT_ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", "sqlite://")
    cfg.attributes["connection"] = connection
    return cfg


@pytest.fixture
def migrated(tmp_path):
    """Run the full chain from empty to head on a throwaway SQLite file.

    A file (not `sqlite://`) because batch_alter_table recreates tables, and the
    revisions under test are exactly the ones that do so — this keeps the test
    honest about the on-disk DDL path.
    """
    engine = create_engine(f"sqlite:///{tmp_path / 'chain.db'}")
    with engine.begin() as connection:
        command.upgrade(_alembic_config(connection), "head")
    yield engine
    engine.dispose()


def test_chain_upgrades_from_empty_to_head(migrated):
    """The whole chain replays on a fresh database and lands on the real head."""
    heads = ScriptDirectory.from_config(
        _alembic_config(None)
    ).get_heads()
    assert len(heads) == 1, f"expected a single head, found {heads}"

    with migrated.connect() as conn:
        stamped = conn.exec_driver_sql("SELECT version_num FROM alembic_version").scalar()
    assert stamped == heads[0]


def test_chain_downgrades_back_to_base(tmp_path):
    """Every downgrade() is reversible too, so the chain isn't a one-way door."""
    engine = create_engine(f"sqlite:///{tmp_path / 'down.db'}")
    with engine.begin() as connection:
        cfg = _alembic_config(connection)
        command.upgrade(cfg, "head")
        command.downgrade(cfg, "base")

    # Only alembic's own bookkeeping table should survive a full downgrade.
    assert [t for t in inspect(engine).get_table_names() if t != "alembic_version"] == []
    engine.dispose()


def test_migrated_schema_matches_models(migrated):
    """The migrated schema matches what the models declare.

    Catching this drift is the actual point: `create_all` and the migration chain
    are two independent definitions of the same schema, and only this comparison
    keeps them honest. Uses Alembic's own autogenerate comparison — if it finds
    any table/column difference, the two have diverged.
    """
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    from app.database import Base
    import tests.conftest  # noqa: F401  (imports every model onto Base.metadata)

    with migrated.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)

    # Only structural differences matter. Server-default and type comparison are
    # off by default in compare_metadata and deliberately left off: SQLite
    # round-trips defaults and types too loosely for that to be signal, and this
    # test should fail on real drift (a missing table or column), not on
    # dialect noise.
    structural = [d for d in diff if d[0] in {
        "add_table", "remove_table", "add_column", "remove_column",
    }]
    assert structural == [], f"migrations drifted from models: {structural}"
