---
phase: 01-malay-translation-data
plan: 01
subsystem: database
tags: [python, sqlite, quran, malay, translation, api-fetch, stdlib]

# Dependency graph
requires: []
provides:
  - "add_malay_translation.py — standalone two-mode script (--fetch / --insert) for Basmeih Malay translation pipeline"
  - "data/ms.basmeih.json — committed artifact of 6,236 {number, text} records fetched from alquran.cloud"
affects:
  - "01-02 — consumes add_malay_translation.py --insert and data/ms.basmeih.json to populate quran.db"
  - "Phase 2+ — JSON API generation and GitHub Pages deployment depend on ms.basmeih being in the DB"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single stdlib script with two mutually-exclusive CLI modes (--fetch / --insert)"
    - "Fetch-once-commit-forever: network-dependent step produces a versioned artifact, all subsequent builds are offline"
    - "Parameterized SQL via executemany with ? placeholders (repo convention)"
    - "Idempotent insertion via skip-if-present guard + --force for re-insert"
    - "Verification report pattern (row counts, foreign_key_check, DB size) mirroring convert_to_sqlite.py"

key-files:
  created:
    - "add_malay_translation.py — 283 lines, Python 3 stdlib only, implements fetch + insert modes"
    - "data/ms.basmeih.json — 24,946 lines, 6,236 JSON records with {number, text} for every Quran ayah"

key-decisions:
  - "Single whole-Quran API request (not per-surah fan-out) for fetch efficiency and atomicity"
  - "Staged file uses global ayah numbers 1..6236 (joining on ayahs.number) rather than surah-relative"
  - "Edition metadata uses API-verbatim values (identifier, language, name, english_name, format, type)"
  - "Insert idempotency via skip guard + --force, no schema changes (D-10)"
  - "Exit codes: 0 = success/skip, 1 = any error, 2 = invalid invocation"

patterns-established:
  - "Offline artifact pattern: network fetch → validate → commit → never re-fetch (mirrors data/quran.sql.zip)"
  - "Standalone script pattern: new pipeline steps add independent scripts, never modify convert_to_sqlite.py"

requirements-completed: [MALAY-01, MALAY-03]

# Metrics
duration: 5min
completed: 2026-07-31
---

# Phase 01 Plan 01: Stage Basmeih Translation Summary

**Fetch-once pipeline: 6,236-ayah Basmeih Malay translation fetched from alquran.cloud, validated for contiguity and non-emptiness, committed as a versioned JSON artifact alongside a reusable two-mode (fetch/insert) stdlib-only Python script.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-31T06:40:00Z
- **Completed:** 2026-07-31T06:44:56Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created `add_malay_translation.py` — a complete Python 3 stdlib-only script with `--fetch` mode (GET whole-Quran API → validate 6,236 records → write staged JSON) and `--insert` mode (read staged file → parameterized insert into editions/ayah_edition tables → verification report). Features fetch retry logic (3 attempts), idempotent skip-if-present guard, `--force` re-insert, and exit code contracts (0/1/2).
- Fetched and committed `data/ms.basmeih.json` — 6,236 `{"number": 1..6236, "text": "<Malay>"}` records, byte-identical to the live alquran.cloud response (spot-checked ayahs 1, 148, 6236). All 6,236 numbers are contiguous, every text field is non-empty.
- Established the offline artifact pattern: fetch once, commit the artifact, never require live network to rebuild — consistent with how `data/quran.sql.zip` is already handled.

## Task Commits

Each task was committed atomically:

1. **task 1: Create add_malay_translation.py with both modes** — `5d87692` (feat)
2. **task 2: Run --fetch, validate staged file, commit** — `f7b979b` (feat)

## Files Created/Modified

- **`add_malay_translation.py`** (created, 283 lines) — Standalone script with `--fetch` and `--insert` modes. Functions: `fetch_basmeih()`, `extract_records()`, `validate_records()`, `load_staged()`, `cmd_fetch()`, `cmd_insert()`, `main()`. Module constants for API URL, file paths, edition metadata, retry config. Parameterized SQL via `executemany` with `?` placeholders.
- **`data/ms.basmeih.json`** (created, 24,946 lines) — Flat JSON array of 6,236 `{number, text}` objects sorted by global ayah number. Validated: contiguous 1..6236, all non-empty text, no extra keys.
- **`.gitignore`** (modified) — Added `__pycache__/` pattern for Python bytecode generated during verification.

## Decisions Made

None — followed plan exactly as specified. All implementation decisions (D-01 through D-13) were pre-determined in the phase context.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `__pycache__/` to `.gitignore`**
- **Found during:** task 2 (post-commit cleanup)
- **Issue:** `__pycache__/` directory appeared as untracked after running `python3 -m py_compile` during verification. `.gitignore` only covered `output/`.
- **Fix:** Added `__pycache__/` pattern under `# Python` section in `.gitignore`.
- **Files modified:** `.gitignore`
- **Verification:** `git status` no longer shows `__pycache__/` as untracked.

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical)
**Impact on plan:** Minimal — cosmetic housekeeping for Python project hygiene. No scope creep.

## Issues Encountered

None — both tasks executed cleanly on first attempt. Fetch succeeded on first try (no retries needed). Staged file passed all validation assertions.

## User Setup Required

None — no external service configuration required. The `--fetch` mode works with the public alquran.cloud API (no auth needed). The `--insert` mode works against the local `quran.db`.

## Next Phase Readiness

- `add_malay_translation.py --insert` is ready for plan 01-02 to populate `quran.db` with the ms.basmeih edition
- `data/ms.basmeih.json` is committed and available for offline DB builds
- `convert_to_sqlite.py` unmodified — 134-edition baseline intact

---

*Phase: 01-malay-translation-data*
*Plan: 01*
*Completed: 2026-07-31*
