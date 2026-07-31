---
title: Codebase Concerns
date: 2026-07-31
focus: concerns
---

# Codebase Concerns

**Analysis Date:** 2026-07-31

## Overview

This is a data-only repository containing a Quran database (MySQL dump + SQLite export) with one
conversion script (`convert_to_sqlite.py`). The repo is small (14 non-binary files, 2 of which
contain actual content) but ships ~108MB of committed binary data and a single un-tested,
un-versioned Python conversion script. The highest-risk areas are the parser in
`convert_to_sqlite.py` (silent data loss paths), the empty placeholder structure committed in
`2882f0e`, and the repo-size/drift problems caused by committing large binaries.

## Tech Debt

**Empty placeholder structure (commit `2882f0e` "chore: establish project structure"):**
- Issue: 14 files were committed at 0 bytes and remain empty — the structure claims capabilities that do not exist
- Files: `docs/architecture.md`, `schema/mysql/schema.sql`, `schema/postgres/schema.sql`, `schema/sqlite/schema.sql`, `docker/mysql/Dockerfile`, `docker/mysql/install.sh`, `docker/postgres/Dockerfile`, `docker/postgres/install.sh`, `docker/sqlite/Dockerfile`, `docker/sqlite/install.sh`, `docker-compose.yaml`, `CONTRIBUTING.md`
- Impact: README.md claims PostgreSQL support ("Support ~~PostgreSQL and~~ SQLite exports" marked done) and a Docker setup roadmap item, but `schema/postgres/schema.sql` and every `docker/*` file are empty; `docker-compose.yaml` is a 0-byte file. Contributors following the "Contributing" section in `README.md` find an empty `CONTRIBUTING.md`.
- Fix approach: Either fill these files (extract the DDL actually used by `convert_to_sqlite.py` into `schema/sqlite/schema.sql`, write a working `docker-compose.yaml` + Dockerfiles) or delete them and update `README.md` claims. Empty files that assert structure are worse than absent files.

**Schema defined in three places that drift:**
- Issue: The SQLite schema is hand-written inside `create_sqlite_schema()` in `convert_to_sqlite.py`, described again in `README.md` tables, and supposed to exist in `schema/sqlite/schema.sql` (empty). The README already diverges from the code.
- Files: `convert_to_sqlite.py` (lines 17–95), `README.md` (lines 13–95), `schema/sqlite/schema.sql`
- Impact: README surahs table omits the `number` column that exists in code; README marks "Add `rub` (quarter) divisions" as `[x]` done but no `rubs` table exists anywhere; README's ayah_edition row count (835,624) is a hardcoded claim that will silently go stale.
- Fix approach: Generate `schema/sqlite/schema.sql` from the code (or vice versa) and add a CI check that compares them; remove the `[x]` from unimplemented roadmap items.

**Hardcoded path coupling + broken README regenerate instructions:**
- Issue: `convert_to_sqlite.py` hardcodes `SQL_FILE = "quran.sql"` and `DB_FILE = "quran.db"` (lines 12–13), expecting `quran.sql` in the CWD. The only SQL source in the repo is `data/quran.sql.zip`, but README's regenerate instructions say `unzip quran.sql.zip` then `python3 convert_to_sqlite.py` — running those verbatim from the repo root fails because the zip is in `data/`.
- Files: `convert_to_sqlite.py` (lines 12–13), `README.md` (lines 133–137)
- Impact: The documented regeneration workflow does not work; users must discover the `data/` path themselves.
- Fix approach: Resolve paths relative to the script location (`Path(__file__).parent`), and update README with the actual commands.

**Dead code and redundancy in `convert_to_sqlite.py`:**
- Issue: `column_map()` (lines 169–172) is never called; BOM stripping in `parse_sql_value` (lines 107–109) is dead because the file is opened with `utf-8-sig` (line 184); `db.commit()` is called twice in a row (lines 377, 379); the `line.endswith(');\n')` branch (line 128) is dead after `rstrip('\n')` (line 186).
- Files: `convert_to_sqlite.py`
- Impact: Confusing to maintainers; the double-commit and dead branches suggest the script evolved without cleanup.
- Fix approach: Remove dead code and consolidate commits.

