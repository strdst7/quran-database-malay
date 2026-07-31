---
title: Codebase Structure
date: 2026-07-31
focus: arch
---

# Codebase Structure

**Analysis Date:** 2026-07-31

## Directory Layout

```
quran-database-malay/
├── convert_to_sqlite.py   # Only executable source — MySQL dump → SQLite ETL
├── README.md              # Schema docs, setup, roadmap
├── quran.db.gz            # Pre-built SQLite artifact (~60 MB compressed, ~208 MB raw) — DO NOT decompress/scan
├── docker-compose.yaml    # EMPTY placeholder (0 bytes)
├── CONTRIBUTING.md        # EMPTY placeholder (0 bytes)
├── .gitignore             # Ignores output/ only
├── data/                  # Source artifacts
│   └── quran.sql.zip      # MySQL dump (~47 MB compressed, ~187 MB raw)
├── schema/                # DDL reference homes — all files EMPTY placeholders
│   ├── mysql/schema.sql
│   ├── postgres/schema.sql
│   └── sqlite/schema.sql
├── docker/                # Container definitions — all files EMPTY placeholders
│   ├── mysql/{Dockerfile,install.sh}
│   ├── postgres/{Dockerfile,install.sh}
│   └── sqlite/{Dockerfile,install.sh}
├── docs/
│   └── architecture.md    # EMPTY placeholder (0 bytes)
├── screenshots/           # 4 PNG screenshots of DB tables (2022)
└── .planning/             # GSD planning artifacts (codebase maps, phases)
```

## Directory Purposes

**Repo root:**
- Purpose: Holds the single source file and distributable database artifacts
- Contains: `convert_to_sqlite.py`, `quran.db.gz`, `README.md`, `docker-compose.yaml`, `CONTRIBUTING.md`, `.gitignore`
- Key files: `convert_to_sqlite.py` (the whole pipeline), `README.md` (schema + usage reference)

**`data/`:**
- Purpose: Source data artifacts
- Contains: `quran.sql.zip` — the canonical MySQL dump (unzip → `quran.sql` next to the script)
- Key files: `data/quran.sql.zip`

**`schema/`:**
- Purpose: Per-engine DDL reference files
- Contains: `mysql/schema.sql`, `postgres/schema.sql`, `sqlite/schema.sql` — all zero-byte placeholders created in commit `2882f0e`
- Note: The *actual* SQLite DDL lives in `convert_to_sqlite.py:15-95` (`create_sqlite_schema`); the real MySQL schema is embedded in the dump

**`docker/`:**
- Purpose: Per-engine container setup (mysql, postgres, sqlite)
- Contains: `Dockerfile` + `install.sh` per engine — all zero-byte placeholders
- Note: `docker-compose.yaml` at repo root is also a 0-byte placeholder

**`docs/`:**
- Purpose: Contributor documentation
- Contains: `architecture.md` — zero-byte placeholder (this map is the only architecture doc currently)

**`screenshots/`:**
- Purpose: Visual proof of DB tables (surahs, ayahs, editions, addons) from the original MySQL import
- Contains: 4 PNG files named with original macOS screenshot timestamps

## Key File Locations

**Entry Points:**
- `convert_to_sqlite.py:425-426`: `if __name__ == '__main__': convert()` — CLI entry for the full pipeline
- `quran.db.gz`: pre-built output, consumed by any SQLite client (see `README.md:118-131`)

**Configuration:**
- `convert_to_sqlite.py:12-13`: `SQL_FILE = "quran.sql"`, `DB_FILE = "quran.db"` — the only configuration, as module constants
- `.gitignore`: single rule `output/` (generated files dir)
- `docker-compose.yaml`: empty placeholder — no compose config yet

**Core Logic:**
- `convert_to_sqlite.py:15-95` — `create_sqlite_schema()` (DDL)
- `convert_to_sqlite.py:98-173` — `parse_sql_value()` / `parse_insert_row()` / `column_map()` (dump parsing)
- `convert_to_sqlite.py:175-241` — `stream_inserts()` (streaming generator)
- `convert_to_sqlite.py:244-341` — `populate_lookup_tables()` (juz/hizb seed data)
- `convert_to_sqlite.py:347-422` — `convert()` (orchestration)

