---
title: Architecture
date: 2026-07-31
focus: arch
---

<!-- refreshed: 2026-07-31 -->
# Architecture

**Analysis Date:** 2026-07-31

## System Overview

This repository is a **data pipeline project**, not an application. It packages a
Quran dataset (Arabic text + 134 translations) as distributable database
artifacts. The only executable logic is a single Python script that converts a
MySQL dump into a normalized, indexed SQLite database. All other directories
(`schema/`, `docker/`, `docs/`) are **empty scaffolding placeholders** awaiting
contributors.

```text
┌──────────────────────────────────────────────────────────────────┐
│                        Source Data                                │
│   `data/quran.sql.zip`  (MySQL dump, ~187 MB uncompressed)        │
│   tables: surahs, ayahs, editions, ayah_edition                   │
└───────────────────────────────┬──────────────────────────────────┘
                                │ unzip → quran.sql
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Conversion Pipeline                            │
│   `convert_to_sqlite.py` (Python 3, single-file, stdlib-only)     │
│   stream_inserts() → parse_insert_row() → parse_sql_value()       │
│   + create_sqlite_schema() + populate_lookup_tables()             │
└───────────────────────────────┬──────────────────────────────────┘
                                │ python3 convert_to_sqlite.py
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Output Artifacts                               │
│   `quran.db`  (SQLite, ~208 MB) → compressed → `quran.db.gz`      │
│   6 tables + 2 views + 9 indexes (see schema section)             │
└──────────────────────────────────────────────────────────────────┘
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

**Overall:** Single-file batch ETL pipeline (Extract → Transform → Load) with a
streaming line parser. No framework, no third-party dependencies — only the
Python 3 standard library (`sqlite3`, `re`, `os`, `pathlib`).

**Key Characteristics:**
- Memory-bounded streaming: the MySQL dump is read line-by-line via a generator, never loaded whole (`convert_to_sqlite.py:184`)
- Schema enrichment during load: the SQLite schema adds FK constraints, CHECK constraints, indexes, lookup tables, and views that the source MySQL dump lacks
- MySQL dump compatibility: a hand-rolled parser handles multi-line `INSERT` statements with quoted/escaped values (`\n`, `\r`, `\t`, `\'`, `\"`, `\\`, BOM)
- One-shot deterministic run: existing `quran.db` is deleted and rebuilt on each invocation (`convert_to_sqlite.py:350`)
- Multi-engine distribution intent: `schema/{mysql,postgres,sqlite}/schema.sql` and `docker/{mysql,postgres,sqlite}/` provide per-engine homes for future DDL and container definitions (currently empty)

## Layers

**Source Data Layer:**
- Purpose: Store the canonical MySQL dump artifact
- Location: `data/quran.sql.zip`
- Contains: 4 tables — `surahs`, `ayahs`, `editions`, `ayah_edition`
- Consumed by: `convert_to_sqlite.py` (via `quran.sql` after unzip)

**Conversion Pipeline Layer:**
- Purpose: Transform the MySQL dump into an improved SQLite schema
- Location: `convert_to_sqlite.py` (repo root)
- Contains: SQLite DDL, streaming INSERT parser, value coercion, lookup data
- Depends on: `quran.sql` on disk; `sqlite3` stdlib module
- Used by: CLI invocation `python3 convert_to_sqlite.py`

**Output Artifact Layer:**
- Purpose: Deliverable databases for consumers
- Location: `quran.db.gz` (compressed SQLite), README documents the schema
- Contains: 6 tables, 2 views, 9 indexes (see schema section)
- Consumers: any SQLite client; the roadmap (`README.md:168-184`) targets future API/backend and frontend apps

**Scaffolding Layer (empty placeholders):**
- Purpose: Reserved structure for future work
- Location: `schema/*/schema.sql`, `docker/{mysql,postgres,sqlite}/{Dockerfile,install.sh}`, `docs/architecture.md`, `docker-compose.yaml`, `CONTRIBUTING.md`
- Contains: zero-byte placeholder files only