## Known Bugs

**Silent row loss on multi-line INSERT values:**
- Symptoms: When an INSERT row's content spans more than one line in a way that doesn't end in `);`, `),`, or a bare `(...)` line, the continuation branch is an empty `pass` — the row is silently dropped with no warning, and `table_counts` under-reports.
- Files: `convert_to_sqlite.py` lines 210–212 (`else: pass` in `stream_inserts`), lines 188–212
- Trigger: A MySQL dump line where a TEXT value contains a real (unescaped) newline inside quotes, or any row that doesn't match the three end-patterns checked
- Impact: Corrupt/incomplete Quran data with zero error signal — the worst failure mode for a data pipeline. The `ayah_edition` table has 835,624 rows in the README claim; any silent drop is undetectable without cross-checking against the source.
- Workaround: None — no verification step exists (see "foreign_key_check discarded" below).
- Fix approach: In the `else` branch, accumulate the line into the current row buffer and only finalize on a `)`-terminated line, or fail loudly (`sys.exit`) instead of `pass`. Add a row-count reconciliation at the end of `convert()`.

**`PRAGMA foreign_key_check` result discarded and run at the wrong time:**
- Symptoms: Line 376 executes `PRAGMA foreign_key_check` but never reads the returned rows. It also runs BEFORE `populate_lookup_tables()` (line 383) — at that point `juzs` and `hizbs` are empty, so every `ayahs.juz_id` / `ayahs.hizb_id` / `hizbs.juz_id` reference is a dangling FK that the check would (silently) report.
- Files: `convert_to_sqlite.py` lines 375–377, 383
- Impact: The "integrity check" is a no-op that gives false confidence; orphaned references survive into the shipped `quran.db.gz`.
- Fix approach: Run `PRAGMA foreign_key_check` after populating lookup tables, capture the result rows, and abort or warn if any violations are found.

**Progress-log condition is off-by-batch:**
- Symptoms: `if table_counts[table] <= len(rows) or table_counts[table] % 5000 == 0` (line 371) — `table_counts[table]` was already incremented by `len(rows)` on line 370, so the first clause is only true on the very first batch of each table. Intended behavior was likely "print first batch + every 5000 rows".
- Files: `convert_to_sqlite.py` lines 370–372
- Impact: Cosmetic only (misleading progress output), but indicates sloppy state handling.
- Fix approach: Track `prev_count` and print when `count - prev >= 5000` or first batch.

**Column-order coupling between dump and schema:**
- Symptoms: Line 367 builds `INSERT INTO {table} VALUES (?,...)` using the column COUNT from the MySQL dump's INSERT statement, with no column-name mapping and no check against the SQLite table's column list. If the dump's `ayahs` columns differ in count or order from the 12-column SQLite table definition, `executemany` raises or, worse, inserts data into wrong columns.
- Files: `convert_to_sqlite.py` lines 363–369
- Impact: The script only works if the undocumented external dump happens to match the hand-written schema column-for-column. Any upstream change to the dump silently breaks or corrupts the conversion.
- Fix approach: Read the table's column names via `PRAGMA table_info`, validate `columns` from the dump against them, and map by name.

## Security Considerations

**Dynamic SQL string interpolation:**
- Risk: `insert_sql = f"INSERT INTO {table} VALUES (...)"` (line 367) interpolates the table name captured by the regex on line 182 from the input SQL file. With the current trusted local file this is benign, but if the script is ever pointed at an untrusted dump, a crafted table name could inject SQL.
- Files: `convert_to_sqlite.py` lines 182, 367
- Current mitigation: Table names are validated against the allowlist `TABLE_ORDER` (line 344) before use — adequate today.
- Recommendations: Keep the allowlist check; do not add user-supplied file paths to this code path.

