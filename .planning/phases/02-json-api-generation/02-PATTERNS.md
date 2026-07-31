# Phase 2: JSON API Generation - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 2 new/modified (`generate_json_api.py`, `.gitignore`) + 1 generated-output dir (`api/`, not a source file)
**Analogs found:** 3 / 3 source files matched (`add_malay_translation.py`, `convert_to_sqlite.py`, `/tmp/opencode/api_proto/proto_gen.py`); `.gitignore` self-matched

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `generate_json_api.py` — CLI skeleton (imports, module constants, `main()` dispatch) | script (CLI tool) | batch/transform | `add_malay_translation.py:16-38, 247-278` | exact |
| `generate_json_api.py` — `--generate` data path (prerequisite guard, join query, run-boundary writes) | script (CLI tool) | batch/transform | `/tmp/opencode/api_proto/proto_gen.py:9-65` | exact (verified prototype against live DB) |
| `generate_json_api.py` — wipe-before-regenerate convention (D-09) | script (CLI tool) | batch/transform | `convert_to_sqlite.py:350-351` | exact |
| `generate_json_api.py` — `--validate` mode (read-back checks + report + exit code) | script (CLI tool) | request-response | `add_malay_translation.py:219-234` (verification report) + `02-RESEARCH.md:368-388` (verified check code) | partial — no `--validate` mode exists in any analog; check logic was verified in the prototype run, not in `proto_gen.py` itself |
| `.gitignore` — add `api/` (D-10) | config | — | `.gitignore:1-5` (append to existing `# Data` section) | exact |

## Pattern Assignments

### `generate_json_api.py` (script, batch/transform) — CLI skeleton

**Analog:** `add_malay_translation.py` (Phase 1 script; MUST NOT be modified — pattern source only)

**Imports pattern** (`add_malay_translation.py:16-23`; new script uses the subset `argparse, json, os, shutil, sqlite3, sys` — stdlib only per constraint):
```python
import argparse
import json
import os
import sqlite3
import sys
```
(`shutil` is added for `shutil.rmtree` wipe; `time`/`urllib.*` from Phase 1 are NOT needed — no network.)

**Module constants pattern** (`add_malay_translation.py:27-31`; `UPPER_SNAKE_CASE`, single-quoted strings; add `API_DIR = 'api'`):
```python
DB_FILE = 'quran.db'
API_DIR = 'api'
EXPECTED_AYAHS = 6236
EDITION_IDENTIFIER = 'ms.basmeih'
```

**Docstring convention** (`add_malay_translation.py:1-14`): shebang `#!/usr/bin/env python3`, triple-quoted module docstring documenting both modes and the stdlib-only constraint. Every function gets a one-line triple-quoted docstring (`:43, 72, 86, 103, 117, 137, 247`).

**CLI entry pattern — two-mode argparse with mutually exclusive required group** (`add_malay_translation.py:247-274`; D-15 mandates mirroring this):
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

**Entry point** (`add_malay_translation.py:277-278`):
```python
if __name__ == '__main__':
    sys.exit(main())
```

**Error-handling pattern — cmd functions return exit codes, no exceptions escape** (`add_malay_translation.py:119-134`):
```python
    try:
        print(f"Fetching from {API_URL}...")
        ...
        return 0
    except Exception as e:
        print(f"Fetch failed: {e}")
        return 1
```
Convention: exit 0 = success, 1 = failure (printed message), 2 = usage error (D-18: CI-friendly non-zero on any failure).

---

### `generate_json_api.py` — `--generate` data path

**Analog:** `/tmp/opencode/api_proto/proto_gen.py` (verified run: 116 files, 0.27s, 19 MB peak RSS — outside repo, safe to copy from)

**Prerequisite guard + edition lookup** (`proto_gen.py:9-18`; mirror the friendly-message style of `add_malay_translation.py:139-141`):
```python
if not os.path.exists(DB_FILE):
    print('quran.db not found. Run convert_to_sqlite.py first.')
    return 1
row = db.execute(
    "SELECT COUNT(*) FROM ayah_edition ae "
    "JOIN editions e ON e.id = ae.edition_id "
    "WHERE e.identifier = ?", (EDITION_IDENTIFIER,)
).fetchone()
if row[0] != EXPECTED_AYAHS:
    print(f'ms.basmeih has {row[0]} rows, expected {EXPECTED_AYAHS}. '
          f'Run add_malay_translation.py --insert first.')
    return 1
edition_id = db.execute(
    "SELECT id FROM editions WHERE identifier = ?", (EDITION_IDENTIFIER,)
).fetchone()[0]
```
> ⚠️ **Deviation from prototype (verified by research, Pitfalls 2 & 3):** `proto_gen.py:12,26` uses `sqlite3.connect(DB_FILE)` (read-write). The final script MUST use the read-only URI instead — default connect on a missing file silently creates a 0-byte DB, and read-write opens recreate `-wal`/`-shm` sidecars on the WAL-mode DB:
> ```python
> db = sqlite3.connect(f'file:{DB_FILE}?mode=ro', uri=True)
> ```
> Research verified `mode=ro` raises cleanly on missing files and creates no sidecars.

