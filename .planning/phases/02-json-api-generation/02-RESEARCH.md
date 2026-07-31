# Phase 2: JSON API Generation - Research

**Researched:** 2026-07-31
**Domain:** Static JSON API generation from SQLite (Python stdlib)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | Per-surah JSON files generated (e.g. `/api/surah/2.json`), each containing all ayahs for that surah | Join path verified against live DB (see Summary); run-boundary grouping pattern (Pattern 1) writes exactly 114 files `api/surah/1..114.json`; prototype run produced 114/114 files with correct per-surah counts |
| API-02 | Each verse entry includes Arabic text, Basmeih Malay translation, and references (surah number, ayah number, global ayah id) | 5-field schema verified by prototype; `ensure_ascii=False` required for Arabic (Common Pitfall 1); `ayahs.id == ayahs.number` verified so global id is directly available; D-02 field order `arabic, malay, surah, ayah, id` preserved by dict insertion order |
| API-03 | Full search index (`search.json`) generated covering all 6,236 ayahs for keyword filtering | Single-pass accumulation (Pattern 1) appends every verse to `search.json`; prototype verified length 6,236 with ids contiguous 1–6236; `jq` filter pattern from API-05 verified working on output |

</phase_requirements>

## Project Constraints (from AGENTS.md)

Actionable directives extracted from `/root/quran-database-malay/AGENTS.md` — the planner MUST ensure every task complies:

