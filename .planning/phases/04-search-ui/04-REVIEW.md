---
phase: 04-search-ui
reviewed: 2026-07-31T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - index.html
  - style.css
  - app.js
  - app.test.mjs
  - .github/workflows/deploy-pages.yml
findings:
  critical: 1
  warning: 5
  info: 6
  total: 12
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-07-31
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed all 5 Phase-4 source files at standard depth with adversarial tracing of the search pipeline (`foldAr`/`foldMs` → `_search` → `renderCard` → `appendHighlighted`/`appendLatinHighlighted`), the fuzzy Levenshtein path, the state machine, the workflow's Stage-site edit, and the test suite.

**XSS surface is clean:** `grep -c innerHTML app.js` returns 0; all verse rendering uses `createElement` + `textContent`; the user query never reaches `new RegExp` unescaped (`esc()` at app.js:29 covers `[.*+?^${}()|[\]\\]`). The Stage-site workflow edit is correct — it stages exactly `api/` + `index.html` + `style.css` + `app.js`; `app.test.mjs`, `quran.db`, and `generate_json_api.py` are correctly NOT staged.

**However, one functional BLOCKER remains:** multi-term searches render each verse's Arabic and Malay text duplicated once per search term. Two terms = text shown twice; three terms = three times. The existing test suite does not catch this because `app.test.mjs` exercises `_search` (the matching algorithm) but never `renderCard` (where the bug lives, since the tests run under Node without a DOM).

Plus four functional/UX warnings (one piece of dead code that silently drops a user-facing message, an indexed-array coupling assumption, swallowed fetch errors, and a fuzzy-suggest logic inconsistency) and six info-level items.

## Critical Issues

### CR-01: Multi-term searches duplicate the verse text once per term (Arabic AND Malay)

**File:** `app.js:396-415` (and downstream consumers `app.js:524`, `app.js:537`, `app.js:555`)
**Issue:**
`renderCard` loops over `terms` and calls the highlight helpers once per term, but each helper **appends the entire verse text** to the same container element:

```js
// app.js:396-402
if (terms && terms.length) {
  for (var i = 0; i < terms.length; i++) {
    appendHighlighted(arabicEl, verse.arabic, terms[i]);   // appends FULL verse.arabic each call
  }
}
// ...and the identical pattern at app.js:409-412 for malayEl / appendLatinHighlighted
```

`appendHighlighted` (app.js:81-101) and `appendLatinHighlighted` (app.js:104-121) both terminate by appending `text.slice(last)` / `text.split(re).forEach(...)` — i.e. they always emit the full input text into `container`. Calling them N times against the same `<p>` produces N copies of the verse.

**Reproduction:** search `pemurah langit` (the exact 2-term query in `app.test.mjs:18`) → every result card shows Arabic twice and Malay twice. Search `rahmat maha tuhan` → text rendered three times.

The show-more path (`app.js:546-566`) inherits the same bug because it re-invokes `renderCard(results[i], state._lastTerms)`.

The test suite passes because the assertions target `search()` (line 17-19) and never instantiate `renderCard`, so the defect is invisible to `node:test`.

**Fix:** build a single combined regex covering all terms and make a single pass per field. For example:

```js
function appendLatinHighlighted(container, text, terms) {
  // terms: array of raw strings; build alternation of escaped terms
  var parts = terms.map(esc).filter(Boolean);
  if (!parts.length) { container.appendChild(document.createTextNode(text)); return; }
  var re = new RegExp('(' + parts.join('|') + ')', 'gi');
  text.split(re).forEach(function (chunk, i) {
    if (i % 2 === 1) {
      var mark = document.createElement('mark');
      mark.appendChild(document.createTextNode(chunk));
      container.appendChild(mark);
    } else if (chunk) {
      container.appendChild(document.createTextNode(chunk));
    }
  });
}
```

