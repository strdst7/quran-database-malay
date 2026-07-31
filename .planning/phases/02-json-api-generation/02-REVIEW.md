---
phase: 02-json-api-generation
reviewed: 2026-07-31T12:31:23Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - generate_json_api.py
  - .gitignore
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-07-31T12:31:23Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed `generate_json_api.py` (224 lines, new) and `.gitignore` (added `api/`). The generate path is structurally sound: read-only SQLite URI (`mode=ro`, uri=True) with parameterized queries only, `ensure_ascii=False` UTF-8 output, count guardrails (6236 ayahs / 114 surahs) before any file is touched, and confirmed-correct output against the live `quran.db` (surahs.id == number, ayah ids contiguous 1..6236).

Two substantive defects were found and proven by execution:

1. **`--validate` accepts completely wrong data.** The validator never cross-checks per-surah file contents against `surahs.json` (`ayah_count`) nor verifies `v['surah'] == n` per file. A synthetic DB with rotated `surah_id` values produced output where every verse sits in the wrong file with a wrong `surah` label — and `--validate` returned exit code 0 with "errors: 0". The generator also implicitly couples on the unverified assumption `surahs.id == surahs.number` (verse dicts keyed by `surah_id`, files named by number).
2. **`--validate` crashes with an unhandled traceback on malformed output.** `json.load(open(...))` at lines 135/153/169 has no error handling; a corrupted `surah/1.json` (truncated write) raises `JSONDecodeError` out of `cmd_validate` — the exact failure class the validator exists to report cleanly.

All findings below. No critical issues (no injection, no path traversal — paths are hardcoded constants, no auth surface, read-only DB access verified).

## Warnings

### WR-01: Validator cannot detect misplaced/mislabelled verse content; generator assumes `surahs.id == surahs.number`

**File:** `generate_json_api.py:50-55, 61-72, 98-99` and `generate_json_api.py:130-184`

**Issue:** Two coupled problems:

1. **Generator:** the verse query selects `a.surah_id` (the `surahs` *primary key*) but files are written keyed by surah *number* (`for n in range(1, 115)`, `surah_verses.get(n, [])`), and the `'surah'` field in each verse is populated with `surah_id` (line 67). This only lines up because, in the current dataset, `surahs.id == surahs.number` (verified: 0 mismatches). Nothing in the schema enforces this, and nothing in the script verifies it. If the ids ever diverge from numbers, verses are silently misplaced into the wrong files (or silently dropped into `[]` files via `.get(n, [])` at line 99) while `row_count` still equals 6236 — so the generator's own count check at line 74 does not catch it.
2. **Validator:** `--validate` checks per-file: existence, key sets, non-empty text, and the global sum (6236). It never checks that file `n.json` contains only verses with `v['surah'] == n`, and never compares `len(verses)` in file `n` against `surahs.json[n-1]['ayah_count']`.

**Proven:** a synthetic DB with `surah_id = (id % 114) + 1` (every verse rotated into the wrong surah, wrong label) was regenerated and validated: `generate rc: 0`, `validate rc: 0`, `errors: 0`. File `surah/1.json` contained surah 114's Arabic text labelled as surah 1, and validation certified it. A search API with wrong surah labels is a data-integrity failure this mode exists to prevent.

**Fix:** decouple the generator from the id/number assumption and add the missing cross-checks:

```python
# generate: select the surah NUMBER explicitly, and key files by it
cur = db.execute('''
    SELECT a.id, s.number, a.number_in_surah, a.text, ae.data
    FROM ayahs a
    JOIN surahs s ON s.id = a.surah_id
    JOIN ayah_edition ae ON ae.ayah_id = a.id AND ae.edition_id = ?
    ORDER BY a.id
''', (edition_id,))
# ... verse = {'arabic': arabic, 'malay': malay,
#             'surah': surah_no, 'ayah': ayah_no, 'id': aid}
```

```python
# validate: cross-check per-surah file against surahs.json
for n in range(1, 115):
    verses = json.load(open(path, encoding='utf-8'))
    expected = surahs_data[n - 1]['ayah_count']
    if len(verses) != expected:
        errors.append(f'{n}.json: {len(verses)} verses != ayah_count {expected}')
    for v in verses:
        if v.get('surah') != n:
            errors.append(f'{n}.json: verse id {v.get("id")} has surah {v.get("surah")}, expected {n}')
```

