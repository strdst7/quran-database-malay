---
title: Testing Patterns
date: 2026-07-31
focus: quality
---

# Testing Patterns

**Analysis Date:** 2026-07-31

## Test Framework

**None detected.** There is no test infrastructure of any kind in this repository:

- No test files (`*.test.py`, `test_*.py`, `*_test.py`) anywhere.
- No test runner configuration: no `pytest.ini`, `pyproject.toml`, `setup.cfg`, `tox.ini`, `unittest` discovery setup.
- No CI configuration: no `.github/workflows/`, `.gitlab-ci.yml`, `.travis.yml`, `Jenkinsfile`.
- No test dependencies declared (no `requirements.txt`, `dev-requirements.txt`, or lockfile at all).

The only test-related text is a contribution guideline in `README.md:199` — "Add tests for API endpoints" — which refers to a planned (not-yet-built) REST API in the roadmap (`README.md:168-175`). There are currently no API endpoints to test.

**Honest assessment:** This codebase has **zero test coverage** and no established testing patterns. The framework recommendation below is prescriptive for future work, not a description of existing practice.

## Recommended Framework (for future tests)

**Runner:** `pytest` (the de-facto standard; the script is importable without side effects thanks to the `if __name__ == '__main__':` guard at `convert_to_sqlite.py:425`, so `pytest` can import `parse_sql_value`, `parse_insert_row`, `column_map`, and `stream_inserts` directly).

**Config:** Add a minimal `pyproject.toml` (currently absent) with:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
```

**Run Commands:**
```bash
python3 -m pytest              # Run all tests
python3 -m pytest -v           # Verbose
python3 -m pytest --cov=.      # Coverage (requires pytest-cov)
```

## Test File Organization

**Current state:** No `tests/` directory exists. Recommend creating `tests/` at repo root, mirroring module names:

```
tests/
├── test_parse_sql_value.py
├── test_parse_insert_row.py
├── test_column_map.py
└── test_stream_inserts.py
```

**Naming:** `test_<module_or_function>.py` for files, `test_<function_name>` for test functions (pytest defaults).

## What Is Unit-Testable Today

The parsing pipeline in `convert_to_sqlite.py` is composed of small, mostly-pure functions with well-defined inputs/outputs — ideal first test targets:

| Function | Location | Behavior | Test Notes |
|----------|----------|----------|------------|
| `parse_sql_value(v)` | `convert_to_sqlite.py:98-119` | Converts raw SQL token → `None`/`int`/`float`/`str`; unescapes `\'`, `\"`, `\\`, `\n`, `\r`, `\t`; strips UTF-8 BOM | Pure function, deterministic. Test each branch: `'NULL'`, quoted strings with escapes, `int`, `float`, bare words |
| `parse_insert_row(line, col_names)` | `convert_to_sqlite.py:122-166` | Splits one `(...)` VALUES row handling quoted commas/escapes | Pure function. Test quoted commas (`'text, with, commas'`), escaped quotes, `NULL`, trailing `);`/`,` |
| `column_map(col_str)` | `convert_to_sqlite.py:169-172` | Splits INSERT column spec, strips backticks/spaces | Pure function. Note: `col_names` param is unused |
| `stream_inserts(filepath)` | `convert_to_sqlite.py:175-241` | Generator yielding `(table, columns, rows)` per INSERT; handles single-line and multi-line INSERTs | Needs a small fixture SQL file — see Fixtures below |

**Non-unit-testable today:** `create_sqlite_schema`, `populate_lookup_tables`, `convert` require a live `sqlite3.Connection` and the 196 MB MySQL dump (`data/quran.sql.zip`) — treat these as integration-level once fixtures exist.

## Suggested Test Structure (pytest style)

```python
# tests/test_parse_sql_value.py
from convert_to_sqlite import parse_sql_value


def test_null():
    assert parse_sql_value('NULL') is None


def test_integer():
    assert parse_sql_value('6236') == 6236


def test_quoted_string_with_escapes():
    assert parse_sql_value(r"'it\\'s'") == "it's"


def test_bom_stripped_from_first_value():
    assert parse_sql_value("'\ufeffالفاتحة'") == 'الفاتحة'
```

## Mocking

