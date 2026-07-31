---
phase: 04-search-ui
plan: 01
subsystem: ui
tags: [questui, vanilla-js, search-engine, arabic-normalization, malay-language, github-pages]

# Dependency graph
requires:
  - phase: 02-json-api-generation
    provides: api/search.json (6,236 verses, 5-field contract), api/surahs.json (114 entries)
  - phase: 03-github-pages-deployment
    provides: deploy-pages.yml (deploy pipeline), api/ serving at site root
provides:
  - "index.html — QuestUI page shell with <html lang=\"ms\">, 9 component sections, exact Malay copy"
  - "style.css — Full QuestUI design system (13 color tokens, 5 type tokens, 3 font stacks, mobile-first + 768px breakpoint)"
  - "app.js — Client-side search engine (fold-once mirror, fold-aware regex highlighting, 114-entry Malay surah map, fuzzy suggestions, debounced input)"
  - "app.test.mjs — node:test suite (6 blocks) verifying D-06/D-07/D-09/D-10/D-11/D-15 against real api/search.json"
affects: [04-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [fold-once-mirror, fold-aware-regex-highlight, first-char-bucketed-levenshtein, vanilla-js-dombuilder-textcontent, node-test-zero-deps]

key-files:
  created: [index.html, style.css, app.js, app.test.mjs]
  modified: []

key-decisions:
  - "D-01..D-26 all implemented verbatim: preload search.json, 250ms debounce, Arabic+Malay fold, AND search, id order, substring-within-words, fold-aware regex highlighting (zero innerHTML), Arabic RTL larger / Malay LTR, 114-entry surah map with user's 'Lembu Betina' correction, cap-100 + show-more, fuzzy suggestions, loading/error/ready-aware states, relative paths, Google Fonts Cinzel+Spectral, <html lang=\"ms\">, vanilla JS"
  - "surahLabel works standalone (for tests) and in-browser via embedded 'en' fields in MALAY_SURAH_NAMES"

patterns-established:
  - "Fold-once-at-load mirror for 6,236 verses (~239ms one-time) → per-query scan ~5ms"
  - "Fold-aware regex highlighting: build per-char classes (alef variants, ة/ه, ى/ي) with diacritic-allowance gaps, exec on ORIGINAL text"
  - "Lazy first-char-bucketed Levenshtein for fuzzy: 0.4–12ms/query, cached after first no-results"
  - "XSS-safe DOM: createElement + textContent only, never innerHTML with user input or verse text"
  - "Vanilla JS module guard: if (document) init(); if (module) module.exports — works in browser and node:test"

requirements-completed: [UI-01, UI-02, UI-03]

# Metrics
duration: 25min
completed: 2026-07-31
---

# Phase 4 Plan 01: QuestUI Search UI — Summary

**QuestUI-styled Quran search page (index.html + style.css + app.js) with client-side Arabic+Malay search engine (fold-once mirror, fold-aware regex highlighting, 114-entry Malay surah map, fuzzy suggestions) deployed at repo root, plus a node:test smoke suite (6/6 blocks green against real api/search.json)**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-31T22:50:00Z
- **Completed:** 2026-07-31T23:15:00Z
- **Tasks:** 3
- **Files created:** 4 (index.html 55L, style.css 429L, app.js 497L, app.test.mjs 38L)

## Accomplishments
- Created `index.html` — QuestUI-styled page shell with `<html lang="ms">`, all 9 component sections (hero, search, loading, error, no-results, featured, results-grid, show-more, footer), exact Bahasa Melayu copy per UI-SPEC copywriting contract, Google Fonts (Cinzel + Spectral), relative asset references, skip-link + ARIA roles, no inline scripts/styles
- Created `style.css` — Full QuestUI design system: 13 color tokens (`--bg:#1A0F0A`, `--surface:#2C1A10`, `--accent-gold:#CA8A04`, parchment `#F5E6D3`, etc.), 5 typography tokens + 3 font stacks (Cinzel/Spectral/Amiri), mobile-first layout with 768px two-column breakpoint, all 9 component styles + interaction states, reduced-motion support, 44px touch targets, `[hidden]`/`.is-hidden` utilities
- Created `app.js` — Client-side search engine implementing all D-01..D-26: fold-once mirror building, AND multi-term combined Malay/Arabic search in id order, fold-aware regex highlighting (`appendHighlighted` + `appendLatinHighlighted` via `createElement`/`textContent`, zero innerHTML), 114-entry `MALAY_SURAH_NAMES` map with user's "Lembu Betina" correction, `surahLabel` formatter, banded `levAtMost` Levenshtein, lazy first-char-bucketed `fuzzySuggest`, `FEATURED_IDS` (Al-Fatiha + Ayatul Kursi + Al-Ikhlas), 250ms debounce input, cap-100 + show-more, loading/error/retry/ready-aware state wiring
- Created `app.test.mjs` — `node:test` suite with 6 blocks verifying: diacritic+alef folding (D-06), Malay case-insensitivity (D-07, 730 verses for BERIMAN), AND=3 for pemurah+langit (D-09), id order (D-10), surahLabel format with Lembu Betina (D-15), substring-within-word matching (D-11). All 6 pass against real `api/search.json` (3.2MB, 6,236 verses)

## task Commits

Each task was committed atomically:

1. **task 1: Create index.html — QuestUI page shell** - `19bcb78` (feat)
2. **task 2: Create style.css — QuestUI design system** - `02fcf2a` (feat)
3. **task 3: Create app.js + app.test.mjs (TDD)** - `79b1296` (feat)

**TDD flow:** Wrote `app.test.mjs` first → confirmed RED (module not found) → implemented `app.js` → all 6 tests GREEN → committed both together.

**Plan metadata:** plan committed as part of `a11cd42` (docs(04): create phase plan)

## Files Created/Modified
- `index.html` — QuestUI page shell: 9 component sections, `<html lang="ms">`, Google Fonts, a11y, relative refs
- `style.css` — QuestUI design system: 13 color tokens, 5 type tokens, 3 font stacks, mobile-first 768px breakpoint
- `app.js` — Client-side search engine: fold functions, search, highlight, surahLabel, fuzzy, DOM wiring
- `app.test.mjs` — node:test suite: 6 blocks testing folding, case, AND, order, label, substring against real data

## Decisions Made
- None — plan executed exactly as written; all 26 locked decisions (D-01..D-26) implemented verbatim. `surahLabel` embeds English translations in MALAY_SURAH_NAMES (`en` field) to work standalone in tests and in-browser.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Grep gate] Removed "innerHTML" from comments to pass hard gate**
- **Found during:** task 3 verification
- **Issue:** Three comments containing "Zero innerHTML" / "NO innerHTML" / "zero innerHTML" caused `grep -c 'innerHTML' app.js` to return 3, failing the plan's hard security gate (must be 0)
- **Fix:** Reworded comments to "Safe DOM only (no raw HTML)", "no raw HTML", "no raw HTML" — functional code never used innerHTML; this was purely a comment-word issue
- **Files modified:** app.js (3 comment lines)
- **Commit:** `79b1296`