**Wipe + directory creation (D-09), after all data checks** (`proto_gen.py:21-23` — pattern from Pattern 3 in research; `shutil.rmtree` per research "Don't Hand-Roll"):
```python
shutil.rmtree(API_DIR, ignore_errors=True)
os.makedirs(os.path.join(API_DIR, 'surah'))
```
> ⚠️ **Ordering (D-16 before D-09):** the wipe MUST come after the 6,236-invariant + non-empty-text checks complete in memory — a failed validation leaves a previously-good `api/` intact.

**Core join query — single SELECT, ordered by global id** (`proto_gen.py:27-32`; `ayahs.id == ayahs.number` verified, so `ORDER BY a.id` yields id order AND surah-major runs):
```python
cur = db.execute('''
    SELECT a.id, a.surah_id, a.number_in_surah, a.text, ae.data
    FROM ayahs a
    JOIN ayah_edition ae ON ae.ayah_id = a.id AND ae.edition_id = ?
    ORDER BY a.id
''', (edition_id,))
```
Parameterized SQL only — never string-interpolated values (CONVENTIONS.md).

**Run-boundary generation loop — single pass builds per-surah files AND search.json (D-05, no drift)** (`proto_gen.py:34-54`; add the D-16 fail-hard check inside):
```python
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
    search_verses.append(verse)            # D-05: same pass, same logic
if current_surah is not None:
    with open(os.path.join(API_DIR, 'surah', f'{current_surah}.json'),
              'w', encoding='utf-8') as f:
        json.dump(current_verses, f, ensure_ascii=False)
with open(os.path.join(API_DIR, 'search.json'), 'w', encoding='utf-8') as f:
    json.dump(search_verses, f, ensure_ascii=False)
```
Key conventions to preserve:
- **`ensure_ascii=False` on EVERY `json.dump`** (D-03 + Pitfall 1) — Phase 1 does the same at `add_malay_translation.py:127`.
- **No `indent` argument** (D-03 locks default minified; Pitfall 6).
- **No zero-padding** in `f'{current_surah}.json'` (D-08).

**surahs.json source — one grouped query, dict in D-13 field order** (`proto_gen.py:57-65`):
```python
surahs = db.execute('''
    SELECT s.number, s.name_ar, s.name_en, s.name_en_translation,
           s.type, COUNT(a.id) AS ayah_count
    FROM surahs s JOIN ayahs a ON a.surah_id = s.id
    GROUP BY s.id ORDER BY s.number
''').fetchall()
surah_objs = [{'number': n, 'name_ar': ar, 'name_en': en,
               'name_en_translation': tr, 'type': t, 'ayah_count': c}
              for (n, ar, en, tr, t, c) in surahs]
with open(os.path.join(API_DIR, 'surahs.json'), 'w', encoding='utf-8') as f:
    json.dump(surah_objs, f, ensure_ascii=False)
```

**Final summary report** (mirror `convert_to_sqlite.py:408-419` and `add_malay_translation.py:219-234` style — `print(f"...")` progress, `Done!` sentinel):
```python
print(f"\nAPI generated: {API_DIR}")
print(f"  surah files: 114")
print(f"  search.json: {len(search_verses)} verses")
print(f"  surahs.json: {len(surah_objs)} surahs")
print("Done!")
```

---

### `generate_json_api.py` — `--validate` mode

**Analog:** partial — no `--validate` mode exists in the codebase. Build from: (a) the verification-report pattern in `add_malay_translation.py:219-234`, and (b) the verified check code in `02-RESEARCH.md:368-388` (executed successfully against prototype output — treat as reference code, not a repo file).

**Verification-report style** (`add_malay_translation.py:219-234` — `print(f"\n...")` header, indented `print(f"  ...")` facts, `Done!`):
```python
print(f"\nMalay translation inserted: {EDITION_IDENTIFIER}")
count = db.execute(...).fetchone()[0]
print(f"  ayah_edition: {count} rows")
...
print("Done!")
```