…and refactor `appendHighlighted` similarly (build a single fold-aware Arabic regex from all terms, or run each term's regex over the SAME list of `(start,end)` ranges and merge them before slicing). Then `renderCard` makes one call per side:

```js
if (terms && terms.length) {
  appendHighlighted(arabicEl, verse.arabic, terms);
} else {
  arabicEl.textContent = verse.arabic;
}
// likewise for malayEl / appendLatinHighlighted
```

## Warnings

### WR-01: Dead code — the "no results" body message is never displayed

**File:** `app.js:486-497` (definition), `app.js:468-471` (the call that bypasses it)
**Issue:**
`showNoResultsState(terms)` has a single call site:

```js
// app.js:468-471
if (total === 0) {
  showNoResultsState();   // no terms argument
  return;
}
```

`showResultsState(count, total)` does not receive `terms`, so it cannot forward them. Inside `showNoResultsState`, the guard `if (terms && terms.length)` (app.js:492) is therefore always false and the line at app.js:493 (`els.noResultsBody.textContent = 'Tiada ayat yang mengandungi "' + terms.join(' ') + '".';`) is unreachable. The `<p class="no-results-body">` element (index.html:44) ships empty in production — the user sees the heading "Tiada padanan ditemui" but no body explaining what was searched.

**Fix:** let `runSearch` short-circuit to `showNoResultsState(terms)` directly when `results.length === 0`, instead of routing through `showResultsState`:

```js
// in runSearch, after the for-loop that builds result cards:
if (results.length === 0) {
  showNoResultsState(terms);
} else {
  showResultsState(showCount, results.length);
}
```

…and delete the `if (total === 0) { showNoResultsState(); return; }` branch from `showResultsState`.

### WR-02: `surahLabel` assumes `state.surahs` is a positionally-indexed array

**File:** `app.js:249-251`
**Issue:**
```js
var en = (state && state.surahs)
  ? state.surahs[verse.surah - 1].name_en_translation
  : (m && m.en ? m.en : '');
```
This silently couples the function to `api/surahs.json` being a 1-indexed-by-position array (surah N at index N-1). If the JSON is ever reshaped (e.g. keyed by id, reordered, sparse), this returns the wrong English name with no error — and there is no test that exercises the `state.surahs` branch (the existing `surahLabel` test at app.test.mjs:27-33 only covers the fallback path).

**Fix:** either (a) look up by an explicit id field, e.g. `state.surahs.find(s => s.number === verse.surah)`, or (b) document the invariant in a comment and add a test that loads the real `api/surahs.json` and verifies `state.surahs[113].name_en_translation` matches `MALAY_SURAH_NAMES[114].en`.

### WR-03: Fetch failures are silently swallowed — no diagnostic for ops

**File:** `app.js:597-599`
**Issue:**
```js
}).catch(function () {
  showErrorState();
});
```
The thrown `Error` (which already encodes the HTTP status at app.js:580) is dropped. For a static GitHub Pages deploy the most likely failure modes are 404 (wrong base path) and network/CORS — operators get zero signal. There is also no `console.warn`/`console.error` anywhere in the file.

**Fix:** at minimum log the error so a developer with DevTools open can see what happened:
```js
}).catch(function (err) {
  if (typeof console !== 'undefined' && console.warn) {
    console.warn('loadIndex failed:', err && err.message);
  }
  showErrorState();
});
```

### WR-04: `fuzzySuggest` mixes `qAr` and `qMs` Levenshtein against a bucket keyed only by `qAr`

**File:** `app.js:319-351`
**Issue:**
The candidate bucket is selected using `qAr` only:

```js
var qAr = foldAr(q);
var qMs = foldMs(q);
var qLen = qAr.length;          // used for length banding
var fc = qAr[0];                // used for first-char bucket
var fcMap = state._wordIndex.get(fc);
```

But then BOTH `levAtMost(qAr, entry.word, threshold)` and `levAtMost(qMs, entry.word, threshold)` are computed against the same bucket (app.js:333, 342). When a Latin query like `beriman` has `qAr === qMs` (no Arabic chars fold), this is fine. But for queries where the Arabic and Malay forms diverge, the `qMs` Levenshtein is being run against words whose first character / length match `qAr`, not `qMs` — so close Malay matches whose first char differs from `qAr[0]` are never considered. The result is inconsistent suggestion quality depending on script.

**Fix:** look up two buckets independently:
```js
var arMap = state._wordIndex.get(qAr[0]);
var msMap = state._wordIndex.get(qMs[0]);
// iterate arMap with levAtMost(qAr, ...), iterate msMap with levAtMost(qMs, ...)
// (or simply key the index by (script, firstChar, length) at build time)
```

### WR-05: Stage-site step has no `_site` cleanup; merges into stale output on re-run

**File:** `.github/workflows/deploy-pages.yml:36`
**Issue:**
```yaml
run: mkdir -p _site && cp -r api _site/ && cp index.html style.css app.js _site/
```
`mkdir -p` is idempotent and `cp -r api _site/` will **merge** into a pre-existing `_site/api`. In a clean GitHub Actions runner this is harmless, but anyone reproducing the build locally (or any future step that writes intermediate output to `_site`) will silently accumulate stale files. The Phase-4 edit itself correctly stages exactly the four artifacts (api/, index.html, style.css, app.js) and excludes `app.test.mjs` and `quran.db` — the safety property holds; this finding is about idempotency only.

**Fix:** prepend `rm -rf _site`:
```yaml
run: rm -rf _site && mkdir -p _site && cp -r api _site/ && cp index.html style.css app.js _site/
```

## Info

### IN-01: Dead initial value `state._shownCount = 100`

**File:** `app.js:376`
**Issue:** The initial value is unconditionally overwritten by `runSearch` (app.js:518) before any code reads it. Harmless but suggests stale refactoring state.
**Fix:** delete the `_shownCount: 100` key from the `state` literal, or keep it but document why.

### IN-02: Search input lacks a `<label>` element

**File:** `index.html:22`
**Issue:** The input has `aria-label="Carian ayat Al-Quran"` but no associated `<label for="search-input">`. Screen readers handle `aria-label`, but the explicit `<label>` pattern is more robustly supported across AT and would also enable click-to-focus on the label text.
**Fix:** add `<label for="search-input" class="visually-hidden">Carian ayat Al-Quran</label>` (and reuse the existing `.skip-link` off-screen technique or a `.visually-hidden` utility class).

### IN-03: Two `role="status"` live regions announce overlapping state

**File:** `index.html:24` and `index.html:30`
**Issue:** Both `#status` (line 24) and the `.loading-card` section (line 30) carry `role="status"`. SR users may hear "Memuatkan indeks…" announced twice (once from each live region). The loading card is also a visual sibling of `#status`.
**Fix:** drop `role="status"` from the `.loading-card` section and let `#status` be the single source of polite announcements, or use `aria-hidden="true"` on the visual card while `#status` carries the live text.

### IN-04: Inconsistent transliteration in `MALAY_SURAH_NAMES`

**File:** `app.js:125-240`
**Issue:** Several entries mix transliteration styles — e.g. line 224 `'Al-Zalzalah'` (sun-letter rule would give `'Az-Zalzalah'`), line 145 `'Taahaa'` (more commonly `Ta-Ha`), line 161 `'Yaasin'` vs line 218 `'Adh-Dhuha'`. Not a code defect, but reduces the value of the data as a canonical reference and means some searches against `surahLabel` output won't match conventions users expect.
**Fix:** pick one transliteration convention (e.g. Dewan Bahasa dan Pustaka) and normalize all 114 entries.

### IN-05: Tests use `assert.equal` (`==`) instead of `assert.strictEqual`

**File:** `app.test.mjs:9, 18, 28, 32`
**Issue:** `node:assert/strict` is imported, but `assert.equal` still performs `==` comparison. For primitive string/number comparisons this is fine, but it weakens the type-safety net that `strict` was imported to provide.
**Fix:** use `assert.strictEqual` and `assert.deepStrictEqual` throughout.

### IN-06: No tests cover the rendering helpers where CR-01 lives

**File:** `app.test.mjs` (whole file)
**Issue:** The test file covers `foldAr`, `foldMs`, `search`, `surahLabel`, `MALAY_SURAH_NAMES`, and one id-order invariant — but does not exercise `arRegex`, `appendHighlighted`, `appendLatinHighlighted`, `renderCard`, or `levAtMost`. The CR-01 duplication bug is therefore invisible to CI. Adding even a smoke test with jsdom (or refactoring the highlight helpers to be pure string functions returning token arrays) would have caught it.
**Fix:** add unit tests for the highlight helpers; alternatively (and more pragmatically for a stdlib-only project) refactor `appendHighlighted`/`appendLatinHighlighted` to delegate to a pure `function highlightSegments(text, terms) -> [{text, mark: bool}]` and test that.

---

_Reviewed: 2026-07-31_
_Reviewer: OpenCode (gsd-code-reviewer)_
_Depth: standard_