**Testing:**
- None. No test files, no test framework, no `tests/` directory anywhere in the repo

**Documentation:**
- `README.md`: schema tables, MySQL/SQLite setup, Python usage examples, roadmap (Database Improvements / Data Expansion / API / Frontend), contributing guide, license

## Naming Conventions

**Files:**
- `snake_case.py` for scripts: `convert_to_sqlite.py`
- `SCREAMING_SNAKE` for the binary artifact with extension: `quran.db.gz`, `quran.sql.zip` (pattern: `<db>.<engine>.<ext>`)
- Per-engine dirs named after the engine: `mysql/`, `postgres/`, `sqlite/`

**Functions:**
- `snake_case` verbs describing the action: `create_sqlite_schema`, `stream_inserts`, `parse_insert_row`, `parse_sql_value`, `column_map`, `populate_lookup_tables`, `convert`

**Constants:**
- `UPPER_SNAKE_CASE` module constants: `SQL_FILE`, `DB_FILE`, `TABLE_ORDER` (`convert_to_sqlite.py:12-13,344`)

**Database schema:**
- Tables: lowercase plural nouns (`surahs`, `ayahs`, `editions`, `juzs`, `hizbs`; join table `ayah_edition`)
- Columns: lowercase `snake_case` (`number_in_surah`, `name_en_translation`, `start_ayah_id`, `is_audio`)
- Indexes: `idx_<table>_<column>` (`idx_ayahs_surah_id`, `idx_ayah_edition_lookup`)
- Views: descriptive `snake_case` (`surah_stats`, `ayah_with_translation`)
- SQL keywords UPPERCASE inside DDL strings (`CREATE TABLE`, `PRAGMA`, `REFERENCES`)

## Where to Add New Code

**New feature (e.g. Postgres export, rub table, pages table):**
- Primary code: `convert_to_sqlite.py` — add a new function alongside `create_sqlite_schema`/`populate_lookup_tables` and call it from `convert()`
- If a second engine export is added, the script should be split into `src/` modules (e.g. `src/parsers/`, `src/schema/`) — current single-file layout will not scale past one engine

**Schema/DDL changes:**
- Mirror the target DDL into `schema/<engine>/schema.sql` (currently empty — populate it rather than relying solely on the in-script DDL)

**Docker setup (roadmap `README.md:174`):**
- Fill in `docker/<engine>/Dockerfile` and `docker/<engine>/install.sh`; define services in the empty `docker-compose.yaml`

**Tests (currently absent):**
- Create `tests/` at repo root with fixtures; the parsing functions (`parse_insert_row`, `parse_sql_value`, `stream_inserts`) are pure and trivially unit-testable with small inline dump strings

**Documentation:**
- `docs/architecture.md` (empty — this analysis belongs there long-term), `CONTRIBUTING.md` (empty)

**Artifacts:**
- Input dumps → `data/`; generated outputs → `output/` (already gitignored); pre-built DB → repo root as `quran.db.gz`

## Special Directories

**`data/`:**
- Purpose: Versioned source artifacts (MySQL dump zip)
- Generated: No — committed source data
- Committed: Yes (`data/quran.sql.zip`, ~47 MB)

**`screenshots/`:**
- Purpose: Reference images of the original DB in a MySQL GUI
- Generated: No — historical documentation
- Committed: Yes

**`output/` (gitignored):**
- Purpose: Reserved for generated files (per `.gitignore`)
- Generated: Yes
- Committed: No — does not exist on disk yet

**`schema/`, `docker/`, `docs/`:**
- Purpose: Reserved scaffolding for future DDL, containers, and docs
- Generated: No
- Committed: Yes — as empty placeholders (commit `2882f0e` "chore: establish project structure")

---

*Structure analysis: 2026-07-31*
