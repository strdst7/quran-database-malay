# Phase 2: JSON API Generation - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

A generator script reads `quran.db` (which now contains the `ms.basmeih` Malay translation from Phase 1) and exports per-surah JSON files (`surah/1.json` through `surah/114.json`) plus a full `search.json` index covering all 6,236 ayahs. Each verse entry carries Arabic text, Basmeih Malay translation, and references (surah number, ayah number, global ayah id). Generation is offline from the SQLite DB with Python stdlib only. Deployment to GitHub Pages (Phase 3) and the browser search UI (Phase 4) are later phases.

</domain>

<decisions>
## Implementation Decisions

### Per-surah JSON schema
- **D-01:** Each surah file is a **flat JSON array** of verse objects (one per ayah) — not a wrapped object, not keyed by ayah number.
- **D-02:** Each verse object carries exactly **5 fields**: `arabic`, `malay`, `surah`, `ayah`, `id` (global ayah id 1–6236). `malay` matches the API-05 curl/jq example.
- **D-03:** JSON output is **minified/compact** (default `json.dump`), not pretty-printed — files are built once at deploy time for curl consumers.

### search.json index shape
- **D-04:** `search.json` is a **flat array of all 6,236 verse objects** using the **same 5-field schema** as per-surah files — one uniform API contract.
- **D-05:** `search.json` is **derived from the same generation logic** as the per-surah files (concatenation of per-surah arrays), so the two can never drift.
- **D-06:** Verses in `search.json` appear in **global ayah id order** (1–6236).

### Output layout & naming
- **D-07:** Generator writes into an **`api/` directory** (e.g. `api/surah/2.json`, `api/search.json`) so Phase 3 deploys `api/` as-is and the curl URL `/api/surah/2.json` matches the roadmap exactly.
- **D-08:** Per-surah files are named **`api/surah/<number>.json`** for numbers 1–114 (no zero-padding).
- **D-09:** Generator **wipes the `api/` directory** before regenerating (mirrors `convert_to_sqlite.py` deleting `quran.db` on rebuild) — prevents stale files.
- **D-10:** The generated `api/` files are **gitignored and built at deploy time** in GitHub Actions (Phase 3) — not committed, keeping the repo lean.

### Verse enrichment level
- **D-11:** Verse entries stay **minimal at the 5 required fields** — no juz/page/sajda metadata per verse.
- **D-12:** Surah-level metadata lives in a separate **`api/surahs.json`** flat array of all 114 surah objects.
- **D-13:** Each surah object in `api/surahs.json` carries the **full surahs table fields** (`number`, `name_ar`, `name_en`, `name_en_translation`, `type`, `ayah_count`), in **surah number order** (1–114).

### Script interface & CLI
- **D-14:** New standalone script **`generate_json_api.py`** — `convert_to_sqlite.py` and `add_malay_translation.py` are NOT modified.
- **D-15:** argparse CLI with **two modes**: `--generate` (read DB, write `api/`) and `--validate` (check generated output). Mirrors Phase 1's `--fetch`/`--insert` two-mode pattern; each mode independently runnable and CI-friendly.

### Built-in validation
- **D-16:** `--generate` asserts the **6,236-ayah invariant** (and fail-hard on any ayah missing Arabic/Malay text) before writing output.
- **D-17:** `--validate` reads the generated `api/` files back and checks: all 114 surah files exist, each parses as JSON with the correct shape, total verse count = 6,236, `search.json` complete.
- **D-18:** `--validate` prints a concise report (files checked, ayah count, any errors) and returns **exit code 0 on success, non-zero on any failure** — CI-friendly for the Phase 3 deploy workflow.

### DB prerequisites & pipeline order
- **D-19:** Generator reads the **existing `quran.db`** at repo root — it does not chain the build pipeline (does not run `convert_to_sqlite.py` or `add_malay_translation.py`).
- **D-20:** Before generating, it verifies `quran.db` exists AND contains `ms.basmeih` with 6,236 rows; fails with a clear "run `add_malay_translation.py --insert` first" error otherwise.
- **D-21:** Generator **queries the DB directly** — no cross-check against the staged `data/ms.basmeih.json` (already validated during Phase 1 insert).

