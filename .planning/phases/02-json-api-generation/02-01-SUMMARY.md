---
phase: 02-json-api-generation
plan: 01
subsystem: json-api
tags: [generator, json, api, stdlib, sqlite]
requires: [quran.db (Phase 1)]
provides: [generate_json_api.py, api/ (generated), .gitignore]
affects: [Phase 3 deploy contract (api/ layout), Phase 4 search UI]
tech-stack:
  added: [Python 3 stdlib (argparse, json, os, shutil, sqlite3, sys)]
  patterns: [two-mode argparse CLI, validate-wipe-write, read-only DB connect, single-pass generation]
key-files:
  created: [generate_json_api.py, api/surah/1.json..114.json, api/search.json, api/surahs.json]
  modified: [.gitignore]
decisions:
  - "Python 3 stdlib only — no third-party dependencies for JSON generation"
  - "Read-only sqlite3 connect (mode=ro URI) prevents DB modification and -wal/-shm sidecars"
  - "validate → wipe → write ordering (Pattern 3) — a failed invariant check leaves a previously-good api/ intact"
  - "single-pass generation: per-surah files and search.json share one query execution (D-05 drift prevention)"
metrics:
  duration: 2m13s
  completed_date: "2026-07-31T12:23:06Z"
  task_count: 2
  file_count: 2
---

# Phase 2 Plan 1: Static JSON API Generator Summary

**One-liner:** Created stdlib-only `generate_json_api.py` with `--generate`/`--validate` modes that reads `quran.db` read-only and produces 116 minified JSON artifacts (114 per-surah files + search.json + surahs.json) with verified 5-field verse schema.

## Tasks Completed

| task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create generate_json_api.py (both modes) and add api/ to .gitignore | `c5c83f7` | `generate_json_api.py` (created), `.gitignore` (modified) |
| 2 | Run --generate, verify output structure, commit | `23e5d49` | `generate_json_api.py` (bugfix) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed --validate surahs.json key order comparison**
- **Found during:** task 2
- **Issue:** `--validate` compared `sorted(s.keys())` (alphabetical) against `expected_keys` list in D-13 field order (not sorted), causing false "bad keys" error
- **Fix:** Changed `expected_keys` to alphabetical order `['ayah_count', 'name_ar', 'name_en', 'name_en_translation', 'number', 'type']`
- **Files modified:** `generate_json_api.py`
- **Commit:** `23e5d49`

## Verification Results

### Task 1 Verification
- `python3 -m py_compile generate_json_api.py` — passed
- No-args invocation prints usage and exits 2 — passed
- All grep pattern checks (22 checks) — passed
  - `mode=ro` + `uri=True` for read-only DB connect
  - `ensure_ascii=False` on all json.dump calls, no `indent`
  - `shutil.rmtree` + `os.makedirs` for wipe-and-regenerate
  - `add_mutually_exclusive_group` with `required=True`
  - No f-string SQL interpolation
- `.gitignore` contains `api/`; `git check-ignore api/search.json` confirms gitignore works
- `convert_to_sqlite.py`, `add_malay_translation.py`, `README.md` unmodified

### Task 2 Verification
- `python3 generate_json_api.py --generate` — exits 0, reports "Done!"
- `python3 generate_json_api.py --validate` — exits 0, 0 errors
- 116 JSON files total: 114 surah files + search.json + surahs.json
- `api/surah/2.json`: 286 verses, key order `[arabic, malay, surah, ayah, id]`, all `surah == 2`
- `api/search.json`: 6,236 verses, ids contiguous 1..6236, surah-major order confirmed
- `api/surahs.json`: 114 entries, numbers 1..114 in order
- No `\u` unicode escapes anywhere (raw Arabic UTF-8)
- No zero-padded filenames; exactly 114 files in `api/surah/`
- `git status --short` shows no `api/` entries
- `convert_to_sqlite.py`, `add_malay_translation.py`, `README.md` unmodified

## Threat Mitigations Verified

All threat mitigations from the plan's STRIDE register are implemented:
- **T-02-01** (invariant): D-16 — fail-hard `raise ValueError` on missing Arabic/Malay text BEFORE any wipe/write ✓
- **T-02-02** (stale files): D-09 — `shutil.rmtree(API_DIR)` + `os.makedirs` on every `--generate` ✓
- **T-02-03** (DB integrity): `sqlite3.connect(f'file:{DB_FILE}?mode=ro', uri=True)` only — no read-write connects ✓
- **T-02-04** (filenames): Surah numbers from DB INTEGER column, filename format `f'{n}.json'`, loops bounded to `range(1, 115)` ✓
- **T-02-05** (drift): D-05 single-pass accumulation — search.json and per-surah files share one generation pass ✓
- **T-02-06** (disclosure): Accepted — public-domain Quran data, intentionally public ✓

## Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Generator script | `generate_json_api.py` | 223 lines, committed |
| Gitignore update | `.gitignore` | `api/` added, committed |
| Generated API dir | `api/` | 116 files, gitignored (not committed) |

## Requirements Satisfied

- **API-01:** 114 per-surah files (`api/surah/1.json`..`api/surah/114.json`) generated ✓
- **API-02:** Every verse has exactly 5 keys (`arabic`, `malay`, `surah`, `ayah`, `id`) with non-empty text ✓
- **API-03:** `api/search.json` covers all 6,236 ayahs in global id order 1–6236 ✓
- **D-01..D-21:** All implementation decisions implemented per plan specification ✓

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/02-json-api-generation/02-01-SUMMARY.md`
- Commit `c5c83f7` (task 1) found in git log
- Commit `23e5d49` (task 2) found in git log
- Commit `cfbdbb1` (summary) found in git log
