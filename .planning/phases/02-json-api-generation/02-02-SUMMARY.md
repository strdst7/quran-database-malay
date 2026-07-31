---
phase: 02-json-api-generation
plan: 02
subsystem: api
tags: [validation, json, jq, determinism, verification]

# Dependency graph
requires:
  - phase: 02-json-api-generation
    provides: generate_json_api.py, api/ artifacts (116 JSON files)
provides:
  - Green validation gate proving api/ artifacts are structurally correct, complete (6,236 verses), and consumer-ready for Phase 3 deploy
  - Verification evidence: validate report, jq consumer outputs, per-surah cross-check, size stats, determinism hashes, sidecar check, gitignore contract
affects: [Phase 3 deploy workflow, Phase 4 search UI, API-05 curl/jq consumer docs]

# Tech tracking
tech-stack:
  added: []
  patterns: [exit-code validation gate, byte-identical regeneration, independent consumer cross-check]

key-files:
  created: []
  modified: []

key-decisions:
  - "No source changes needed — all artifacts from plan 02-01 validate correctly on first pass"
  - "Independent Python per-surah cross-check confirmed 114/114 files with correct surah self-reference and sequenced ayah numbering summing to 6,236"
  - "Regeneration determinism proven via sha256 comparison of search.json + surahs.json across wipe-and-regenerate"

patterns-established:
  - "Validation gate pattern: --validate exits 0 only when all checks (114 files, 6,236 verses, 0 errors, id contiguity, key shape) pass — Phase 3 deploy gate"
  - "Independent cross-check pattern: consumer-level Python + jq checks verify generated output independently of the generator's own validator — catches shared-blindness defects"

requirements-completed: [API-01, API-02, API-03]

# Metrics
duration: 2min
completed: 2026-07-31
---

# Phase 2 Plan 2: Validate JSON API Output — All Checks Green

**Built-in --validate + independent consumer verification proves 116 JSON artifacts (114 surah files, search.json, surahs.json) are structurally correct, complete at 6,236 verses, byte-identical on regeneration, and consumer-ready for Phase 3 deploy.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-31T20:22:00Z
- **Completed:** 2026-07-31T20:24:00Z
- **Tasks:** 2
- **Files modified:** 0 (validation-only phase)

## Accomplishments

- Built-in `--validate` exits 0 with 0 errors, 114/114 surah files, 6,236 total verses — CI-ready exit code for Phase 3 deploy gate
- DB cross-check confirms 6,236 `ms.basmeih` rows in `quran.db`, matching the generated output exactly
- jq consumer queries (API-05 pattern) all pass: index completeness, 5-key schema, keyword filtering, raw Arabic output
- Independent per-surah cross-check confirms every surah file has correct self-referencing surah numbers, ayah sequences starting at 1, and sum total = 6,236
- Regeneration determinism: sha256 of `search.json` + `surahs.json` identical before/after `--generate` re-run — proven byte-identical
- No WAL sidecars after regeneration (`quran.db-wal`/`quran.db-shm` absent) — read-only connect contract holds
- All size constraints met: api/ total 3,503 KB (< 10 MB), search.json 3,213,062 bytes (< 4 MB)
- `api/` gitignored confirmed — `git check-ignore api/search.json` returns correctly

## Task Commits

No tracked source files were modified — this is a pure verification wave. Both tasks validated the artifacts produced by plan 02-01 without requiring any code changes.

1. **Task 1: Run built-in --validate and record the report** — PASSED (no changes)
   - `--validate` exits 0, 0 errors, 114/114 files, 6,236 verses
   - DB cross-check: `db ms.basmeih rows: 6236`
2. **Task 2: Independent consumer verification, determinism, and evidence capture** — PASSED (no changes)
   - All jq consumer queries pass (length 6236, 5 keys, keyword filter, Arabic text)
   - Per-surah cross-check: OK at 6,236 total
   - Regeneration determinism: sha256 before/after identical
   - No WAL sidecars, gitignore contract holds

## Verification Evidence

### Built-in --validate Report (Task 1)

```
Validating API output: api
  surah files checked: 114/114
  total verses: 6236
  errors: 0
Done!
```

### DB Cross-Check (Task 1)

```
db ms.basmeih rows: 6236
DB cross-check OK
```

### jq Consumer Queries (Task 2)

