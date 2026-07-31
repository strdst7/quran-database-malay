---
title: Coding Conventions
date: 2026-07-31
focus: quality
---

# Coding Conventions

**Analysis Date:** 2026-07-31

## Scope of Analysis

The repository contains exactly **one** Python source file: `convert_to_sqlite.py` (426 lines). All other scaffolding is empty (0 bytes): `docker/mysql/Dockerfile`, `docker/postgres/Dockerfile`, `docker/sqlite/Dockerfile`, `docker/*/install.sh`, `schema/mysql/schema.sql`, `schema/postgres/schema.sql`, `schema/sqlite/schema.sql`, `docs/architecture.md`, `CONTRIBUTING.md`, `docker-compose.yaml`. The SQLite schema itself is defined inline in `convert_to_sqlite.py` (`create_sqlite_schema`), not in `schema/sqlite/schema.sql`. Conventions below are derived from `convert_to_sqlite.py` plus the SQL conventions visible in its embedded DDL.

## Language & Runtime

- **Language:** Python 3 (no version pinned; shebang `#!/usr/bin/env python3` at `convert_to_sqlite.py:1`). Uses modern stdlib only — `sqlite3`, `re`, `os`, `pathlib.Path`. No third-party dependencies.
- **No packaging metadata:** No `pyproject.toml`, `requirements.txt`, `setup.py`, or lockfiles exist. The script is run directly: `python3 convert_to_sqlite.py` (see `README.md` "To regenerate from the MySQL dump").

## Naming Patterns

| Item | Pattern | Example |
|------|---------|---------|
| Module-level constants | `UPPER_SNAKE_CASE` | `SQL_FILE`, `DB_FILE`, `TABLE_ORDER` (`convert_to_sqlite.py:12-13, 344`) |
| Functions | `snake_case` | `create_sqlite_schema`, `parse_sql_value`, `stream_inserts` |
| Local variables | `snake_case` | `current_table`, `insert_pattern`, `table_counts` |
| SQL tables | lowercase plural | `surahs`, `ayahs`, `editions`, `ayah_edition`, `juzs`, `hizbs` |
| SQL columns | lowercase snake_case | `number_in_surah`, `name_en_translation`, `is_audio` |
| SQL indexes | `idx_<table>_<column>` | `idx_ayahs_surah_id`, `idx_ayah_edition_lookup` (`convert_to_sqlite.py:86-94`) |
| SQL views | lowercase snake_case | `surah_stats`, `ayah_with_translation` (`convert_to_sqlite.py:387, 398`) |
| Table order list | `UPPER_SNAKE_CASE` module constant | `TABLE_ORDER = ['surahs', 'ayahs', 'editions', 'ayah_edition']` (`convert_to_sqlite.py:344`) |

## Code Style

**Formatting:**
- 4-space indentation (PEP 8 compliant).
- Single-quoted strings everywhere (`'quran.sql'`, `'utf-8-sig'`), including SQL strings. Double quotes appear only inside f-string content or SQL.
- Two blank lines between top-level functions; one blank line between constants and functions.
- No type hints anywhere in the codebase — functions use runtime duck typing. `parse_sql_value(v)` accepts raw SQL string tokens; `stream_inserts(filepath)` is a generator yielding tuples.
- **Line length:** Not enforced. 30 lines exceed the PEP 8 79-char limit, e.g. `convert_to_sqlite.py:28` (89 chars, CHECK constraint), `:90-94` (index DDL up to 97 chars), `:182` (89 chars, compiled regex). Long lines are concentrated in SQL DDL strings and data tables.
- Shebang present; no `# -*- coding -*-` header (Python 3 defaults to UTF-8).
- Empty-scaffold files are committed as 0-byte placeholders (`docker/`, `schema/`, `docs/` directories) — no convention established for their content yet.

**Linting:**
- None. No `.flake8`, `.eslintrc`, `ruff.toml`, `mypy.ini`, or editorconfig files exist. Code style is maintained manually.

**Inconsistencies to be aware of:**
- `parse_insert_row` (`convert_to_sqlite.py:122`) contains stray double blank lines inside the function body (lines 132-133 and 166-167), unlike the single blank line style used elsewhere.
- Import block at `convert_to_sqlite.py:7-10` is not grouped by strict alphabetical order (`sqlite3`, `re`, `os` — should be `os`, `re`, `sqlite3` alphabetically). All imports are stdlib.
- `convert_to_sqlite.py:371` has a redundant progress-check condition `table_counts[table] <= len(rows) or table_counts[table] % 5000 == 0` — the first clause is always true on the first batch.

## Import Organization

**Order:**
1. Stdlib imports only (no third-party, no local imports).
2. `import X` statements precede `from X import Y` (`convert_to_sqlite.py:7-10`).

```python
import sqlite3
import re
import os
from pathlib import Path
```

**Path Aliases:** None — no package structure, no relative imports. The script is a single top-level module with a `__main__` guard.

## Error Handling