**No secrets exposure detected:**
- No `.env`, credential, or key files exist in the repo; no hardcoded passwords or tokens found in any tracked file. This is a clean baseline — preserve it.

**Repository hygiene of large binaries:**
- Risk: `quran.db.gz` (60,452,499 bytes) and `data/quran.sql.zip` (47,712,418 bytes) are committed to git. Any regenerated database becomes an unreviewable, unbounded binary diff; git clones and backups carry ~108MB of immutable data. Binary data is also the classic place secrets leak (e.g., an exported DB containing credentials) with no diff to catch it.
- Files: `quran.db.gz`, `data/quran.sql.zip`
- Current mitigation: `.gitignore` exists but only ignores `output/`
- Recommendations: Move release artifacts out of the repo (GitHub Releases / LFS), ignore `*.db`, `*.sql`, `*.gz`, `*.zip`, and `__pycache__/` in `.gitignore`, and regenerate the SQLite DB from the MySQL dump via CI instead of committing it.

## Performance Bottlenecks

**Single-threaded line-by-line Python parsing of a ~187MB dump:**
- Problem: `stream_inserts` reads and regex-matches every line of `quran.sql` in pure Python, character-by-character in `parse_insert_row` (lines 139–161) for ~840k+ rows. Expected runtime is on the order of many minutes to tens of minutes.
- Files: `convert_to_sqlite.py` lines 175–241
- Cause: No use of MySQL `LOAD DATA`-style fast paths; the parser is bespoke because the dump format wasn't trusted to tools like `mysqldump` → `sqlite3` converters.
- Improvement path: Add `PRAGMA synchronous = OFF` and `PRAGMA cache_size` during import (WAL is already on, line 18); batch commits every N rows instead of one giant implicit transaction; consider `temp_store = MEMORY`; or swap the parser for a tested third-party converter and keep this script only for the schema/views step.

**Destructive, non-atomic DB replacement:**
- Problem: Line 350–351 `os.remove(DB_FILE)` deletes an existing database with no confirmation, and the rebuild writes directly to the final filename. A crash or error mid-import (there is zero try/except in the script) leaves a truncated `quran.db` with no recovery path.
- Files: `convert_to_sqlite.py` lines 347–422
- Improvement path: Write to `quran.db.tmp` then `os.replace()` on success; wrap `convert()` in try/except that cleans up the temp file.

## Fragile Areas

**The custom MySQL-dump parser:**
- Files: `convert_to_sqlite.py` lines 98–241
- Why fragile: It hand-rolls quote/escape state tracking and only un-escapes `\' \" \\ \n \r \t` (line 105–106). MySQL dumps can legally contain `\0`, `\Z`, `\%`, `\_` escapes and 4-byte UTF-8 (emoji) which this parser mangles or silently drops (see "Silent row loss"). It is also line-oriented, which breaks on embedded newlines.
- Safe modification: Add escapes incrementally with round-trip tests against sample rows; never modify the state machine without fixtures covering quoted commas, escaped quotes, embedded newlines, and NULLs.
- Test coverage: None — there are no tests in the repository.

**The undocumented source dump contract:**
- Files: `data/quran.sql.zip` (source of truth), `convert_to_sqlite.py` (consumer)
- Why fragile: Everything depends on the exact column order, escaping style, and row-batching of an external dump the repo doesn't document or validate against. The compressed dump is 47MB; nobody can eyeball it.
- Safe modification: Record a canonical dump header/sample in `docs/` and add a `--check` mode that validates expected tables/columns before importing.
- Test coverage: None.