## Data Flow

### Primary Request Path — MySQL dump → SQLite database

1. **Extract:** user unzips `data/quran.sql.zip` → `quran.sql` (see `README.md:133-137`)
2. **Bootstrap:** `convert()` removes any existing `quran.db`, connects via `sqlite3.connect(DB_FILE)`, and calls `create_sqlite_schema(db)` (`convert_to_sqlite.py:347-354`)
3. **Parse:** `stream_inserts('quran.sql')` regex-matches `INSERT INTO \`table\` (cols) VALUES` and yields batched rows; `parse_insert_row()` / `parse_sql_value()` coerce raw literals (`convert_to_sqlite.py:363`)
4. **Load:** for tables in `TABLE_ORDER = ['surahs', 'ayahs', 'editions', 'ayah_edition']` (`convert_to_sqlite.py:344`), rows are written with `executemany` while FK checks are temporarily OFF for speed and cross-referencing (`convert_to_sqlite.py:356-376`)
5. **Verify:** `PRAGMA foreign_key_check` is run, then committed (`convert_to_sqlite.py:375-379`)
6. **Enrich:** `populate_lookup_tables(db)` inserts 30 `juzs` and 60 `hizbs` rows with ayah ranges (`convert_to_sqlite.py:383`)
7. **Project:** two views are created — `surah_stats` (ayah counts per surah) and `ayah_with_translation` (joined ayah + edition translation) (`convert_to_sqlite.py:385-404`)
8. **Report:** prints row counts per table, sajdah count (15), juz count (30), hizb count (60), DB size (`convert_to_sqlite.py:408-419`)
9. **Package:** user compresses `quran.db` → `quran.db.gz` (pre-built artifact already committed)

**State Management:** No runtime state beyond the open `sqlite3.Connection` passed between helper functions. All lookup data (`juzs_data`, `hizbs_data`) is hardcoded in `convert_to_sqlite.py:246-339`, not read from the dump.

## Schema (SQLite target)

Defined in `create_sqlite_schema()` (`convert_to_sqlite.py:15-95`):

| Table | Rows | Notes |
|-------|------|-------|
| `surahs` | 114 | `number`, `name_ar`, `name_en`, `name_en_translation`, `type` CHECK meccan/medinan |
| `juzs` | 30 | SQLite-only addition; `juz_number` UNIQUE, `start_ayah_id`, `end_ayah_id` |
| `hizbs` | 60 | SQLite-only addition; `juz_id` FK to juzs, ayah ranges |
| `ayahs` | 6,236 | FKs to surahs/hizbs/juzs, `sajda` CHECK 0/1, `page` |
| `editions` | 134 | `identifier` UNIQUE (e.g. `en.sahih`), `language`, `format`, `type` |
| `ayah_edition` | 835,624 | join table: `ayah_id`+`edition_id` FKs, `data` text, `is_audio` CHECK 0/1 |

**Views:** `surah_stats` (`convert_to_sqlite.py:386-395`), `ayah_with_translation` (`convert_to_sqlite.py:397-404`)
**Indexes:** `idx_ayahs_surah_id`, `idx_ayahs_juz_id`, `idx_ayahs_hizb_id`, `idx_ayahs_page`, `idx_ayahs_number_in_surah`, `idx_ayahs_sajda` (partial `WHERE sajda = 1`), `idx_ayah_edition_ayah`, `idx_ayah_edition_edition`, `idx_ayah_edition_lookup` (`convert_to_sqlite.py:86-94`)
**PRAGMAs:** WAL journal mode, foreign keys ON (except during bulk load), UTF-8 encoding

## Key Abstractions

**Streaming INSERT generator (`stream_inserts`):**
- Purpose: Yield `(table, columns, rows)` batches from a MySQL dump without loading it into memory
- Location: `convert_to_sqlite.py:175`
- Pattern: Python generator with a state machine (`in_insert` flag) tracking whether the parser is inside a multi-line INSERT VALUES clause; a regex `INSERT INTO \`([^\`]+)\` \((.*?)\) VALUES` (`convert_to_sqlite.py:182`) detects statement boundaries