**Patterns:**
- No `try/except` blocks anywhere in `convert_to_sqlite.py`. Error handling relies on built-in exceptions propagating to the top level (e.g., `sqlite3.OperationalError`, `FileNotFoundError`).
- Defensive guards instead of exception handling: `os.path.exists(DB_FILE)` check before `os.remove(DB_FILE)` (`convert_to_sqlite.py:350-351`).
- Explicit string-stripping guards in parsing helpers (`parse_sql_value`, `parse_insert_row`) avoid index errors rather than catching them.
- Type coercion uses the "try both, fall through" idiom — try `int(v)`, then `float(v)`, then return the raw string (`convert_to_sqlite.py:111-119`).
- Integrity protection is delegated to SQLite: FK constraints, CHECK constraints, and `PRAGMA foreign_key_check` at `convert_to_sqlite.py:376`.

## Logging

**Framework:** None — plain `print()` statements to stdout. No `logging` module usage.

**Patterns:**
- Milestone messages: `print("Creating SQLite database with improved schema...")` (`convert_to_sqlite.py:348`).
- Progress with f-string interpolation: `print(f"  {table}: {table_counts[table]} rows...")` (`convert_to_sqlite.py:372`).
- Summary stats at end of run: row counts, sajdah/juz/hizb counts, DB size in MB with one decimal (`convert_to_sqlite.py:408-419`).
- **Convention to follow for new code:** use `print(f"...")` for user-facing progress; do not introduce a logging framework without discussion.

## Comments & Docstrings

- Every function has a triple-quoted one-line docstring: `"""Create the improved SQLite schema."""` (`convert_to_sqlite.py:16`), `"""Parse a single SQL value string into Python type."""` (`:99`).
- Module-level docstring documents purpose and a key design decision ("Line-based streaming parser — handles multi-line INSERT statements", `convert_to_sqlite.py:2-5`).
- Inline comments are rare but used to explain non-obvious logic: `# Disable FK checks during import for speed and to handle cross-references` (`convert_to_sqlite.py:356`), `# Remove trailing );` (`:192`).
- Arabic data tables (`juzs_data`, `hizbs_data` at `convert_to_sqlite.py:246-339`) contain no per-row comments — the Arabic names are self-documenting.

## Function Design

**Size:** Functions range from 3 lines (`column_map`, `:169-172`) to ~120 lines (`stream_inserts`, `:175-241`). No enforced maximum.

**Parameters:** Positional parameters with no defaults; no `*args`/`**kwargs` used. Docstrings document purpose but not parameters/returns.

**Return Values:**
- Pure parsing helpers return values: `parse_sql_value` returns `None | int | float | str`; `parse_insert_row` and `column_map` return tuples/lists.
- `stream_inserts` is a **generator** yielding `(table_name, columns, [rows])` tuples — the streaming design keeps memory bounded for the 196 MB dump (`data/quran.sql.zip`).
- `create_sqlite_schema` and `populate_lookup_tables` mutate the passed `db` connection and return `None`.

## Module Design

**Exports:** None — no `__all__`. All functions are module-level and reachable.
**Barrel Files:** Not applicable (single module).
**Main Guard:** `if __name__ == '__main__': convert()` at `convert_to_sqlite.py:425-426` — the module is both runnable and importable (tests could import `parse_sql_value` etc. without triggering conversion).

## Database / SQL Conventions (embedded DDL)

- SQL keywords in **UPPERCASE** within DDL: `CREATE TABLE IF NOT EXISTS`, `INTEGER PRIMARY KEY`, `NOT NULL`, `REFERENCES`.
- `TEXT`/`INTEGER` types with inline `CHECK` constraints: `CHECK(type IN ('meccan', 'medinan', 'Meccan', 'Medinan'))` (`convert_to_sqlite.py:28`), `CHECK(sajda IN (0, 1))` (`:59`).
- Timestamp columns named `created_at` / `updated_at` as nullable `TEXT` on every table (`:29-30`).
- One index per hot query path; partial index for sparse column: `CREATE INDEX IF NOT EXISTS idx_ayahs_sajda ON ayahs(sajda) WHERE sajda = 1` (`:91`).
- PRAGMAs set in the schema script: `journal_mode = WAL`, `foreign_keys = ON`, `encoding = 'UTF-8'` (`convert_to_sqlite.py:18-20`).
- Parameterized inserts only: `'?'` placeholders with `db.executemany(insert_sql, rows)` (`:366-369`). Never string-interpolated values.
- Multi-statement DDL run via `db.executescript(...)`.

## Conventions for the (empty) Scaffold Directories

The following files exist but are empty, so conventions are undefined — treat them as to-be-written, not as authoritative:

- `schema/mysql/schema.sql`, `schema/postgres/schema.sql`, `schema/sqlite/schema.sql` — intended as DDL reference files (per commit "Add schema/ for DDL reference files"). The real SQLite DDL lives in `convert_to_sqlite.py`.
- `docker/mysql|postgres|sqlite/{Dockerfile,install.sh}` — intended per-engine setup. `docker-compose.yaml` — intended orchestration.
- `docs/architecture.md` — intended contributor documentation (currently 0 bytes).
- `CONTRIBUTING.md` — 0 bytes; contribution guidance currently lives in `README.md` ("Contributing" section, lines 186-203).

---

*Convention analysis: 2026-07-31*