### WR-02: `--validate` crashes with an unhandled traceback on malformed output

**File:** `generate_json_api.py:135, 153, 169` (and `cmd_validate`, lines 124-194, overall)

**Issue:** `cmd_validate` has no `try/except` at all. `json.load(open(path, encoding='utf-8'))` raises `json.JSONDecodeError` on a truncated/corrupt JSON file, `TypeError` if a file holds a non-list (`{}` → `v['id']` on a string key), and `OSError` on permission errors. All of these propagate out of `cmd_validate` as an unhandled traceback instead of being reported in the `errors` list — precisely the failure mode the validator exists to surface cleanly. This matters in practice: the generator's delete-before-write pattern (line 95) means an interrupted/crashed run leaves partial files, and the validator is the recovery tool for that state.

**Proven:** writing `{broken json` into `api/surah/1.json` and running `cmd_validate` produced `JSONDecodeError: Unterminated string starting at: line 1 column 64` as an unhandled exception (exit via traceback), not an error report.

**Fix:**

```python
try:
    with open(path, encoding='utf-8') as f:
        verses = json.load(f)
except (OSError, json.JSONDecodeError, TypeError) as e:
    errors.append(f'{n}.json: unreadable ({e})')
    continue
```

(Apply the same pattern to the `search.json` and `surahs.json` loads. Using `with open(...)` also fixes the file-handle leak — lines 135/153/169 open without a context manager.)

## Info

### IN-01: Destructive `rmtree` before regeneration is non-atomic

**File:** `generate_json_api.py:95`

**Issue:** `shutil.rmtree(API_DIR, ignore_errors=True)` deletes the entire previous `api/` before writing the new one. If the run fails mid-write (disk full, permission error), the old output is gone and the new one is partial — and `ignore_errors=True` silently swallows cleanup failures, potentially leaving a stale mix (new surah files + old `search.json`). Failures after line 95 are only caught by `--validate` (which, per WR-02, itself crashes on partial files). This matches the repo's rebuild pattern in `convert_to_sqlite.py`, so it is consistent with convention — but writing to a staging dir (e.g., `api.tmp/`) and swapping after all files succeed would make regeneration crash-safe. Severity kept low because a rerun fully recovers.

### IN-02: Dead code — unreachable `else` branch in `main()`

**File:** `generate_json_api.py:218-220`

**Issue:** `parser.add_mutually_exclusive_group(required=True)` guarantees exactly one of `--generate`/`--validate` is set (argparse exits 2 otherwise), so the `else: parser.print_usage(sys.stderr); return 2` branch is unreachable. Verified: `--generate --validate` is rejected by argparse before `main()` dispatch. Remove the branch (or the `required=True` if a bare `-h`-style usage path is intended).

### IN-03: Magic number `114` repeated; non-interpolated f-string

**File:** `generate_json_api.py:90, 98, 113, 130, 170, 174`

**Issue:** The surah count `114` / `range(1, 115)` is hardcoded in six places, while `EXPECTED_AYAHS` is a named constant. Per repo convention (UPPER_SNAKE_CASE module constants), add `EXPECTED_SURAHS = 114` and reuse it. Line 113 `print(f'  surah files: 114')` is an f-string with no interpolation — either interpolate the constant or drop the `f` prefix.

### IN-04: Validator key lists duplicated from generator dicts

**File:** `generate_json_api.py:137, 158, 177-179` vs `66-67, 86-88`

**Issue:** The expected key sets (`['arabic', 'ayah', 'id', 'malay', 'surah']`, etc.) are hardcoded in `cmd_validate` and must be manually kept in sync with the dict literals in `cmd_generate`. If a field is renamed/added in generate, validate silently stops covering it until edited. A shared module-level constant (e.g., `VERSE_KEYS = ('arabic', 'ayah', 'id', 'malay', 'surah')`) would keep them coupled.

### IN-05: `.gitignore` does not ignore `quran.db` (219 MB untracked build artifact)

**File:** `.gitignore:1-6`

**Issue:** `quran.db` is generated by `convert_to_sqlite.py` and is currently untracked but present in the working tree (219 MB). The repo tracks the compressed deliverable `quran.db.gz` instead. A future `git add .` would stage the entire 219 MB file. Add `quran.db` (and optionally the extracted `data/quran.sql`) to `.gitignore` under `# Data`.

---

_Reviewed: 2026-07-31T12:31:23Z_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: standard_