**Core check loop (D-17)** — from `02-RESEARCH.md:368-388` (verified; recommended to also check `surahs.json` per OpenCode's Discretion — 114 entries, 6 keys, number order 1–114):
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
# print report; return 1 if errors else 0  (D-18)
```

---

### `.gitignore` (config)

**Analog:** `.gitignore:1-5` (self — append within the existing `# Data` section, D-10):
```
# Data
output/
api/

# Python
__pycache__/
```
Convention: commented section headers (`# Data`, `# Python`), one pattern per line, no trailing slash on the pattern (matches `output/` style which DOES use a trailing slash — keep `api/` with slash, consistent).

## Shared Patterns

### Two-Mode argparse CLI Dispatch
**Source:** `add_malay_translation.py:247-274`
**Apply to:** `generate_json_api.py` `main()`
Mutually exclusive required group (`--generate` / `--validate`), if/elif dispatch returning `cmd_*` exit codes, `parser.print_usage(sys.stderr) + return 2` fallback, `sys.exit(main())`.

### Prerequisite Guard Before Any Work
**Source:** `add_malay_translation.py:139-141` + `proto_gen.py:9-18`
**Apply to:** `--generate` (D-19/D-20)
`os.path.exists(DB_FILE)` guard with actionable message → `return 1`; then COUNT check that `ms.basmeih` has exactly `EXPECTED_AYAHS` rows with "run `add_malay_translation.py --insert` first" message. Never touch the DB before the guard (default connect creates empty files — Pitfall 2).

### Wipe-and-Regenerate Determinism
**Source:** `convert_to_sqlite.py:350-351` (`os.remove` on `quran.db`) generalized to `shutil.rmtree(API_DIR, ignore_errors=True)` + `os.makedirs(...)` (proto_gen.py:21-23)
**Apply to:** `--generate`, AFTER all in-memory validation (Pattern 3: validate → wipe → write).

### Read-Only DB Connection (`mode=ro` URI)
**Source:** `02-RESEARCH.md:327` (behavior-verified; not in any repo file)
**Apply to:** all `sqlite3.connect` calls in `--generate`
`sqlite3.connect(f'file:{DB_FILE}?mode=ro', uri=True)` — fails cleanly on missing file, creates no `-wal`/`-shm` sidecars, cannot modify `quran.db`.

### Progress + Report via `print(f"...")`
**Source:** `add_malay_translation.py:120,130,220-234`; `convert_to_sqlite.py:348,372,408-419`
**Apply to:** both modes
Milestone messages, indented 2-space report facts, `Done!` sentinel. No logging framework (CONVENTIONS.md).

### Exit-Code Contract
**Source:** `add_malay_translation.py:132-134, 273-274`
**Apply to:** both modes, `main()`
0 = success, 1 = failure (message already printed), 2 = usage error. D-18: `--validate` non-zero on any failure — CI gate for Phase 3.

### Non-ASCII JSON Serialization
**Source:** `add_malay_translation.py:127` (`ensure_ascii=False, indent=2` — staged artifact) → `proto_gen.py:44,51,54,65` (`ensure_ascii=False`, no indent — API output)
**Apply to:** every `json.dump` in `--generate`
`ensure_ascii=False` for raw Arabic; NO `indent` (D-03, Pitfall 6).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `generate_json_api.py` `--validate` mode | script (CLI tool) | request-response | No existing validation-mode script in the codebase (zero test infra). Use the verified check code from `02-RESEARCH.md:368-388` plus the verification-report style from `add_malay_translation.py:219-234`. The check logic itself was executed successfully in the prototype run. |

## Metadata

**Analog search scope:** repo root (`add_malay_translation.py`, `convert_to_sqlite.py` — the only two `.py` files in the repo), `.gitignore`, `/tmp/opencode/api_proto/proto_gen.py` (verified prototype), `02-RESEARCH.md` code examples
**Files scanned:** 4 (2 repo scripts + `.gitignore` + prototype)
**Pattern extraction date:** 2026-07-31

**Key deviations from prototype to flag for the planner:**
1. `proto_gen.py` uses `sqlite3.connect(DB_FILE)` read-write → final script must use `f'file:{DB_FILE}?mode=ro'` URI (research Pitfalls 2/3, verified)
2. `proto_gen.py` has no 6,236-invariant / non-empty-text check → final `--generate` adds them before wipe (D-16, research Pattern 3)
3. `proto_gen.py` has no `--validate` mode → final adds it (D-17/D-18, research Code Examples `:368-388`)
4. `proto_gen.py` uses absolute paths → final uses relative `API_DIR = 'api'` (D-07)
