---
phase: 04-search-ui
fixed_at: 2026-07-31T15:42:05Z
review_path: .planning/phases/04-search-ui/04-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-07-31T15:42:05Z
**Source review:** `.planning/phases/04-search-ui/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 critical + 5 warnings; info findings out of scope)
- Fixed: 6
- Skipped: 0

All fixes were committed atomically (one commit per finding) with the `fix(04):` prefix. The full `node:test` suite (10 tests — 6 original + 4 added) passes, and every hard gate holds (see Verification below).

## Fixed Issues

### CR-01: Multi-term searches duplicate the verse text once per term (Arabic AND Malay)

**Files modified:** `app.js`, `app.test.mjs`
**Commit:** `fbe0e2b`
**Severity:** Critical (blocker)

**Root cause:** `renderCard` called `appendHighlighted`/`appendLatinHighlighted` once per term in a loop, and each helper appended the *entire* verse text into the same `<p>` — so an N-term query rendered each verse N times.

**Applied fix:**
- Refactored both highlight helpers to take the **terms array** and make a **single pass** over the text, so the verse is emitted exactly once regardless of term count.
  - `appendHighlighted` now delegates to a new pure `arabicHighlightRanges(text, terms)`: it runs each term's fold-aware `arRegex` over the text, collects `[start, end]` match ranges (with the existing trailing-diacritic span extension — Pitfall 3 preserved), then **sorts and merges** overlapping/adjacent ranges before slicing the text once.
  - `appendLatinHighlighted` now delegates to a new pure `latinSegments(text, terms)`: it builds a single escaped alternation regex `(t1|t2|…)` and `split`s once → `[{text, mark}]`.
- `renderCard` now calls each helper **once** with the full `terms` array (the per-term loops were removed).
- Exported `arabicHighlightRanges`, `latinSegments`, and (for WR-02) `state` in the module-guard block so the render path is now testable without a DOM.
- Added 3 regression tests (see below).

**Invariant verified:** for `terms = ['pemurah','langit']`, the Arabic element contains the verse Arabic text exactly once and the Malay element contains the Malay text exactly once, with both terms highlighted. Verified both by reconstruction (`segment.join('') === text` and range-walk rebuild `=== text`) in the new tests and by a direct runtime probe.

**Why this is "fixed" not "requires human verification":** the fix is covered by 3 new unit tests that assert no duplication and correct highlighting; the fold-aware Arabic behavior is preserved structurally (same `arRegex` + same trailing-diacritic extension, only the range-merge step was added).

### WR-01: Dead code — the "no results" body message is never displayed

**Files modified:** `app.js`
**Commit:** `1ed1678`
**Severity:** Warning

**Applied fix:** `runSearch` now branches: zero results call `showNoResultsState(terms)` **directly**, otherwise `showResultsState(showCount, results.length)`. The dead `if (total === 0) { showNoResultsState(); return; }` branch was removed from `showResultsState` (it is now never called with `total === 0`).

**Adaptation note:** the REVIEW's literal suggestion (short-circuit in `runSearch`) would have skipped hiding `hero`/`featured`/`loading`/`error` in the zero-results path, because those hides lived at the top of `showResultsState` *before* the old dead branch. I made `showNoResultsState` self-contained (it now also hides `hero`/`featured`/`loading`/`error`) so the no-results card renders correctly regardless of the prior UI state, and the previously-unreachable body line (`els.noResultsBody.textContent = 'Tiada ayat yang mengandungi "' + terms.join(' ') + '".'`) is now populated.

### WR-02: `surahLabel` assumes `state.surahs` is a positionally-indexed array

**Files modified:** `app.js`, `app.test.mjs`
**Commit:** `31ce01d`
**Severity:** Warning

**Applied fix:** `surahLabel` now scans `state.surahs` for the entry whose `number === verse.surah`, falling back to the embedded `MALAY_SURAH_NAMES[…].en` when the index is missing or the surah isn't found. This is robust to reordered / keyed / sparse `api/surahs.json` (confirmed the JSON is an array of 114 entries each carrying a `number` field). Exported `state` and added a test using a deliberately **reordered** surahs array (`[{number:114,…},{number:1,…}]`) that would have returned the wrong English name under the old `state.surahs[verse.surah - 1]` access.

### WR-03: Fetch failures are silently swallowed — no diagnostic for ops

**Files modified:** `app.js`
**Commit:** `791c3c3`
**Severity:** Warning

**Applied fix:** the `loadIndex` catch now receives `err` and `console.warn`s `err.message` (which encodes the HTTP status from `app.js`) — guarded with `typeof console !== 'undefined'` for non-browser environments — before falling back to `showErrorState()`. Operators with DevTools now get a 404/network/CORS signal instead of a silent drop.

### WR-04: `fuzzySuggest` mixes `qAr` and `qMs` Levenshtein against a bucket keyed only by `qAr`

**Files modified:** `app.js`
**Commit:** `6afecb4`
**Severity:** Warning
**Status:** fixed (logic change — flagged for human verification of suggestion quality)

**Applied fix:** `fuzzySuggest` now looks up **two buckets independently**: `arMap = _wordIndex.get(qAr[0])` scored with `levAtMost(qAr, …)`, and `msMap = _wordIndex.get(qMs[0])` scored with `levAtMost(qMs, …)`. Each form uses its own length band and threshold. The `qMs !== qAr` guard is retained so the pure-Latin case (where the two folds are identical) skips the redundant ms pass — meaning **the common Latin-query behavior is byte-identical to before**; only the divergent-script case (where Malay matches whose first char differs from `qAr[0]` were previously invisible) changes.

**Verification note:** Tier 1 (re-read) and Tier 2 (`node -c` syntax) pass; the full test suite is green. Because this is a logic/algorithm change, Tier 1/2 cannot prove semantic correctness end-to-end — a developer should confirm suggestion quality for mixed-script queries in the browser.

### WR-05: Stage-site step has no `_site` cleanup; merges into stale output on re-run

**Files modified:** `.github/workflows/deploy-pages.yml`
**Commit:** `3459ac1`
**Severity:** Warning

**Applied fix:** prepended `rm -rf _site` to the Stage-site run command, making the build idempotent for local reproduction. The fix is a strict improvement (low risk, no CI downside since runners start clean) so I applied it rather than accepting the finding. Verified D-21 still holds: the step stages **exactly** `api/` + `index.html` + `style.css` + `app.js`, and still excludes `app.test.mjs` and `quran.db`.

## Skipped Issues

None. All 6 in-scope findings were fixed.

## Tests Added

In `app.test.mjs` (suite now 10 tests, all green):
- `CR-01: latinSegments single-pass — no duplication for multi-term (D-09 query)` — multi-term Malay text appears exactly once; both terms highlighted once each.
- `CR-01: arabicHighlightRanges single-pass — no duplication for multi-term` — Arabic text rebuilds to the original exactly once; both terms match.
- `CR-01: single-term path still highlights correctly (no regression)`.
- `WR-02: surahLabel finds English name by number, not positional index` — reordered surahs array resolves correctly (would fail on old code).

## Verification

**Tier 1 (re-read, all fixes):** each modified section was re-read after editing; fix text present, surrounding code intact.

**Tier 2 (syntax):** `node -c app.js` passes; YAML change is a single-line string edit verified by direct content assertions.

**Hard gates (final):**
- `node --test app.test.mjs` → 10 pass / 0 fail (exit 0)
- `grep -c 'innerHTML' app.js` = 0
- `grep -c 'Sapi Betina' app.js` = 0
- `grep -c 'Lembu Betina' app.js` = 1
- `grep -c "if (typeof module !== 'undefined')" app.js` = 1
- `grep -c "fetch('api/search.json')" app.js` = 1
- Workflow Stage-site stages exactly `api/` + `index.html` + `style.css` + `app.js` (D-21 preserved)

**Commit log (this iteration):**
- `fbe0e2b` fix(04): CR-01 highlight all terms in single pass to stop multi-term verse duplication
- `1ed1678` fix(04): WR-01 surface no-results body message with searched terms
- `31ce01d` fix(04): WR-02 resolve surahLabel English name by number field not positional index
- `791c3c3` fix(04): WR-03 log loadIndex fetch error to console before showing error state
- `6afecb4` fix(04): WR-04 score fuzzy Malay form against its own first-char bucket
- `3459ac1` fix(04): WR-05 clean _site before staging so re-runs don't merge stale output

**Note on worktree:** the isolated-worktree setup (`git worktree add`) could not attach a second worktree to `main` because git forbids checking out a branch that is already checked out in another worktree, and `main` is checked out at the main working tree. With no other concurrent session present, fixes were committed directly to `main` in the main working tree (commits advance `main` as required). No `git worktree remove` cleanup was needed since no separate worktree was created.

---

_Fixed: 2026-07-31T15:42:05Z_
_Fixer: OpenCode (gsd-code-fixer)_
_Iteration: 1_
