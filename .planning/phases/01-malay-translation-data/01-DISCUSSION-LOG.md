# Phase 1: Malay Translation Data - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 1-Malay Translation Data
**Areas discussed:** Data staging & reproducibility, Script architecture, Edition row metadata, Deliverable & dump policy

---

## Data staging & reproducibility

| Option | Description | Selected |
|--------|-------------|----------|
| Commit staged JSON (Recommended) | Script fetches Malay once, writes data/ms.basmeih.json (committed), DB builds always read from that file | ✓ |
| Live-fetch each build | Fetch from API every run; no committed data file | |
| Fetch-if-missing cache | Use staged file if present, otherwise fetch and save | |
| Flat by global ayah number (Recommended) | Flat list of 6,236 objects {number, text}, joins on ayahs.number | ✓ |
| Nested per-surah | Mirrors API shape, needs flattening at insert | |
| Raw API responses | Verbatim 114 per-surah blobs | |
| DB vs staged file (Recommended) | Verify DB rows == staged file (6,236 count, no NULLs), offline deterministic | ✓ |
| Live spot-check re-fetch | Re-fetch random sample from live API and diff | |
| Both | Offline check always plus one-time live diff | |
| Whole-Quran single request (Recommended) | GET /v1/quran/ms.basmeih — one request, all 6,236 ayahs | ✓ |
| Per-surah requests | 114 requests, resumable but slower | |

**User's choice:** Commit staged JSON, flat by global ayah number, DB-vs-file verification, whole-Quran single fetch.
**Notes:** Reproducibility and offline rebuilds were the driving concerns; consistency with the repo's committed-artifact approach (quran.sql.zip, quran.db.gz).

---

## Script architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone add-malay script (Recommended) | New add_malay_translation.py; convert_to_sqlite.py untouched | ✓ |
| Integrate into convert_to_sqlite.py | Fold fetch/insert into the ETL; single entry point | |
| Orchestrator script | Runs convert then applies Malay | |
| Require existing quran.db (Recommended) | Script requires quran.db present, fails with clear message otherwise | ✓ |
| Auto-build if missing | Shells out to convert_to_sqlite.py if DB absent | |
| One script, two modes (Recommended) | --fetch stages JSON, --insert reads staged file into quran.db | ✓ |
| Two separate scripts | fetch_basmeih.py + add_malay_translation.py | |
| Single combined run | Always fetch then insert in one run | |

**User's choice:** Standalone script, requires existing quran.db, one script with two modes (--fetch / --insert).
**Notes:** "Do no harm" to the 134-edition baseline drove the separation; the two modes map 1:1 to roadmap plans 01-01 and 01-02.

---

## Edition row metadata

| Option | Description | Selected |
|--------|-------------|----------|
| API-verbatim (Recommended) | name "Basmeih", english_name "Abdullah Muhammad Basmeih" | ✓ |
| Full Malay title | name "Tafsir Pimpinan Ar-Rahman", english_name as API | |
| Skip-if-present guard (Recommended) | Skip insert if ms.basmeih exists; --force to re-run | ✓ |
| Delete-then-reinsert | Remove existing ms.basmeih rows before fresh insert | |
| Schema unique constraint | Add UNIQUE(ayah_id, edition_id), INSERT OR IGNORE | |

**User's choice:** API-verbatim metadata; skip-if-present guard with force flag.
**Notes:** Verbatim metadata makes spot-checks against alquran.cloud trivial and matches existing rows' native+English name convention.

---

## Deliverable & dump policy

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild quran.db.gz now (Recommended) | gzip updated quran.db and commit the shipped artifact | ✓ |
| Ship uncompressed DB only | Leave quran.db.gz untouched; conflicts with phase goal | |
| Defer gzip until later | Add staged data now, regenerate artifact later | |
| Keep Malay SQLite-only (Recommended) | data/quran.sql.zip untouched; Malay lives in SQLite via staged JSON | ✓ |
| Update MySQL dump too | Re-generate and commit the ~47 MB dump with ms.basmeih | |
| Update README (Recommended) | Document ms.basmeih, build steps, Malay query example | |
| Defer README updates | Ship without doc changes | ✓ |

**User's choice:** Rebuild quran.db.gz now; keep Malay SQLite-only; defer README updates.
**Notes:** The shipped SQLite database is the phase deliverable. README staleness (134→135 editions, build steps) recorded as a deferred idea.

---

## OpenCode's Discretion

- Fetch error/retry handling in --fetch mode
- created_at/updated_at values for inserted rows
- Verification report output format and exit codes
- Force-flag mechanics (flag vs subcommand option)
- gzip steps/naming for quran.db.gz regeneration

## Deferred Ideas

- README updates documenting ms.basmeih (editions 134→135, new build step, Malay query example) — future phase