---

**Total deviations:** 1 (comment reword only — no functional changes)
**Impact on plan:** None — all functional behavior and security properties unchanged

## Known Stubs

None — all props are wired with real data from `api/search.json` and `api/surahs.json`. `surahLabel` works standalone (embedded `en` fields) and in-browser (prefers `state.surahs` if loaded). The `fuzzySuggest` word index is lazily built on first no-results.

## Threat Flags

None — all security-relevant surface is accounted for in the plan's `<threat_model>`:
- T-04-01 (XSS via render path): Mitigated — zero `innerHTML` in app.js (verified: `grep -c 'innerHTML' app.js` = 0)
- T-04-02 (regex injection): Mitigated — `esc()` escapes metacharacters, `foldAr` filters diacritic-only terms, fixed-literal ranges
- T-04-03 (DoS via regex): Mitigated — single-pass `exec()` loops, banded Levenshtein with early exit, bucket prefilters
- T-04-04 (Google Fonts spoofing): Mitigated — CSS-only load, `font-display=swap`, serif fallbacks
- T-04-05 (dataset disclosure): Accepted — public data, rendered via `textContent`

## Self-Check

**File existence:**
- FOUND: index.html ✓
- FOUND: style.css ✓
- FOUND: app.js ✓
- FOUND: app.test.mjs ✓

**Commit existence:**
- FOUND: 19bcb78 (feat: index.html) ✓
- FOUND: 02fcf2a (feat: style.css) ✓
- FOUND: 79b1296 (feat: app.js + test suite) ✓

**Test results:**
- `node --test app.test.mjs`: 6/6 pass, exit 0 ✓

**Hard gates:**
- `innerHTML` = 0 ✓
- `Sapi Betina` = 0 ✓
- `Lembu Betina` ≥ 1 ✓
- Module guard = 1 ✓
- `fetch('api/search.json')` = 1 ✓
- No deletions in commits ✓
- Git status: only `quran.db` untracked (expected data artifact) ✓

## Self-Check: PASSED

---

*Phase: 04-search-ui*
*Completed: 2026-07-31*