**Framework:** None in use. When testing `convert()` / `create_sqlite_schema`, prefer **real in-memory SQLite** over mocks — `sqlite3.connect(':memory:')` is the natural seam and avoids mocking the stdlib:

```python
import sqlite3
from convert_to_sqlite import create_sqlite_schema, populate_lookup_tables

def test_schema_creates_tables():
    db = sqlite3.connect(':memory:')
    create_sqlite_schema(db)
    tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {'surahs', 'juzs', 'hizbs', 'ayahs', 'editions', 'ayah_edition'} <= tables
```

**What to Mock:** `os.remove` / `sqlite3.connect` when testing `convert()` itself (it hard-codes `SQL_FILE = "quran.sql"` and `DB_FILE = "quran.db"` at `convert_to_sqlite.py:12-13`). Use `monkeypatch` or `unittest.mock.patch`.

**What NOT to Mock:** SQLite itself — in-memory databases are fast and give true FK/CHECK behavior.

## Fixtures and Factories

**Current state:** No fixtures exist. `data/quran.sql.zip` (47 MB zip, 196 MB uncompressed MySQL dump) is the real dataset — do **not** use it in tests (slow, binary, and gitignored only via `output/` in `.gitignore`).

**Recommendation:** Commit small fixture SQL files under `tests/fixtures/` covering the parser's edge cases:

```
tests/fixtures/
├── single_line_inserts.sql     # One INSERT per line, ends with );
├── multi_line_inserts.sql      # INSERT spanning several lines (the stream_inserts complexity)
├── escaped_values.sql          # Quotes, backslashes, newlines, commas inside strings
└── bom_header.sql              # \ufeff at start of first value
```

Example fixture line for `stream_inserts`:

```sql
INSERT INTO `surahs` (`id`, `number`, `name_ar`) VALUES (1, 1, 'الفاتحة'), (2, 2, 'البقرة');
```

Expect `stream_inserts` to yield `('surahs', ['id', 'number', 'name_ar'], [(1, 1, 'الفاتحة'), (2, 2, 'البقرة')])`.

## Coverage

**Requirements:** None enforced. No coverage tool configured, no coverage gate in CI (no CI).

**View Coverage (once pytest-cov added):**
```bash
python3 -m pytest --cov=convert_to_sqlite --cov-report=term-missing
```

## Test Types

**Unit Tests:** Not present today. Highest-value targets are the pure parsing functions listed above (`convert_to_sqlite.py:98-241`).

**Integration Tests:** Not present. A worthwhile integration test builds a DB from a tiny fixture dump end-to-end: run `stream_inserts` over a fixture, `create_sqlite_schema`, `db.executemany`, then `populate_lookup_tables` and assert juz/hizb counts (30 and 60 rows respectively, per data at `convert_to_sqlite.py:246-339`) and that views `surah_stats` / `ayah_with_translation` (`convert_to_sqlite.py:387-404`) return rows.

**E2E Tests:** Not used. No app/server exists to exercise.

## Common Patterns to Test Carefully

**Async Testing:** Not applicable — fully synchronous script, no `asyncio`.

**Error Testing (parser edge cases — all currently unverified):**
- `parse_insert_row` with a row containing a comma inside a quoted string (`convert_to_sqlite.py:153-158` quote-tracking branch).
- Escaped backslash sequences (`convert_to_sqlite.py:144-147` `escape_next` handling).
- Trailing `);` vs `),` vs `)` row endings (`convert_to_sqlite.py:191-209`).
- Values starting on the same line as `VALUES` (`convert_to_sqlite.py:224-237` branch).
- A `NULL` value in the middle of a row (`parse_sql_value` returns `None`, `:101-102`).

These branches are the script's riskiest logic (a mis-parse corrupts the entire 6,236-ayah dataset) and have no test coverage today.

## Known Obstacles to Testing

- `convert_to_sqlite.py` uses **module-level constants** `SQL_FILE` and `DB_FILE` (`:12-13`) with no CLI arguments or overrides — `convert()` is hard to parametrize without monkeypatching.
- The MySQL dump (`data/quran.sql.zip`) is not in the `tests/` path and should never be loaded by tests (196 MB).
- No packaging metadata means tests must be run from the repo root so `convert_to_sqlite` is importable; a `tests/conftest.py` adding the repo root to `sys.path` avoids fragility.

---

*Testing analysis: 2026-07-31*
