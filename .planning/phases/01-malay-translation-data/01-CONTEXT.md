# Phase 1: Malay Translation Data - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

SQLite database contains the complete Basmeih Malay translation (all 6,236 ayahs) as edition `ms.basmeih`, without disturbing the 134 pre-existing editions. The Malay text is sourced from the public alquran.cloud API, staged as a committed data file, and inserted into the SQLite database by a new standalone script. Fetching, staging, and inserting happen in this phase; JSON API generation, Pages deployment, and the search UI are later phases.

</domain>

<decisions>
## Implementation Decisions

### Data staging & reproducibility
- **D-01:** Fetch once and commit the staged data as `data/ms.basmeih.json` (versioned artifact). DB builds always read from this file — offline, reproducible, and consistent with how `data/quran.sql.zip` and `quran.db.gz` are already committed.
- **D-02:** `data/ms.basmeih.json` is a flat JSON list of 6,236 objects `{"number": <global ayah number 1-6236>, "text": "<Malay>"}` — joins directly on the `ayahs.number` column; no nested per-surah structure.
- **D-03:** Fetch uses a single whole-Quran request `GET https://api.alquran.cloud/v1/quran/ms.basmeih` (returns all 6,236 ayahs) — no per-surah fan-out.
- **D-04:** Verification is offline: staged JSON is the fetch output; insert correctness is checked by comparing DB rows against the staged file (6,236 rows, no NULL text). No live re-fetch spot-check required.

### Script architecture
- **D-05:** New standalone script `add_malay_translation.py`. `convert_to_sqlite.py` is NOT modified — the proven ETL and the 134-edition baseline stay intact by construction.
- **D-06:** The script requires `quran.db` to already exist (produced by `convert_to_sqlite.py`) and fails with a clear message if missing. Explicit two-step pipeline: build DB, then add Malay.
- **D-07:** One script, two modes: `--fetch` (writes `data/ms.basmeih.json` from the API) and `--insert` (reads the staged file into `quran.db`). Each mode is independently runnable and re-runnable, mirroring roadmap plans 01-01 and 01-02.
- **D-08:** Python 3 stdlib only (urllib for the fetch), matching the repo's no-dependency constraint.

### Edition row metadata
- **D-09:** `editions` row uses API-verbatim metadata: `identifier='ms.basmeih'`, `language='ms'`, `name='Basmeih'`, `english_name='Abdullah Muhammad Basmeih'`, `format='text'`, `type='translation'` — matching the alquran.cloud edition object and the existing rows' native-name + English-name convention.
- **D-10:** Insert is idempotent via a skip-if-present guard: if `ms.basmeih` already exists in `editions`, the script prints a message and exits without inserting (an explicit force flag re-runs the insert). No schema changes, so duplicates are impossible without `--force`.

### Deliverable & dump policy
- **D-11:** After `--insert`, regenerate `quran.db.gz` (gzip the updated `quran.db`) and commit the updated artifact — the shipped SQLite database is the deliverable this phase targets.
- **D-12:** Malay stays SQLite-only. `data/quran.sql.zip` is NOT modified — the MySQL dump remains the untouched source of truth for the existing 134 editions.
- **D-13:** README updates (editions count 134→135, new build step, Malay query example) are deferred out of Phase 1.

### OpenCode's Discretion
- Exact fetch error/retry handling in `--fetch` mode
- `created_at`/`updated_at` values for the inserted rows (default: insert time)
- Exact verification report output format and exit codes
- Whether `--force` is a flag or an explicit subcommand option
- Gzip naming/steps for `quran.db.gz` regeneration

</decisions>

<specifics>
## Specific Ideas

- The staged JSON mirrors how the repo already treats data: commit the artifact, never require live network to rebuild.
- "Do no harm" to the existing pipeline: the 134-edition baseline must stay queryable with identical row counts (success criterion 3), which drove the standalone-script decision.
- The two script modes map 1:1 to the roadmap's two plans (01-01 stage, 01-02 insert).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope
- `.planning/REQUIREMENTS.md` §Malay Translation — MALAY-01..04 (MALAY-03 names alquran.cloud as the source), plus Out of Scope list
- `.planning/ROADMAP.md` §Phase 1 — goal, success criteria (editions row, 6,236 ayah_edition rows, 134 editions intact, spot-check), plan split 01-01/01-02
- `.planning/PROJECT.md` — Key Decisions table (ms.basmeih edition choice, API sourcing), Constraints (Python 3 stdlib, no new runtime deps for conversion), Context (Basmeih = "Tafsir Pimpinan Ar-Rahman")

### Schema & pipeline
- `convert_to_sqlite.py` — authoritative SQLite schema: `editions` table (:64-74), `ayah_edition` (:76-84), `ayahs` global `number` (:51-52), `convert()` orchestration (:347-422), index `idx_ayah_edition_lookup` (:94). MUST NOT be modified by this phase.
- `README.md` — current schema documentation and build steps (will be stale re: edition count until a later phase updates it)

### Data source (external)
- `https://api.alquran.cloud/v1/quran/ms.basmeih` — whole-Quran Malay fetch endpoint (returns all 6,236 ayahs; each ayah carries global `number`, `numberInSurah`, `text`)
- `https://api.alquran.cloud/v1/surah/1/ms.basmeih` — verified per-surah response shape (ayah fields, edition metadata object with name/englishName/format/type)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `convert_to_sqlite.py:15-95` (`create_sqlite_schema`): the `editions` and `ayah_edition` DDL the new script inserts into — read it to match column order and constraints
- `convert_to_sqlite.py:347-422` (`convert`): established milestone-print + verification pattern (row counts, foreign_key_check, DB size) to mirror for the insert mode's output
- `data/` directory: the home for the new committed artifact `data/ms.basmeih.json` (next to `quran.sql.zip`)

### Established Patterns
- Python 3 stdlib only; single-file scripts; module constants in `UPPER_SNAKE_CASE`; `snake_case` functions with one-line docstrings; `print(f"...")` progress messages (no logging framework)
- Parameterized inserts only (`?` placeholders + `executemany`) — never string-interpolated values
- Data artifacts are committed (`.gitignore` ignores `output/` only)

### Integration Points
- `ayah_edition` join: staged `number` ↔ `ayahs.number` (global ayah number, 1-6236); `edition_id` resolved by looking up the inserted `ms.basmeih` editions row
- `quran.db` is produced at repo root by `convert_to_sqlite.py` (deletes any existing DB first) — the insert mode consumes it afterward and re-gzips to `quran.db.gz`
- The `--fetch` mode writes into `data/`, consumed later by `--insert`; both are called by the executor in the roadmap's plan order

</code_context>

<deferred>
## Deferred Ideas

- README updates documenting ms.basmeih (editions 134→135, new build step, Malay query example) — future phase, not Phase 1

</deferred>

---

*Phase: 01-malay-translation-data*
*Context gathered: 2026-07-31*