### OpenCode's Discretion
- Exact verification report formatting and message text in `--validate`
- Error message wording for prerequisite failures
- Whether `--validate` also checks `api/surahs.json` (recommended: yes, 114 entries) in addition to the required checks
- Exact function structure and internal helpers within `generate_json_api.py`

</decisions>

<specifics>
## Specific Ideas

- "Minimal curl contract" theme: verse files stay at exactly the 5 required fields; consumers filter with `jq` (e.g. `jq '.[] | select(.malay | contains("..."))'`).
- The `api/` directory choice was driven by Phase 3's documented URL `/api/surah/2.json` — the generator output layout locks the public URL contract.
- Uniform schema across per-surah files, `search.json`, and `surahs.json` — one API shape consumers learn once.
- Repo convention respected: artifacts like `quran.db.gz` and `data/ms.basmeih.json` are committed, but generated deploy-time output (`api/`) is gitignored since Actions builds it.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope
- `.planning/REQUIREMENTS.md` §GitHub Pages API — API-01..05 (API-01/02/03 are this phase; API-05 documents the curl+jq pattern that drove the schema decisions)
- `.planning/ROADMAP.md` §Phase 2 — goal, success criteria (114 surah files, verse fields, search.json covering 6,236, Python stdlib only), plan split 02-01/02-02
- `.planning/PROJECT.md` — Key Decisions table (GitHub Pages + Actions-built JSON, per-surah files + search index, Arabic + Malay in every verse), Context (QuestUI design system for Phase 4)

### Schema & data source
- `quran.db` (repo root) — produced by Phase 1; `ayahs` table (Arabic in `text`, global `number`, `surah_id`, `number_in_surah`), `editions` table (`ms.basmeih` row, `id`), `ayah_edition` (Malay in `data` joined by `edition_id`), `surahs` table (metadata for `api/surahs.json`)
- `add_malay_translation.py` — Phase 1 script whose CLI pattern (`--fetch`/`--insert` two modes, argparse, prerequisite guard, verification report) this phase mirrors; MUST NOT be modified

### Established pipeline (read-only)
- `convert_to_sqlite.py` — existing ETL; the wipe-and-regenerate convention (deletes `quran.db` before rebuild) this phase mirrors for `api/`; MUST NOT be modified
- `.gitignore` — currently ignores `output/` only; Phase 2 adds `api/` (deploy-time build artifact)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `add_malay_translation.py` — the argparse two-mode CLI pattern (`--fetch`/`--insert`), prerequisite guard (`quran.db` exists → clear error), `print(f"...")` progress + verification report, `if __name__ == '__main__': sys.exit(main())` entry point. Model `generate_json_api.py`'s structure on it.
- `quran.db` at repo root — fully populated: `ms.basmeih` edition row present, 6,236 `ayah_edition` rows, 114 surahs, 6,236 ayahs.
- `data/ms.basmeih.json` — the staged Malay artifact (validated in Phase 1); not needed at generation time (D-21) but confirms data provenance.

### Established Patterns
- Python 3 stdlib only; single-file scripts; module constants in `UPPER_SNAKE_CASE`; `snake_case` functions with one-line docstrings; `print(f"...")` progress messages (no logging framework); parameterized SQL only.
- Two-step explicit pipeline: build DB → then operate on it (Phase 1 established `add_malay_translation.py` requires `quran.db` and fails clearly if missing).
- Wipe-and-regenerate determinism: `convert_to_sqlite.py` deletes `quran.db` on each run; the generator wipes `api/` the same way.

### Integration Points
- DB reads: `ayahs` JOIN `ayah_edition` (via `edition_id` → `editions.id` WHERE `identifier='ms.basmeih'`) for Arabic + Malay per verse; `surahs` table for `api/surahs.json`.
- Output contract for Phase 3: `api/` directory layout (`api/surah/<n>.json`, `api/search.json`, `api/surahs.json`) is the deploy input and the public URL structure (`/api/surah/2.json`).
- `.gitignore` gains `api/` so the deploy-time build artifacts stay out of git while `quran.db.gz`/`data/ms.basmeih.json` remain committed.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-json-api-generation*
*Context gathered: 2026-07-31*