**`ayah_edition` join views:**
- Files: `convert_to_sqlite.py` lines 397–404 (`ayah_with_translation` view)
- Why fragile: The view joins `ayahs` → `ayah_edition` → `editions` with no filtering, so it emits up to 6,236 × 134 = 835,624 rows. Any consumer querying the view without a `WHERE surah_id`/`edition_id` filter materializes the full cross product — an easy performance trap for downstream apps (README itself shows `WHERE surah_id = 1` in `README.md` line 130, which limits correctly).
- Test coverage: None.

**CHECK-constraint case inconsistency:**
- Files: `convert_to_sqlite.py` line 28 (`type IN ('meccan','medinan','Meccan','Medinan')`)
- Why fragile: The constraint admits both case variants, so `surah_stats` consumers must handle mixed case; either normalize the data or enforce a single case.

## Scaling Limits

**Repository size:**
- Current capacity: Repo is ~108MB of committed binary artifacts + git history containing a moved 47MB zip (the `quran.sql.zip => data/quran.sql.zip` rename in `2882f0e` duplicates the blob's history weight).
- Limit: Every regeneration of `quran.db.gz` (208MB uncompressed) adds up to 60MB of new binary history; the repo is unbounded in growth.
- Scaling path: Move binaries out of git (Releases/LFS), ignore generated artifacts, generate in CI.

**Import throughput:**
- Current capacity: ~840k rows through a Python char-by-char parser (single-threaded).
- Limit: Linear in dump size; ~187MB dump means tens of minutes per run and no incremental rebuilds.
- Scaling path: Column-name-based mapping + batch commits + optional `synchronous=OFF`; or replace parser with a maintained converter.

## Dependencies at Risk

**No third-party runtime dependencies:**
- `convert_to_sqlite.py` uses only the Python 3 stdlib (`sqlite3`, `re`, `os`, `pathlib`) — nothing to pin or migrate. The risk is the reverse: zero dependency guardrails, so the parser's correctness is entirely hand-maintained.

## Missing Critical Features

**No verification/reconciliation:**
- Problem: Nothing asserts that the produced DB contains 114 surahs, 6,236 ayahs, 134 editions, 835,624 ayah_edition rows, or matches the source dump row counts. `convert()` only prints counts (lines 409–416) — it never compares them to expectations or to the dump.
- Blocks: Detecting silent parser data loss (see Known Bugs) and trusting the shipped `quran.db.gz`.

**No tests / no CI:**
- Problem: There is no test file, no test runner config, and no `.github/` workflows in the repo. The only logic-bearing file (`convert_to_sqlite.py`) has zero coverage, including for the parsing state machine that has known silent-failure branches.
- Files: repo root (absence of `.github/`, `tests/`, any `*.test.*`/`*.spec.*`)
- Blocks: Any refactor of the parser is unverifiable; the empty schema/docker placeholders can never be caught regressing.

**No LICENSE file:**
- Problem: `README.md` has a "License" section (line 221) claiming open-source with public-domain Quran text, but no `LICENSE` file exists in the repo — the actual license terms of the code and translations are undefined.
- Blocks: Downstream reuse decisions; contradicts the "open source" claim.

## Test Coverage Gaps

**The conversion pipeline (the only code):**
- What's not tested: `parse_sql_value` escape handling, `parse_insert_row` quote/escape state machine, `stream_inserts` multi-line INSERT handling (including the silent-drop branch), column-order mapping, FK integrity, view correctness.
- Files: `convert_to_sqlite.py` (whole file)
- Risk: Silent data loss and corrupted translations ship in the committed `quran.db.gz` with no detection.
- Priority: High

**Schema drift:**
- What's not tested: Consistency between `convert_to_sqlite.py` schema, `README.md` tables, and the (empty) `schema/sqlite/schema.sql`.
- Files: `convert_to_sqlite.py` lines 17–95, `README.md` lines 13–95, `schema/sqlite/schema.sql`
- Risk: Documentation and code disagree (already true today — `number` column, `rubs` table); empty schema files imply a contract that doesn't exist.
- Priority: Medium

---

*Concerns audit: 2026-07-31*
