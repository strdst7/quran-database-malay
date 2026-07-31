<!-- GSD:project-start source:PROJECT.md -->
## Project

**Quran Database Malay**

A public Quran dataset and GitHub Pages site. The database packages the complete Quran (Arabic text + 134 existing translation editions) as SQLite artifacts, and now gains the Basmeih Malay translation. A static GitHub Pages site exposes a curl-able JSON API (per-surah files + full search index, built by GitHub Actions) so anyone can search and retrieve verses in Arabic with Malay translation from the command line, alongside a browser search page styled with the QuestUI design system.

**Core Value:** Anyone can curl the GitHub Pages endpoint and get a Quran verse (Arabic + Basmeih Malay) by searching — fast, reliably, and without auth.

### Constraints

- **Tech stack**: Python 3 stdlib for data pipeline (existing) — no new runtime deps for conversion
- **Hosting**: GitHub Pages — static hosting only, no server-side logic at request time
- **Build**: GitHub Actions allowed at deploy time (builds JSON files, then deploys to Pages)
- **Data**: Must include original Arabic text alongside Malay translation in responses
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Python 3 (3.6+) — the only runtime language in this repo. `convert_to_sqlite.py` is a single script that converts the MySQL dump to SQLite. Verified working on Python 3.13.5 with SQLite 3.46.1.
- SQL (MySQL 5.7 dialect) — source data in `data/quran.sql.zip` (`quran.sql`, ~196 MB uncompressed), a `phpMyAdmin SQL Dump` with `ENGINE=InnoDB`, `utf8mb4_unicode_ci` collation.
- SQLite SQL — target schema defined in `convert_to_sqlite.py` (`create_sqlite_schema()`, lines 15–95).
- Arabic text data — the dataset content (Quranic Arabic script, 6,236 ayahs). Encoded as UTF-8; the dump carries a UTF-8 BOM (`\ufeff`) at the start of the first value, handled explicitly in `parse_sql_value()` (`convert_to_sqlite.py:108`).
- Shell — `install.sh` placeholders in `docker/*/` (empty files, no content).
- PHP 7.1.18 — the *original* dump toolchain (phpMyAdmin 4.7.7), not present in this repo; noted from the dump header only.
## Runtime
- Python 3 interpreter, no pinned version. The script uses f-strings (`convert_to_sqlite.py:367`), `pathlib.Path` (imported but unused), `os.path.exists` — requires Python 3.6+.
- No virtualenv, no container runtime, no version managers (no `.nvmrc`, `.python-version`, `pyproject.toml`).
- None. No `requirements.txt`, `setup.py`, `pyproject.toml`, or `Pipfile`. The script uses only the Python standard library: `sqlite3`, `re`, `os`, `pathlib`.
- Lockfile: None.
## Frameworks
- None. The repository contains no application framework. `convert_to_sqlite.py` is a procedural stdlib script with a single `convert()` entry point.
- None. No test files, no test framework, no test configuration.
- None. No build tooling, no bundlers, no task runners, no linters/formatters config.
## Key Dependencies
- Python stdlib `sqlite3` — used for all database operations in `convert_to_sqlite.py`. Relies on the host SQLite version's WAL and FK support (`PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`).
- MySQL 5.7.22 — the source database server that produced `data/quran.sql.zip` (dump header: `Server version: 5.7.22`). MySQL is a *source* only; this repo does not run MySQL.
- SQLite 3 — target database (`quran.db.gz`, ~60 MB compressed / ~208 MB uncompressed).
- PostgreSQL — placeholder only. `schema/postgres/schema.sql` is an empty file; the README roadmap item "Support ~~PostgreSQL and~~ SQLite exports" is struck through, indicating PostgreSQL support was dropped.
## Configuration
- No environment variables used anywhere. No `.env` files, no config modules.
- All paths are hardcoded constants in `convert_to_sqlite.py:12-13`:
- No build config. The "build" is running the script directly:
## Database Schema
- **Authoritative (non-empty):** `create_sqlite_schema()` in `convert_to_sqlite.py:15-95` — 6 tables (`surahs`, `juzs`, `hizbs`, `ayahs`, `editions`, `ayah_edition`) with FK/CHECK constraints and 9 indexes.
- **Documentation:** `README.md:17-95` — column-level documentation of the MySQL schema.
- **Placeholders (empty files):** `schema/mysql/schema.sql`, `schema/postgres/schema.sql`, `schema/sqlite/schema.sql` — 0 bytes each, committed in the "establish project structure" commit (2882f0e) but never filled in.
## Docker
- `docker/mysql/Dockerfile`, `docker/mysql/install.sh`
- `docker/postgres/Dockerfile`, `docker/postgres/install.sh`
- `docker/sqlite/Dockerfile`, `docker/sqlite/install.sh`
- `docker-compose.yaml` (repo root)
## Platform Requirements
- Python 3.6+ (stdlib only)
- `unzip` and `gzip`/`gunzip` CLI tools for extracting `data/quran.sql.zip` and `quran.db.gz`
- A SQLite client (`sqlite3` CLI) or Python `sqlite3` module for querying
- None. No deployment target, no server code, no runtime service. This is a data-artifact repo (database dumps + conversion tooling), not an application.
## Data Artifacts
| File | Format | Size | Purpose |
| --- | --- | --- | --- |
| `data/quran.sql.zip` | MySQL dump (zip) | ~48 MB zipped / ~196 MB raw | Source of truth; input to converter |
| `quran.db.gz` | SQLite DB (gzip) | ~60 MB zipped / ~208 MB raw | Deliverable; query-ready SQLite database |
| `screenshots/*.png` | PNG images | — | Table screenshots used in `README.md:207-210` |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Scope of Analysis
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
- 4-space indentation (PEP 8 compliant).
- Single-quoted strings everywhere (`'quran.sql'`, `'utf-8-sig'`), including SQL strings. Double quotes appear only inside f-string content or SQL.
- Two blank lines between top-level functions; one blank line between constants and functions.
- No type hints anywhere in the codebase — functions use runtime duck typing. `parse_sql_value(v)` accepts raw SQL string tokens; `stream_inserts(filepath)` is a generator yielding tuples.
- **Line length:** Not enforced. 30 lines exceed the PEP 8 79-char limit, e.g. `convert_to_sqlite.py:28` (89 chars, CHECK constraint), `:90-94` (index DDL up to 97 chars), `:182` (89 chars, compiled regex). Long lines are concentrated in SQL DDL strings and data tables.
- Shebang present; no `# -*- coding -*-` header (Python 3 defaults to UTF-8).
- Empty-scaffold files are committed as 0-byte placeholders (`docker/`, `schema/`, `docs/` directories) — no convention established for their content yet.
- None. No `.flake8`, `.eslintrc`, `ruff.toml`, `mypy.ini`, or editorconfig files exist. Code style is maintained manually.
- `parse_insert_row` (`convert_to_sqlite.py:122`) contains stray double blank lines inside the function body (lines 132-133 and 166-167), unlike the single blank line style used elsewhere.
- Import block at `convert_to_sqlite.py:7-10` is not grouped by strict alphabetical order (`sqlite3`, `re`, `os` — should be `os`, `re`, `sqlite3` alphabetically). All imports are stdlib.
- `convert_to_sqlite.py:371` has a redundant progress-check condition `table_counts[table] <= len(rows) or table_counts[table] % 5000 == 0` — the first clause is always true on the first batch.
## Import Organization
## Error Handling
- No `try/except` blocks anywhere in `convert_to_sqlite.py`. Error handling relies on built-in exceptions propagating to the top level (e.g., `sqlite3.OperationalError`, `FileNotFoundError`).
- Defensive guards instead of exception handling: `os.path.exists(DB_FILE)` check before `os.remove(DB_FILE)` (`convert_to_sqlite.py:350-351`).
- Explicit string-stripping guards in parsing helpers (`parse_sql_value`, `parse_insert_row`) avoid index errors rather than catching them.
- Type coercion uses the "try both, fall through" idiom — try `int(v)`, then `float(v)`, then return the raw string (`convert_to_sqlite.py:111-119`).
- Integrity protection is delegated to SQLite: FK constraints, CHECK constraints, and `PRAGMA foreign_key_check` at `convert_to_sqlite.py:376`.
## Logging
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
- Pure parsing helpers return values: `parse_sql_value` returns `None | int | float | str`; `parse_insert_row` and `column_map` return tuples/lists.
- `stream_inserts` is a **generator** yielding `(table_name, columns, [rows])` tuples — the streaming design keeps memory bounded for the 196 MB dump (`data/quran.sql.zip`).
- `create_sqlite_schema` and `populate_lookup_tables` mutate the passed `db` connection and return `None`.
## Module Design
## Database / SQL Conventions (embedded DDL)
- SQL keywords in **UPPERCASE** within DDL: `CREATE TABLE IF NOT EXISTS`, `INTEGER PRIMARY KEY`, `NOT NULL`, `REFERENCES`.
- `TEXT`/`INTEGER` types with inline `CHECK` constraints: `CHECK(type IN ('meccan', 'medinan', 'Meccan', 'Medinan'))` (`convert_to_sqlite.py:28`), `CHECK(sajda IN (0, 1))` (`:59`).
- Timestamp columns named `created_at` / `updated_at` as nullable `TEXT` on every table (`:29-30`).
- One index per hot query path; partial index for sparse column: `CREATE INDEX IF NOT EXISTS idx_ayahs_sajda ON ayahs(sajda) WHERE sajda = 1` (`:91`).
- PRAGMAs set in the schema script: `journal_mode = WAL`, `foreign_keys = ON`, `encoding = 'UTF-8'` (`convert_to_sqlite.py:18-20`).
- Parameterized inserts only: `'?'` placeholders with `db.executemany(insert_sql, rows)` (`:366-369`). Never string-interpolated values.
- Multi-statement DDL run via `db.executescript(...)`.
## Conventions for the (empty) Scaffold Directories
- `schema/mysql/schema.sql`, `schema/postgres/schema.sql`, `schema/sqlite/schema.sql` — intended as DDL reference files (per commit "Add schema/ for DDL reference files"). The real SQLite DDL lives in `convert_to_sqlite.py`.
- `docker/mysql|postgres|sqlite/{Dockerfile,install.sh}` — intended per-engine setup. `docker-compose.yaml` — intended orchestration.
- `docs/architecture.md` — intended contributor documentation (currently 0 bytes).
- `CONTRIBUTING.md` — 0 bytes; contribution guidance currently lives in `README.md` ("Contributing" section, lines 186-203).
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
```
## Component Responsibilities
| Component | Responsibility | File |
|-----------|----------------|------|
| `convert_to_sqlite.py` | Entire pipeline: schema creation, MySQL→SQLite row streaming, lookup population, views | `convert_to_sqlite.py` |
| `create_sqlite_schema(db)` | DDL for 6 tables, 9 indexes, PRAGMAs (WAL, FK, UTF-8) | `convert_to_sqlite.py:15` |
| `stream_inserts(filepath)` | Line-based generator yielding `(table, columns, rows)` from MySQL dump | `convert_to_sqlite.py:175` |
| `parse_insert_row(line, col_names)` | Splits one `(...)` VALUES row into a tuple, quote/escape-aware | `convert_to_sqlite.py:122` |
| `parse_sql_value(v)` | Coerces a raw SQL literal to `str`/`int`/`float`/`None`, strips BOM | `convert_to_sqlite.py:98` |
| `column_map(col_str)` | Extracts column names from an INSERT column spec | `convert_to_sqlite.py:169` |
| `populate_lookup_tables(db)` | Hardcoded 30 juz + 60 hizb rows with ayah ranges | `convert_to_sqlite.py:244` |
| `convert()` | Orchestrates the full run; prints row counts, sajdah/juz/hizb stats, DB size | `convert_to_sqlite.py:347` |
| `README.md` | Schema documentation, setup instructions, roadmap | `README.md` |
| `data/quran.sql.zip` | Input MySQL dump artifact | `data/quran.sql.zip` |
| `quran.db.gz` | Output SQLite artifact (pre-built) | `quran.db.gz` |
## Pattern Overview
- Memory-bounded streaming: the MySQL dump is read line-by-line via a generator, never loaded whole (`convert_to_sqlite.py:184`)
- Schema enrichment during load: the SQLite schema adds FK constraints, CHECK constraints, indexes, lookup tables, and views that the source MySQL dump lacks
- MySQL dump compatibility: a hand-rolled parser handles multi-line `INSERT` statements with quoted/escaped values (`\n`, `\r`, `\t`, `\'`, `\"`, `\\`, BOM)
- One-shot deterministic run: existing `quran.db` is deleted and rebuilt on each invocation (`convert_to_sqlite.py:350`)
- Multi-engine distribution intent: `schema/{mysql,postgres,sqlite}/schema.sql` and `docker/{mysql,postgres,sqlite}/` provide per-engine homes for future DDL and container definitions (currently empty)
## Layers
- Purpose: Store the canonical MySQL dump artifact
- Location: `data/quran.sql.zip`
- Contains: 4 tables — `surahs`, `ayahs`, `editions`, `ayah_edition`
- Consumed by: `convert_to_sqlite.py` (via `quran.sql` after unzip)
- Purpose: Transform the MySQL dump into an improved SQLite schema
- Location: `convert_to_sqlite.py` (repo root)
- Contains: SQLite DDL, streaming INSERT parser, value coercion, lookup data
- Depends on: `quran.sql` on disk; `sqlite3` stdlib module
- Used by: CLI invocation `python3 convert_to_sqlite.py`
- Purpose: Deliverable databases for consumers
- Location: `quran.db.gz` (compressed SQLite), README documents the schema
- Contains: 6 tables, 2 views, 9 indexes (see schema section)
- Consumers: any SQLite client; the roadmap (`README.md:168-184`) targets future API/backend and frontend apps
- Purpose: Reserved structure for future work
- Location: `schema/*/schema.sql`, `docker/{mysql,postgres,sqlite}/{Dockerfile,install.sh}`, `docs/architecture.md`, `docker-compose.yaml`, `CONTRIBUTING.md`
- Contains: zero-byte placeholder files only
## Data Flow
### Primary Request Path — MySQL dump → SQLite database
## Schema (SQLite target)
| Table | Rows | Notes |
|-------|------|-------|
| `surahs` | 114 | `number`, `name_ar`, `name_en`, `name_en_translation`, `type` CHECK meccan/medinan |
| `juzs` | 30 | SQLite-only addition; `juz_number` UNIQUE, `start_ayah_id`, `end_ayah_id` |
| `hizbs` | 60 | SQLite-only addition; `juz_id` FK to juzs, ayah ranges |
| `ayahs` | 6,236 | FKs to surahs/hizbs/juzs, `sajda` CHECK 0/1, `page` |
| `editions` | 134 | `identifier` UNIQUE (e.g. `en.sahih`), `language`, `format`, `type` |
| `ayah_edition` | 835,624 | join table: `ayah_id`+`edition_id` FKs, `data` text, `is_audio` CHECK 0/1 |
## Key Abstractions
- Purpose: Yield `(table, columns, rows)` batches from a MySQL dump without loading it into memory
- Location: `convert_to_sqlite.py:175`
- Pattern: Python generator with a state machine (`in_insert` flag) tracking whether the parser is inside a multi-line INSERT VALUES clause; a regex `INSERT INTO \`([^\`]+)\` \((.*?)\) VALUES` (`convert_to_sqlite.py:182`) detects statement boundaries
- Purpose: Correctly split comma-separated SQL literals that may contain quoted strings with embedded commas and backslash escapes
- Location: `convert_to_sqlite.py:98`, `convert_to_sqlite.py:122`
- Pattern: character-by-character scan with `in_quotes` / `escape_next` flags; value coercion ordered NULL → quoted string → int → float → raw string; strips UTF-8 BOM (`\ufeff`)
- Purpose: Supply canonical juz/hizb divisions since they are not present in the MySQL dump
- Location: `convert_to_sqlite.py:244`
- Pattern: two static Python lists of tuples written via `executemany`
## Entry Points
- Location: `convert_to_sqlite.py:425-426` (`if __name__ == '__main__': convert()`)
- Triggers: `python3 convert_to_sqlite.py` run from repo root
- Responsibilities: full rebuild of `quran.db` from `quran.sql`
- Preconditions: `quran.sql` must exist next to the script (expected after `unzip data/quran.sql.zip`); input/output filenames are module constants `SQL_FILE = "quran.sql"`, `DB_FILE = "quran.db"` (`convert_to_sqlite.py:12-13`)
- `sqlite3 quran.db` or Python `sqlite3.connect("quran.db")` per `README.md:118-131`
- Example query pattern documented: `SELECT * FROM ayahs WHERE surah_id = 1` and `SELECT arabic, translation FROM ayah_with_translation WHERE surah_id = 1 AND language = 'en'`
## Architectural Constraints
- **Threading:** Single-threaded, sequential batch script. No concurrency, no worker pools. Bulk inserts rely on SQLite's `executemany` for speed (`convert_to_sqlite.py:369`).
- **Global state:** Module-level constants only: `SQL_FILE`, `DB_FILE` (`convert_to_sqlite.py:12-13`), `TABLE_ORDER` (`convert_to_sqlite.py:344`). No mutable singletons.
- **File layout coupling:** The script hardcodes relative filenames (`quran.sql`, `quran.db`) — it must run from the repo root with the unzipped dump present.
- **FK off during load:** `PRAGMA foreign_keys = OFF` during bulk insert (`convert_to_sqlite.py:357`) relies on `PRAGMA foreign_key_check` at the end for integrity verification (`convert_to_sqlite.py:376`).
- **Dump-order dependence:** `stream_inserts` only imports tables present in `TABLE_ORDER`; other tables in the dump are silently skipped (`convert_to_sqlite.py:364`).
- **Empty scaffolding:** `schema/`, `docker/`, `docs/`, `docker-compose.yaml`, `CONTRIBUTING.md` contain only zero-byte placeholders — no architecture exists there yet.
## Anti-Patterns
### Positional `VALUES (?,?,?,?)` inserts
### Single file with hardcoded seed data
## Error Handling
- Pre-run cleanup: existing `quran.db` is removed before rebuild (`convert_to_sqlite.py:350-351`)
- Integrity verification: `PRAGMA foreign_key_check` after re-enabling FKs (`convert_to_sqlite.py:376`) — errors surface as rows returned by the pragma
- No `try/except` blocks anywhere in the file; no logging beyond `print()` progress counters
- Row parse edge cases (e.g. continuation lines not ending in `)`/`);`) are silently skipped via bare `pass` (`convert_to_sqlite.py:210-212`)
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using edit, write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