1. **Python 3 stdlib only for the data pipeline — no new runtime deps for conversion** (Constraints: Tech stack). `generate_json_api.py` may import only stdlib modules (`argparse`, `json`, `os`, `shutil`, `sqlite3`, `sys`). [VERIFIED: repo]
2. **Hosting is GitHub Pages — static only, no server-side logic at request time** (Constraints: Hosting). Generator output must be pre-built files; D-07's `api/` layout feeds Phase 3's verbatim deploy. [VERIFIED: AGENTS.md]
3. **Build happens in GitHub Actions at deploy time** (Constraints: Build). `api/` is gitignored (D-10) and generated in CI — do not commit generated output. [VERIFIED: AGENTS.md]
4. **Responses must include original Arabic text alongside Malay** (Constraints: Data). Every verse object carries both `arabic` and `malay` (D-02). [VERIFIED: AGENTS.md]
5. **Conventions (CONVENTIONS.md):** module constants `UPPER_SNAKE_CASE`; `snake_case` functions with one-line docstrings; `print(f"...")` progress (no logging framework); parameterized SQL only (never string-interpolated values); single-quoted strings; 4-space indent; no type hints; Python 3.6+ compatible syntax. [VERIFIED: repo]
6. **Wipe-and-regenerate determinism:** `convert_to_sqlite.py` deletes `quran.db` on rebuild — the generator mirrors this for `api/` (D-09). [VERIFIED: convert_to_sqlite.py:350]
7. **Two-step explicit pipeline:** build DB → operate on it. `generate_json_api.py` never chains `convert_to_sqlite.py` / `add_malay_translation.py` (D-19), and fails clearly if `quran.db` is missing (D-20). [VERIFIED: repo]
8. **GSD workflow enforcement:** no direct repo edits outside GSD commands — all Phase 2 changes flow through `/gsd-plan-phase` → `/gsd-execute-phase`; research/planning artifacts committed per `commit_docs: true`. [VERIFIED: AGENTS.md]
9. **No third-party tools in the script:** the repo has no `requirements.txt`/`pyproject.toml`; Phase 2 must not introduce one (validation lives in the script's `--validate` mode, not a test framework). [VERIFIED: repo root listing]

## Summary

Phase 2 adds `generate_json_api.py`, a read-only generator that exports `quran.db` into three artifact groups: 114 per-surah files (`api/surah/<n>.json`), a full search index (`api/search.json`), and surah metadata (`api/surahs.json`). The data layer was verified directly against the live database: `ms.basmeih` exists (edition id 135, `language='ms'`, `format='text'`, `type='translation'`) with exactly 6,236 `ayah_edition` rows, and the join `ayahs.id = ayah_edition.ayah_id` with `editions.identifier = 'ms.basmeih'` returns Arabic (`ayahs.text`) + Malay (`ayah_edition.data`) for every ayah with zero missing rows [VERIFIED: live quran.db query]. A critical shortcut was confirmed: `ayahs.id == ayahs.number` for all 6,236 rows (0 mismatches), so the global `id` field in every verse object is simply `ayahs.id`, and `ORDER BY a.id` yields both global-id order and surah-major order [VERIFIED].

The generation design was validated with a working prototype run against the real DB: single `SELECT` with the join, iterated once in `ORDER BY a.id`; per-surah files written at surah-run boundaries; `search.json` accumulated in the same pass (satisfying D-05 — one generation path, no drift). The full run produced 116 JSON files in **0.27s** with **19 MB peak RSS**: `search.json` = 3,137.8 KB, `surahs.json` = 16.7 KB, surah files ranging 736 B (`103.json`) to 229.8 KB (`2.json`), total 6.14 MB — trivially within any GitHub Pages limit (Phase 3) and fine for browser fetch (Phase 4) [VERIFIED: prototype run, /tmp/opencode/api_proto]. The prototype's output passed all structural checks: 114 files, correct per-surah counts, exact 5-key shape, `search.json` ids contiguous 1–6236, surahs in number order [VERIFIED].

The script mirrors `add_malay_translation.py`'s established CLI contract: argparse with a mutually exclusive required mode group, prerequisite guard returning a clear error before any work, `print(f"...")` progress, and `sys.exit(main())` with 0/1/2 exit codes [VERIFIED: repo file]. Three implementation gotchas were verified empirically: (1) `json.dump` default `ensure_ascii=True` escapes all Arabic to `\uXXXX` — must pass `ensure_ascii=False` (Phase 1 already does this); (2) `sqlite3.connect()` on a missing file silently creates a 0-byte empty DB — the `os.path.exists` guard (D-20) plus `mode=ro` URI connect both mitigate; (3) default read-write connect on a WAL-mode DB recreates `-wal`/`-shm` sidecars — `mode=ro` URI avoids them entirely [VERIFIED: local behavior tests].

**Primary recommendation:** Single file `generate_json_api.py`, stdlib-only (`argparse`, `json`, `os`, `shutil`, `sqlite3`, `sys`), two modes `--generate`/`--validate`. Generation order inside `--generate`: prerequisite guard → single ordered query → build all data in memory (validate 6,236 invariant + non-empty text as it builds, per D-16) → wipe `api/` (D-09) → write everything. `--validate` reads files back, checks 114 existence + JSON shape + 6,236 total + search.json completeness (D-17), prints report, returns exit code (D-18). Use `ensure_ascii=False` everywhere; `os.makedirs('api/surah', exist_ok=True)`; add `api/` to `.gitignore` (D-10).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Verse retrieval (Arabic + Malay join) | Database / Storage | — | Read-only query against local `quran.db`; no network, no request-time processing |
| Per-surah JSON serialization | Build tooling (offline CLI) | — | Runs at build/deploy time (locally now, Actions in Phase 3); not a runtime tier |
| search.json index assembly | Build tooling (offline CLI) | — | Same generation pass as per-surah files (D-05) — concatenation in id order |
| Artifact serving (`/api/surah/2.json`) | CDN / Static | — | Phase 3: `api/` deployed verbatim to GitHub Pages; generator output *is* the URL contract |

**Note:** This phase is entirely offline build tooling. No browser, SSR, API-server, or CDN tier exists yet — the generator is the single producer and `api/` is the artifact boundary consumed by Phase 3 (deploy) and Phase 4 (browser fetch).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python 3 stdlib `sqlite3` | 3.13.5 (env); 3.6+ (floor) | Read `quran.db`, run the join query | Project constraint: stdlib only for the data pipeline; already the pattern in `convert_to_sqlite.py` / `add_malay_translation.py` [VERIFIED: repo + AGENTS.md] |
| Python 3 stdlib `json` | 3.13.5 | Serialize verse/surah objects; `json.load` in `--validate` | Stdlib; `ensure_ascii=False` proven by Phase 1's staged file; D-03 mandates default `json.dump` (no indent) |
| Python 3 stdlib `argparse` | 3.13.5 | Two-mode CLI (`--generate`/`--validate`) | Mirrors `add_malay_translation.py:247-274` exactly [VERIFIED: repo file] |
| Python 3 stdlib `os` / `shutil` / `sys` | 3.13.5 | Path checks (D-20 guard), `shutil.rmtree` wipe (D-09), `os.makedirs`, exit codes | Same module set as existing scripts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jq` (CLI) | 1.7 [VERIFIED: env] | Manual/ad-hoc verification of generated JSON (API-05 pattern) | Plan 02-02 spot checks and Phase 3 docs; NOT used by the script itself |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stdlib `json` + single-pass accumulation | `pandas` / `orjson` / streaming chunk writers | Constraint forbids third-party runtime deps; 19 MB peak RSS measured makes streaming unnecessary; `orjson` would only matter at 10×+ scale [VERIFIED: prototype RSS] |
| `sqlite3.connect(DB_FILE)` read-write | `sqlite3.connect(f'file:{DB}?mode=ro', uri=True)` | Read-write on a WAL DB recreates `-wal`/`-shm` sidecars; `mode=ro` avoids them and fails cleanly on a missing file — use `mode=ro` after the D-20 existence guard [VERIFIED: behavior test] |
| pytest (dev-only) | built-in `--validate` mode | pytest NOT installed in env (verified); adding it deviates from repo's zero-test-infra convention and needs discuss-phase sign-off — see Validation Architecture |

**Installation:** None. The project has no package manager metadata and the phase must not add any (`requirements.txt`/`pyproject.toml` do not exist; Phase 1 shipped with no deps) [VERIFIED: repo root listing].

**Version verification:** Python 3.13.5 + SQLite 3.46.x in environment; scripts target 3.6+ via f-strings (3.6) and dict insertion order (3.7+, needed for deterministic D-02 key order — see State of the Art). No npm/PyPI packages to pin [VERIFIED: `python3 --version`].

## Architecture Patterns

### System Architecture Diagram

```
                 ┌────────────────────────────────────────────────┐
                 │                generate_json_api.py           │
                 │                    (stdlib only)              │
                 │                                                │
 quran.db  ────► │  --generate                                    │
 (repo root)     │  1. guard: exists? ms.basmeih = 6,236? (D-20)  │
                 │  2. single SELECT ... ORDER BY a.id            │
                 │  3. build verses in memory (D-16 invariant)    │
                 │  4. wipe api/ (D-09)                           │
                 │  5. write api/surah/<n>.json ×114              │
                 │  6. write api/search.json (same pass, D-05/06) │
                 │  7. write api/surahs.json (D-12/13)            │
                 │                                                │
                 │  --validate                                    │
 api/ ─────────► │  1. 114 files exist? 2. shape? 3. 6,236 total? │
                 │  4. search.json complete? 5. report + exit     │
                 └───────────────┬────────────────────────────────┘
                                 │ api/ artifacts
                                 ▼
                 ┌─────────────────────────────────────────────┐
                 │ api/  (gitignored, D-10)                    │
                 │ ├── surah/1.json … surah/114.json           │
                 │ ├── search.json   (6,236 verses, 3.1 MB)    │
                 │ └── surahs.json   (114 surahs, 16.7 KB)     │
                 └─────────────────────────────────────────────┘
                                 │  Phase 3: deployed verbatim
                                 ▼
                 GitHub Pages: /api/surah/2.json  (curl contract, API-05)
```

### Recommended Project Structure
```
repo root/
├── generate_json_api.py   # NEW — Phase 2: --generate / --validate (stdlib only)
├── add_malay_translation.py   # Phase 1 — NOT modified (D-14)
├── convert_to_sqlite.py       # existing — NOT modified (D-14)
├── quran.db               # input (present locally, 219 MB, untracked in git)
├── quran.db.gz            # committed deliverable (Phase 3 CI unpacks this)
├── data/ms.basmeih.json   # staged artifact (NOT read by generator, D-21)
├── api/                   # NEW — generated output, gitignored (D-07/D-10)
│   ├── surah/1.json … 114.json
│   ├── search.json
│   └── surahs.json
└── .gitignore             # MODIFIED — add "api/" (D-10)
```

### Pattern 1: Single-Pass Run-Boundary Generation
**What:** One `SELECT` joining `ayahs`→`ayah_edition`→`editions` ordered by `a.id`; iterate once, accumulate the current surah's verses, write that surah's file when the surah id changes, and append every verse to the `search.json` list in the same pass. Requires the verified facts that `a.id` is globally contiguous and surahs occupy contiguous id runs (all 114 surahs verified gap-free) [VERIFIED: live DB + prototype].
**When to use:** This phase — it satisfies D-05 (single generation path), D-06 (id order), and the memory constraint simultaneously. Only ~19 MB peak RSS for all structures [VERIFIED: prototype].
**Example:** [Source: VERIFIED prototype /tmp/opencode/api_proto/proto_gen.py]

```python
cur = db.execute('''
    SELECT a.id, a.surah_id, a.number_in_surah, a.text, ae.data
    FROM ayahs a
    JOIN ayah_edition ae ON ae.ayah_id = a.id AND ae.edition_id = ?
    ORDER BY a.id
''', (edition_id,))
current_surah = None
current_verses = []
search_verses = []
for (aid, surah_id, ayah_no, arabic, malay) in cur:
    if not arabic or not malay:            # D-16 fail-hard on missing text
        raise ValueError(f'ayah {aid} missing text')
    verse = {'arabic': arabic, 'malay': malay,
             'surah': surah_id, 'ayah': ayah_no, 'id': aid}   # D-02 key order
    if surah_id != current_surah:
        if current_surah is not None:
            with open(os.path.join(API_DIR, 'surah', f'{current_surah}.json'),
                      'w', encoding='utf-8') as f:
                json.dump(current_verses, f, ensure_ascii=False)
        current_surah = surah_id
        current_verses = []
    current_verses.append(verse)
    search_verses.append(verse)            # D-05: same logic, no drift
# write last surah, then search.json (id order by construction), then surahs.json
```

### Pattern 2: Two-Mode CLI Mirrored from Phase 1
**What:** `argparse.ArgumentParser` with a mutually exclusive required group (`--generate` / `--validate`), module constants `UPPER_SNAKE_CASE` (`DB_FILE`, `API_DIR`, `EXPECTED_AYAHS = 6236`, `EDITION_IDENTIFIER = 'ms.basmeih'`), snake_case functions with one-line docstrings, `print(f"...")` progress, and `if __name__ == '__main__': sys.exit(main())` returning 0/1/2 [VERIFIED: `add_malay_translation.py:247-278`].
**When to use:** Mandated by D-15 (mirror Phase 1) and consistent with CONVENTIONS.md naming/logging rules.
**Example:** [Source: VERIFIED `add_malay_translation.py:247-274` structure, adapted]

```python
def main():
    """Parse arguments and dispatch to the selected mode."""
    parser = argparse.ArgumentParser(
        description='Generate static JSON API from quran.db'
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--generate', action='store_true',
                       help='Read quran.db and write api/')
    group.add_argument('--validate', action='store_true',
                       help='Check generated api/ output')
    args = parser.parse_args()
    if args.generate:
        return cmd_generate(args)
    elif args.validate:
        return cmd_validate(args)
    else:
        parser.print_usage(sys.stderr)
        return 2
```

### Pattern 3: Validate → Wipe → Write (D-16 before D-09)
**What:** Order the `--generate` steps so all data checks (prerequisite, 6,236 invariant, non-empty text) complete *before* `shutil.rmtree(API_DIR)` — a failed validation then leaves a previously-good `api/` intact instead of destroying it mid-generation.
**When to use:** Always in `--generate`; it is the literal reading of D-16 ("before writing output") and D-09 (wipe "before regenerating").
**Example:**
```python
# 1. guard (D-20)
if not os.path.exists(DB_FILE):
    print('quran.db not found. Run convert_to_sqlite.py first.')
    return 1
# 2. connect read-only, verify ms.basmeih count == 6236, load + check all verses
# 3. only now wipe and write:
shutil.rmtree(API_DIR, ignore_errors=True)
os.makedirs(os.path.join(API_DIR, 'surah'))
```

### Anti-Patterns to Avoid
- **Two generation paths (D-05 violation):** building `search.json` with a separate query or from the staged file — the two can drift. Accumulate in the single pass.
- **Pretty-printed output (`indent=2`):** D-03 locks minified; Phase 1's staged file used `indent=2` but that is a *staged artifact*, not API output.
- **Zero-padded filenames (`surah/001.json`):** D-08 locks `1.json`..`114.json`; Phase 3's URL contract depends on it.
- **Committing `api/`:** D-10 locks gitignore; the repo already keeps build outputs out (`output/` ignored, `quran.db` untracked).
- **Reading `data/ms.basmeih.json` at generation time:** D-21 locks DB-direct; the staged file was validated in Phase 1.
- **Hardcoding the edition id (135):** the `editions` table has a verified id gap (id 91 absent) — always look up by `identifier = 'ms.basmeih'` [VERIFIED: live DB].
- **Per-surah queries (N+1):** 114 queries + grouping in Python is slower and more code than one ordered query; measured prototype uses exactly one [VERIFIED: 0.27s total run].
- **Opening the DB with default connect on a possibly-missing file:** silently creates a 0-byte empty DB (verified) — use the existence guard + `mode=ro` URI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON serialization | Custom string writer / manual concatenation | stdlib `json.dump` / `json.load` | Hand-rolled writers break on escapes, Unicode, and `\u` handling; `json.dump(..., ensure_ascii=False)` verified to emit raw Arabic correctly |
| CLI parsing | Manual `sys.argv` inspection | `argparse` | Phase 1 pattern already established; argparse gives `--help`, usage errors with exit 2 for free |
| SQLite access / row iteration | Raw file parsing of the DB | stdlib `sqlite3` + SQL joins | The DB is a real SQLite file; the join path is verified; iteration over the cursor is memory-bounded |
| Directory wipe/creation | `os.remove` per file | `shutil.rmtree` + `os.makedirs` | `shutil.rmtree` handles arbitrary file counts; mirrors the `os.remove(DB_FILE)` determinism convention from `convert_to_sqlite.py:350` |

**Key insight:** Every problem in this phase has a stdlib answer that the repo already uses in `convert_to_sqlite.py` and `add_malay_translation.py`. The "don't hand-roll" discipline here is mostly *don't invent new conventions*: same constants style, same print-progress, same exit codes, same guard-first structure.

## Common Pitfalls

### Pitfall 1: Arabic text escapes to `\uXXXX` (unreadable, ~3–6× larger files)
**What goes wrong:** `json.dump` defaults to `ensure_ascii=True`, emitting `"\u0628\u0650\u0633\u0652..."` instead of `بِسْمِ...`.
**Why it happens:** Python's JSON module escapes non-ASCII by default for maximal compatibility.
**How to avoid:** Pass `ensure_ascii=False` to every `json.dump` in `--generate`. Phase 1 already does this (`add_malay_translation.py:127`). [VERIFIED: local behavior test — `json.dumps({'arabic': 'بِسْمِ'})` returns escaped form; `ensure_ascii=False` returns raw Arabic]
**Warning signs:** Output files contain `\u06` sequences; `wc -c search.json` > 5 MB.

### Pitfall 2: Silent 0-byte DB creation on missing file
**What goes wrong:** `sqlite3.connect('quran.db')` on a missing file *creates an empty DB* instead of erroring; the generator then fails with a confusing `no such table: editions` instead of the D-20 prerequisite message.
**Why it happens:** sqlite3's default open semantics create the file.
**How to avoid:** D-20's `os.path.exists(DB_FILE)` guard first (friendly message), and/or `sqlite3.connect(f'file:{DB_FILE}?mode=ro', uri=True)` which raises `sqlite3.OperationalError: unable to open database file` on missing files (verified) and cannot create anything. [VERIFIED: behavior test]
**Warning signs:** An empty `quran.db` appears after a failed run; errors mention `no such table`.

### Pitfall 3: WAL sidecar files (`quran.db-wal` / `quran.db-shm`) reappear
**What goes wrong:** `quran.db` has `journal_mode = WAL` (set by `convert_to_sqlite.py:18`). A default read-write connection recreates `-wal`/`-shm` files that Phase 1's `PRAGMA wal_checkpoint(TRUNCATE)` had cleaned up.
**Why it happens:** WAL is a persistent DB property; any read-write open initializes the sidecars.
**How to avoid:** Open with the `mode=ro` URI — verified to create no sidecars and to serve reads correctly. [VERIFIED: behavior test — no sidecars after ro connect]
**Warning signs:** `quran.db-wal` / `quran.db-shm` appear in `ls` after running the generator.

### Pitfall 4: Partial output on mid-run failure
**What goes wrong:** If a verse is missing Malay text and the script has already wiped `api/` and written some files, the deploy-ready directory is destroyed or half-written.
**Why it happens:** Wipe-before-write ordering combined with lazy data checks.
**How to avoid:** Pattern 3 — validate everything in memory first (D-16), wipe only after (D-09). Measured cost of building in memory first: ~19 MB RSS and 0.27s — negligible. [VERIFIED: prototype]
**Warning signs:** `api/` exists but `search.json` missing after a failed run.

### Pitfall 5: search.json drifting from per-surah files
**What goes wrong:** Two code paths (one for surah files, one for the index) diverge — e.g., different field sets, different ordering, different text.
**Why it happens:** Refactoring or "optimizing" the second path.
**How to avoid:** D-05's single-pass accumulation; `--validate` additionally asserts the relationship (total 6,236 both ways + id contiguity).
**Warning signs:** A verse found in `surah/2.json` is absent from `search.json`.

### Pitfall 6: Pretty-printing sneaking back in
**What goes wrong:** A reviewer "improves" readability with `indent=2`, doubling file sizes and violating the locked D-03 contract.
**How to avoid:** No `indent` argument; if truly-minified is desired, compact separators `(',', ':')` save only 1.9% over defaults (60.9 KB on search.json) — keep defaults per D-03's literal "(default json.dump)". [VERIFIED: measurement]
**Warning signs:** Files start with `[` followed by a newline + spaces.

## Code Examples

Verified patterns from the prototype run (all executed successfully against the real `quran.db`):

### Prerequisite Guard + Read-Only Connect (D-19/D-20)
```python
DB_FILE = 'quran.db'
API_DIR = 'api'
EXPECTED_AYAHS = 6236
EDITION_IDENTIFIER = 'ms.basmeih'

if not os.path.exists(DB_FILE):
    print('quran.db not found. Run convert_to_sqlite.py first.')
    return 1

db = sqlite3.connect(f'file:{DB_FILE}?mode=ro', uri=True)
row = db.execute(
    "SELECT COUNT(*) FROM ayah_edition ae "
    "JOIN editions e ON e.id = ae.edition_id "
    "WHERE e.identifier = ?", (EDITION_IDENTIFIER,)
).fetchone()
if row[0] != EXPECTED_AYAHS:
    db.close()
    print(f'ms.basmeih has {row[0]} rows, expected {EXPECTED_AYAHS}. '
          f'Run add_malay_translation.py --insert first.')
    return 1
edition_id = db.execute(
    "SELECT id FROM editions WHERE identifier = ?", (EDITION_IDENTIFIER,)
).fetchone()[0]
```
[Source: VERIFIED — pattern mirrors `add_malay_translation.py:139-141,155-158`; ro-URI behavior verified by test]

### The Core Join (Arabic + Malay per verse)
```python
cur = db.execute('''
    SELECT a.id, a.surah_id, a.number_in_surah, a.text, ae.data
    FROM ayahs a
    JOIN ayah_edition ae ON ae.ayah_id = a.id AND ae.edition_id = ?
    ORDER BY a.id
''', (edition_id,))
```
[Source: VERIFIED — executed against live DB; returns (id, surah_id, number_in_surah, Arabic, Malay) for all 6,236 rows with 0 missing]

### surahs.json Source Query (D-13)
```python
surahs = db.execute('''
    SELECT s.number, s.name_ar, s.name_en, s.name_en_translation,
           s.type, COUNT(a.id) AS ayah_count
    FROM surahs s JOIN ayahs a ON a.surah_id = s.id
    GROUP BY s.id ORDER BY s.number
''').fetchall()
# → [{'number': 1, 'name_ar': 'سورة الفاتحة', 'name_en': 'Al-Faatiha',
#     'name_en_translation': 'The Opening', 'type': 'Meccan', 'ayah_count': 7}, ...]
```
[Source: VERIFIED — live DB query + prototype output; `type` values observed: 'Meccan'/'Medinan']

### --validate Core Checks (D-17)
```python
errors = []
total = 0
for n in range(1, 115):
    path = os.path.join(API_DIR, 'surah', f'{n}.json')
    if not os.path.exists(path):
        errors.append(f'missing surah/{n}.json'); continue
    verses = json.load(open(path, encoding='utf-8'))
    for v in verses:
        if sorted(v.keys()) != ['arabic', 'ayah', 'id', 'malay', 'surah']:
            errors.append(f'{n}.json: bad keys'); break
        if not v['arabic'] or not v['malay']:
            errors.append(f'{n}.json: empty text'); break
    total += len(verses)
if total != EXPECTED_AYAHS:
    errors.append(f'total {total} != {EXPECTED_AYAHS}')
ids = [v['id'] for v in json.load(open(os.path.join(API_DIR, 'search.json'), encoding='utf-8'))]
if ids != list(range(1, EXPECTED_AYAHS + 1)):
    errors.append('search.json not complete (ids not contiguous 1..6236)')
```
[Source: VERIFIED — prototype validation passed with zero errors]

### Consumer Pattern to Verify With (API-05 / Phase 3 contract)
```bash
jq -c '.[] | select(.malay | contains("pembalasan")) | {surah, ayah, malay}' api/search.json
jq -c '.[0]' api/surah/1.json
```
[Source: VERIFIED — both jq commands executed successfully against prototype output]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ensure_ascii=True` default escaping | `ensure_ascii=False` for Arabic text | Phase 1 (`add_malay_translation.py:127`) | Arabic emitted as raw UTF-8; files human-readable and ~3–6× smaller |
| Pretty-printed staged artifact (`indent=2`) | Minified API output (no indent) | This phase, D-03 | Deploy-time files sized for curl consumers; ~1.9% more could be shaved with compact separators, not worth deviating from the locked decision |
| Committed data artifacts (`quran.db.gz`, `data/ms.basmeih.json`) | Gitignored deploy-time build (`api/`) | This phase, D-10 | Repo stays lean; CI builds at deploy (Phase 3) |
| Multiple queries / N+1 | Single ordered query + run-boundary writes | This phase (Pattern 1) | 0.27s full generation; deterministic id-order output |

**Deprecated/outdated:**
- `sqlite3.connect()` default file-creation behavior: don't rely on it for existence checks — it silently creates empty DBs (verified). Use `os.path.exists` + `mode=ro` URI.
- WAL-mode default connect: opens sidecars (`-wal`/`-shm`); prefer `mode=ro` for read-only tools.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding pytest as a *dev-only* dependency (if unit tests are wanted) would not violate the "no new runtime deps for conversion" constraint | Validation Architecture | If the user interprets the constraint as "no deps at all, ever", pytest must be dropped and `--validate` alone is the test strategy — low impact, easily confirmed in discuss |
| A2 | GitHub Pages serves repo-root `api/` at `/api/...` for a project site (Phase 3 deploys `api/` as-is) | Summary / Architecture Map | If the deploy source were `docs/` instead, `api/` would need relocating — but D-07 already locks the layout and the roadmap URL `/api/surah/2.json`; GitHub docs confirm repo-tree folders become URL paths [CITED: docs.github.com About GitHub Pages] |
| A3 | A 3.1 MB `search.json` parsed client-side in the browser is acceptable for Phase 4 search (fetch + filter) | Summary | If UI performance were a concern, search would need chunking — Phase 4's problem, not this phase's; 3.1 MB JSON.parse is well within normal browser budgets [ASSUMED] |
| A4 | The `editions` id gap (id 91 absent, 134 rows over ids 1–135) is a pre-existing data quirk, not a Phase 2 defect | Common Pitfall 5 note | No impact — the generator looks up `ms.basmeih` by `identifier`, never by id; verified Phase 1 left counts unchanged [VERIFIED: live DB] |

## Open Questions

1. **Compact separators vs default separators?**
   - What we know: D-03 says "minified/compact (default `json.dump`)". Default separators produce `{"a": 1, "b": 2}`; truly-minified needs `separators=(',', ':')` → `{"a":1,"b":2}`. Measured difference on search.json: 1.9% (60.9 KB of 3,137.8 KB) [VERIFIED].
   - What's unclear: whether the user's "minified" intent wants the strictly smallest form or just "not pretty-printed".
   - Recommendation: default `json.dump` (matches the locked parenthetical verbatim); note the 1.9% option in the plan as an optional micro-optimization. No discuss round needed — either satisfies the decision.

2. **Should `--validate` cross-check per-surah counts against the DB?**
   - What we know: D-17 lists file-based checks (existence, shape, 6,236 total, search.json complete); D-21 forbids cross-checking the *staged file*, not the DB. A DB cross-check (surah 2 must have 286 verses) would catch "file written from wrong data" bugs.
   - What's unclear: D-17's "reads the generated api/ files back" phrasing suggests file-only validation.
   - Recommendation: file-only checks are the D-17 baseline and keep `--validate` runnable without the DB (CI-friendly); optionally add an *expected-counts* table baked into the script (per-surah counts are static Quran facts) or a DB-backed check behind a flag. Planner should keep the required checks file-only.

3. **Should `--validate` also check `api/surahs.json`?**
   - What we know: CONTEXT's OpenCode's Discretion explicitly recommends yes (114 entries, number order, 6 required keys).
   - Recommendation: yes — it is cheap (one `json.load`, three assertions) and closes the loop on D-12/D-13. Already verified feasible in the prototype.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | Script runtime | ✓ | 3.13.5 | — (floor 3.6+ per repo conventions) |
| stdlib `sqlite3` / `json` / `argparse` | Script runtime | ✓ | bundled | — |
| `quran.db` (repo root) | Generation input | ✓ | 219 MB, present | Phase 1 artifacts (`quran.db.gz` + unpack in CI, Phase 3 concern) |
| `jq` | Manual verification (02-02) | ✓ | 1.7 | Python one-liners |
| `git` | Workflow/commits | ✓ | 2.47.3 | — |
| `sqlite3` CLI | (none — optional) | ✗ | — | Python `sqlite3` module (the script itself) |
| `pytest` | (only if unit tests added — A1) | ✗ | — | Built-in `--validate` mode |

**Missing dependencies with no fallback:** None — nothing required by the phase is absent. The `sqlite3` CLI absence is irrelevant (script uses the stdlib module).

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section included. Note: this repo has **zero** existing test infrastructure and no test framework installed (verified: no pytest, no test files, no CI config). The phase's validation *is* the script's `--validate` mode (plan 02-02), which is consistent with the repo's stdlib-only, script-embedded-verification convention (Phase 1 shipped the same way).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (built-in `--validate` mode of `generate_json_api.py`; stdlib only, exit-code contract) |
| Config file | none — no pytest.ini/pyproject.toml; do NOT add one without discuss sign-off (A1) |
| Quick run command | `python3 generate_json_api.py --validate` (precondition: `api/` generated) |
| Full suite command | `python3 generate_json_api.py --generate && python3 generate_json_api.py --validate && jq -e 'length == 6236' api/search.json` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | 114 per-surah files generated | integration | `--validate` file-existence loop (Plan 02-02) | ✅ built into plan 02-02 (`--validate` mode) |
| API-02 | Verse shape: exactly `{arabic, malay, surah, ayah, id}`, types, non-empty text | integration | `--validate` shape loop | ✅ built into plan 02-02 |
| API-03 | search.json covers 6,236, ids contiguous 1–6236 | integration | `--validate` count + id-order check | ✅ built into plan 02-02 |
| API-01/02/03 | End-to-end generation from DB | smoke | `python3 generate_json_api.py --generate` then full suite | ✅ in plan 02-01 |

### Sampling Rate
- **Per task commit:** `python3 generate_json_api.py --validate` (plan 02-02 checkpoint; plan 02-01 uses `--generate` + existence spot check)
- **Per wave merge:** Full suite command above
- **Phase gate:** Full suite green + `jq` spot queries on `api/search.json` and `api/surah/1.json` (verified commands in Code Examples) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `generate_json_api.py --validate` — the entire test surface for this phase; **must** include: 114-file existence, JSON-shape loop, 6,236 total, search.json id contiguity, surahs.json 114-check (OpenCode's discretion, recommended yes)
- [ ] No test framework — deliberate: matches repo convention. Optional pytest unit tests (pure helpers like the verse-shape checker) require user confirmation that a dev-only dep is acceptable (A1) — otherwise omit; `--validate` covers the phase

## Security Domain

> `security_enforcement` key absent from `.planning/config.json` — treated as enabled. Honest assessment: this phase has an **extremely small security surface** — no network, no user input, no secrets, no authentication, no request-time code. All data comes from a trusted local DB. The controls below are about **output integrity**, not threat resistance.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — no auth surface in a static-data generator |
| V3 Session Management | no | — no sessions |
| V4 Access Control | no | — no user roles or resources |
| V5 Input Validation | yes | Fixed output contract enforced by `--validate` shape checks (exact 5 keys, types, non-empty text); all values originate from a trusted local DB, not untrusted input |
| V6 Cryptography | no | — no secrets, no data-at-rest protection needed for public Quran data |

### Known Threat Patterns for {Python stdlib static generator}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale/partial artifacts deployed (old surah file outliving its siblings) | Tampering | D-09 wipe-before-regenerate + `--validate` gate run in Phase 3's deploy workflow before publish (D-18 exit codes) |
| Incomplete data shipped (ayah missing Malay) | Tampering | D-16 6,236-ayah invariant + non-empty text assertion, fail-hard before any write (Pattern 3) |
| Path traversal / unexpected filenames | Tampering | Not applicable — surah numbers come from DB `INTEGER` values (1–114), no user-controlled strings enter filenames; `--validate` existence loop is bounded to 1..114 |
| Silent DB corruption on write | Tampering | Generator is read-only (`mode=ro` URI); it cannot modify `quran.db` |

## Sources

### Primary (HIGH confidence) — verified in this session
- **Live `quran.db` (repo root)** — schema (6 tables + 2 views), `ms.basmeih` row (id 135, language 'ms'), 6,236 `ayah_edition` rows, `ayahs.id == ayahs.number` for all rows, contiguous per-surah id runs, editions id-gap observation. Queried via Python `sqlite3` on 2026-07-31. [VERIFIED]
- **Prototype run (`/tmp/opencode/api_proto/proto_gen.py`)** — executed the full generation + validation against the real DB: 116 files, 0.27s, 19 MB peak RSS, sizes (search.json 3,137.8 KB; surah range 736 B–229.8 KB; total 6.14 MB), all structural checks passing, `jq` consumer queries working. [VERIFIED]
- **Local stdlib behavior tests** — `ensure_ascii` default escaping of Arabic; default vs compact separators (1.9%); silent 0-byte DB creation on default connect; `mode=ro` URI behavior (no sidecars, clean error on missing file). [VERIFIED]
- **`add_malay_translation.py` (repo)** — CLI pattern, prerequisite guard, print-progress, exit codes (`:247-278`). [VERIFIED]
- **`convert_to_sqlite.py` (repo)** — schema DDL (`:15-95`), wipe-and-regenerate convention (`:350`), WAL PRAGMA (`:18`). [VERIFIED]
- **`.gitignore`, repo root listing** — current ignores (`output/`, `__pycache__/`); `api/` must be added (D-10). [VERIFIED]
- **`.planning/codebase/TESTING.md`** — zero test infra confirmed; pytest recommended as future framework. [VERIFIED]

### Secondary (MEDIUM confidence)
- [CITED: https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages] — project-site structure: any folder in the repo tree becomes a URL path (supports A2 / D-07 contract). Limits section not present in fetched extract; api/ total 6.14 MB is trivially below any Pages limit regardless. [CITED]

### Tertiary (LOW confidence)
- None — no websearch-dependent claims were required; all behavioral claims were verified locally against the live DB, the real scripts, and a working prototype. (Note: `brave_search`, `exa_search`, `firecrawl` all false in `.planning/config.json`; no MCP search tools available — codebase+prototype verification was the correct and sufficient method for this stdlib-only phase.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked by project constraint (stdlib only); every module verified present and behavior-tested
- Architecture: HIGH — single-pass/run-boundary design executed successfully as a prototype against the real DB with exact numbers
- Pitfalls: HIGH — all six verified empirically (behavior tests or prototype), not training recall
- Validation approach: HIGH — `--validate` checks executed in prototype with zero errors; pytest absence verified

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 — DB schema and scripts are stable repo artifacts; Python stdlib APIs are stable (the `ensure_ascii`/separators/`mode=ro` behaviors verified here have been constant across many Python versions)