**Quote-aware row/value parsers (`parse_insert_row`, `parse_sql_value`):**
- Purpose: Correctly split comma-separated SQL literals that may contain quoted strings with embedded commas and backslash escapes
- Location: `convert_to_sqlite.py:98`, `convert_to_sqlite.py:122`
- Pattern: character-by-character scan with `in_quotes` / `escape_next` flags; value coercion ordered NULL → quoted string → int → float → raw string; strips UTF-8 BOM (`\ufeff`)

**Hardcoded lookup seed data (`populate_lookup_tables`):**
- Purpose: Supply canonical juz/hizb divisions since they are not present in the MySQL dump
- Location: `convert_to_sqlite.py:244`
- Pattern: two static Python lists of tuples written via `executemany`

## Entry Points

**CLI script:**
- Location: `convert_to_sqlite.py:425-426` (`if __name__ == '__main__': convert()`)
- Triggers: `python3 convert_to_sqlite.py` run from repo root
- Responsibilities: full rebuild of `quran.db` from `quran.sql`
- Preconditions: `quran.sql` must exist next to the script (expected after `unzip data/quran.sql.zip`); input/output filenames are module constants `SQL_FILE = "quran.sql"`, `DB_FILE = "quran.db"` (`convert_to_sqlite.py:12-13`)

**SQLite consumers (read-only):**
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

**What happens:** Rows are inserted with `INSERT INTO {table} VALUES ({placeholders})` built from column count only (`convert_to_sqlite.py:366-367`), so column order is determined by the source dump's column spec, not the target schema.
**Why it's wrong:** Silent column mismatch would corrupt data if the dump column order ever diverges from the table definition.
**Do this instead:** Generate `INSERT INTO {table} ({columns}) VALUES (...)` using the parsed column names from `stream_inserts`, or insert by explicit named columns.

### Single file with hardcoded seed data

**What happens:** The juz/hizb lookup data (90 rows of Arabic names + ayah ranges) lives inline in Python lists (`convert_to_sqlite.py:246-339`).
**Why it's wrong:** Duplicates data that belongs in a SQL seed file; hard to review/maintain; the `schema/sqlite/schema.sql` file that should hold DDL is empty.
**Do this instead:** Move DDL to `schema/sqlite/schema.sql` and seed data to `schema/sqlite/seed.sql`, loaded by the script or the Docker image.

## Error Handling

**Strategy:** Minimal and process-oriented — the script is a one-shot batch tool, so failure surfaces as an uncaught exception (traceback) and partial `quran.db` state.

**Patterns:**
- Pre-run cleanup: existing `quran.db` is removed before rebuild (`convert_to_sqlite.py:350-351`)
- Integrity verification: `PRAGMA foreign_key_check` after re-enabling FKs (`convert_to_sqlite.py:376`) — errors surface as rows returned by the pragma
- No `try/except` blocks anywhere in the file; no logging beyond `print()` progress counters
- Row parse edge cases (e.g. continuation lines not ending in `)`/`);`) are silently skipped via bare `pass` (`convert_to_sqlite.py:210-212`)

## Cross-Cutting Concerns

**Logging:** Plain `print()` progress output — per-table row counts every 5000 rows (`convert_to_sqlite.py:371`) and a final summary of row counts, sajdah count, juz/hizb counts, and DB size in MB (`convert_to_sqlite.py:408-419`).
**Validation:** Constraint-driven — CHECK constraints on `surahs.type` and `sajda`/`is_audio` flags (`convert_to_sqlite.py:28,59,81`), NOT NULL on core columns, FK constraints between `ayahs`/`ayah_edition` and their parents, plus the final `foreign_key_check` pass.
**Authentication:** Not applicable — no network surface, no application runtime.

---

*Architecture analysis: 2026-07-31*