**Index completeness:**
```
$ jq -e 'length == 6236' api/search.json
true
```

**5-key schema check:**
```
$ jq -e '.[0] | keys | length == 5' api/surah/1.json
true
```

**Keyword filter (API-05 pattern):**
```
$ jq -c '.[] | select(.malay | contains("pembalasan")) | {surah, ayah, malay}' api/search.json
{"surah":6,"ayah":2,"malay":"Dia lah yang menciptakan kamu dari tanah..."}
{"surah":11,"ayah":26,"malay":"\"Iaitu janganlah kamu menyembah melainkan Allah..."}
... (20 total matches across the Quran)
```

**Raw Arabic output (surah 1, ayah 1):**
```
$ jq -r '.[0] | .arabic' api/surah/1.json
بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
```

### Independent Per-Surah Cross-Check (Task 2)

```
per-surah cross-check OK: 6236
```

### Size Statistics

| Artifact | Size | Constraint |
|----------|------|------------|
| `api/search.json` | 3,213,062 bytes (~3.1 MB) | < 4 MB ✓ |
| `api/surahs.json` | 17,119 bytes (~16.7 KB) | — |
| `api/surah/2.json` (largest) | 235,299 bytes (~229.8 KB) | — |
| `api/surah/103.json` (smallest) | 736 bytes | — |
| `api/` total | 3,503 KB (~3.4 MB) | < 10 MB ✓ |
| Total files | 116 (114 surah + search.json + surahs.json) | — |

### Regeneration Determinism (Task 2)

```
SHA256 before regeneration:
  a18aa3c9... search.json
  921dfd6b... surahs.json

SHA256 after regeneration:
  a18aa3c9... search.json
  921dfd6b... surahs.json

DETERMINISM: identical ✓
```

### Sidecar & Gitignore Checks

- No `quran.db-wal` or `quran.db-shm` after regeneration ✓
- `git check-ignore api/search.json` returns `api/search.json` ✓
- `git status --short` shows no `api/` entries ✓

## Threat Mitigations Verified

All threat mitigations from the plan's STRIDE register are confirmed:

- **T-02-01** (completeness): D-17/D-18 `--validate` exits 0 — 114/114 files, 6,236 verses, 0 errors ✓
- **T-02-02** (stale artifacts): D-09 wipe-and-regenerate byte-stable — sha256 before/after identical ✓
- **T-02-03** (DB integrity): `mode=ro` connect — no WAL sidecars after regeneration ✓
- **T-02-04** (per-surah contents): Independent cross-check — every file has correct self-referencing surah number, ayah sequence from 1, total 6,236 ✓
- **T-02-05** (search.json drift): `jq -e 'length == 6236'` + `pembalasan` keyword probe returns real Malay text ✓
- **T-02-06** (disclosure): Accepted — public-domain Quran data, intentionally public

## Deviations from Plan

None — plan executed exactly as written. All checks passed on first attempt with no code changes required.

## Issues Encountered

None — validation ran green on first pass against the artifacts produced by plan 02-01.

## Requirements Satisfied

- **API-01:** All 114 per-surah files validated — exist, parse as JSON, hold exactly their surah's verses with correct self-referencing surah numbers (independently cross-checked) ✓
- **API-02:** Every verse has exactly 5 keys (`arabic`, `malay`, `surah`, `ayah`, `id`) with non-empty text; Arabic renders raw (jq output confirms no `\u` escapes) ✓
- **API-03:** `search.json` holds all 6,236 ayahs with ids contiguous 1–6236; keyword filtering works (jq `pembalasan` probe returns 20 results) ✓

## Phase Gate Status

**GREEN** — Full validation suite passes per 02-VALIDATION.md:
```
$ python3 generate_json_api.py --generate && python3 generate_json_api.py --validate && jq -e 'length == 6236' api/search.json
```
All three commands exit 0. Ready for Phase 3 deploy workflow.

## Next Phase Readiness

- `api/` artifacts are structurally validated, byte-stable, and consumer-ready
- Phase 3 (GitHub Pages deploy) can safely deploy `api/` as-is — no regeneration needed unless `quran.db` changes
- Phase 4 (browser search UI) can consume the exact same schema validated here
- No blockers or concerns

---
*Phase: 02-json-api-generation*
*Completed: 2026-07-31*
