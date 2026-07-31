# Phase 4: Search UI - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 5 (4 new, 1 modified)
**Analogs found:** 1 / 5 (repo is Python-only — the frontend files are greenfield)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `index.html` | view (page shell) | static-serve | none — repo has zero HTML | no analog |
| `style.css` | styling (design system) | static | none — repo has zero CSS | no analog |
| `app.js` | controller/service | request-response (fetch) + transform (fold/search/highlight) | `generate_json_api.py` (CLI entry, print progress, no-deps) | partial (conventions only) |
| `app.test.mjs` | test | unit (node:test) | none — repo has zero tests | no analog |
| `.github/workflows/deploy-pages.yml` | config (CI/CD) | pipeline | the file itself (existing "Stage site" step) | exact (self-edit) |

## Pattern Assignments

### `app.js` (controller, request-response + transform)

**Analog:** `generate_json_api.py` (conventions only — no JS exists in repo)

**No-deps ethos** (CONVENTIONS.md → AGENTS.md): stdlib-only in Python mirrors vanilla-JS-only in the browser (D-26). No framework, no build step, no package.json. Node is used ONLY as a test runner (`node --test`).

**Module-structure conventions to mirror from `convert_to_sqlite.py` / `generate_json_api.py`:**
- Module-level constants in `UPPER_SNAKE_CASE` (e.g., `DIAC`, `FOLD`, `AR_FOLD_RE`, `MALAY_SURAH_NAMES`, `FEATURED_IDS`) — mirrors `SQL_FILE`/`DB_FILE`/`TABLE_ORDER` in the Python scripts
- Functions in `snake_case` (`foldAr`, `foldMs`, `surahLabel`, `levAtMost`) — mirrors `create_sqlite_schema`, `parse_sql_value`
- Single-quoted strings everywhere; template literals only for string building
- Progress/user-facing messages via `print` (Python) → `console` / DOM text (JS) — no logging framework

**Core pattern (from RESEARCH.md Code Examples 1–8 — VERIFIED against real `api/search.json` this session):**
```javascript
// Pattern 1 — fold-once-at-load mirror + linear scan (D-01/D-05/D-06/D-07)
const DIAC = /[\u0640\u064B-\u0654\u0670\u06D6-\u06ED]/g;
const FOLD = { '\u0622': '\u0627', '\u0623': '\u0627', '\u0625': '\u0627',
               '\u0671': '\u0627', '\u0629': '\u0647', '\u0649': '\u064A' };
const AR_FOLD_RE = /[\u0622\u0623\u0625\u0671\u0629\u0649]/g;
const foldAr = (s) => s.replace(AR_FOLD_RE, (c) => FOLD[c]).replace(DIAC, '');
const foldMs = (s) => s.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
// per keystroke: fold query terms, scan mirror, AND across terms, OR within term across fields

// Pattern 2 — fold-aware regex for highlighting (D-12); NO offset mapping
// exec() against ORIGINAL diacritized text; extend span over trailing diacritics;
// build <mark> via createElement/textContent — NEVER innerHTML (Pitfall 4)

// Pattern 3 — lazy first-char-bucketed Levenshtein for fuzzy (D-18)
// Map<firstChar, Map<wordLength, [{word, verseIndex}]>>; banded levAtMost(a,b,max)

// Pattern 4 — testable module guard
// if (typeof document !== 'undefined') { init(); }
// if (typeof module !== 'undefined') module.exports = { foldAr, foldMs, search, arRegex, surahLabel, MALAY_SURAH_NAMES, levAtMost };
```

**Data contract consumed (D-04 — search.json as-is, verified):**
```json
{"arabic": "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", "malay": "Dengan nama Allah...", "surah": 1, "ayah": 1, "id": 1}
```
`api/surahs.json`: `{"number", "name_ar", "name_en", "name_en_translation", "type", "ayah_count"}` (114 entries).

### `index.html` / `style.css` (view + styling)

**Analog:** none — use UI-SPEC.md component specs (verbatim: class names, copy strings, color tokens, typography, spacing, breakpoints) and RESEARCH.md palette notes (`#1A0F0A` bg, `#2C1A10` surface, `#F5E6D3` parchment).

### `.github/workflows/deploy-pages.yml` (config, self-edit)

**Analog:** the file itself. Existing "Stage site" step (`mkdir -p _site && cp -r api _site/`) gains `&& cp index.html style.css app.js _site/` (D-21). All other steps/actions untouched.

## Shared Patterns

### XSS-safe rendering (applies to: app.js, index.html)
**Source:** RESEARCH.md Pattern 2 / Pitfall 4
**Apply to:** All DOM building in app.js.
```javascript
// Build DOM nodes with textContent only. Never innerHTML with query/verse text.
container.appendChild(document.createTextNode(text.slice(last, m.index)));
const mark = document.createElement('mark');
mark.appendChild(document.createTextNode(text.slice(m.index, end)));
```

### Relative paths (applies to: index.html, app.js)
**Source:** D-22
**Apply to:** `api/search.json`, `api/surahs.json`, `style.css`, `app.js` — never absolute `/quran-database-malay/...` URLs. Works under the Pages project prefix AND from `python3 -m http.server` locally.

### QuestUI color tokens (applies to: style.css, index.html inline uses)
**Source:** UI-SPEC §Color Tokens
**Apply to:** `--bg:#1A0F0A`, `--surface:#2C1A10`, `--surface-raised:#3D2618`, `--border:#5C3A1F`, `--text-primary:#F5E6D3`, `--text-muted:#B89A7A`, `--accent-gold:#CA8A04`, `--accent-red:#991B1B` (borders/fills only), `--accent-purple:#581C87` (decorative only). Never pure white/black.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `index.html` | view | static | Repo contains zero HTML (Python data artifacts only). Use UI-SPEC.md §Component Specs + §Copywriting Contract as the source of truth |
| `style.css` | styling | static | Zero CSS in repo. Use UI-SPEC.md tokens/typography/spacing/breakpoints verbatim |
| `app.test.mjs` | test | unit | Zero tests in repo. Use RESEARCH.md Code Example 8 + VALIDATION.md per-task map (node:test + node:assert, reads real api/search.json) |

## Metadata

**Analog search scope:** repo root (`*.py`, `*.js`, `*.html`, `*.css`, `.github/workflows/`)
**Files scanned:** 7 (4 Python, 1 workflow YAML, 2 generated JSON data)
**Pattern extraction date:** 2026-07-31
