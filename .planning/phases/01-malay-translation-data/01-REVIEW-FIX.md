---
phase: 01-malay-translation-data
fixed: 2026-07-31T15:00:00Z
source: 01-REVIEW.md
fixes_applied: 2
fixes_skipped: 0
warnings_fixed: 2
info_addressed: 0
status: fixed
---

# Phase 01: Review Fix Report

**Source:** 01-REVIEW.md (2026-07-31T06:50:00Z, standard depth)

## Fixes Applied

### WR-01: Missing explicit transaction boundary

**File:** `add_malay_translation.py:137-232`

Wrapped all database mutations in `cmd_insert` in an explicit `BEGIN`/`COMMIT`/`ROLLBACK` transaction `try/except/finally` block:

- `db.execute("BEGIN")` starts an explicit transaction before any mutation
- Skip path (`existing and not args.force`) now calls `db.rollback()` before returning
- Error path (`len(ayah_map) != EXPECTED_AYAHS`) now calls `db.rollback()` before returning
- `except (sqlite3.Error, ValueError)` catches failures mid-transaction and issues `db.rollback()`
- `finally: db.close()` ensures the connection is always closed
- `load_staged()` is now called before the DB connection, in its own try/except, so file-not-found doesn't leave an orphaned connection

### WR-02: Redundant validation loop

**File:** `add_malay_translation.py` (removed lines 201-208 of original)

Removed the O(n) per-record `ayah_map` lookup loop that could never trigger for valid data (since `validate_records` already guarantees records 1..6236 and the count check ensures `ayah_map` has 6,236 keys). Consolidated into the single correct check with an accurate error message that identifies the database as the source of the problem rather than misleadingly blaming the staged file.

## Verification

- `python3 -m py_compile add_malay_translation.py` — passes
- `python3 add_malay_translation.py --insert` — skip guard still works, prints correct message
- `python3 add_malay_translation.py --insert --force` — 6,236 rows inserted, FK check 0 errors
- Full integrity suite (DB-vs-staged, 134 editions, FK check) — ALL INTEGRITY CHECKS PASSED

## Skipped

- IN-01 (fixed retry delay): out of scope for warning fix pass
- IN-02 (no progress output): out of scope
- IN-03 (dead `or '.'` fallback): out of scope
- IN-04 (broad `except Exception`): out of scope
- IN-05 (unused `args` in `cmd_fetch`): out of scope

---

_Fixed: 2026-07-31T15:00:00Z_
