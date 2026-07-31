# Phase 4: Search UI - Research

**Researched:** 2026-07-31
**Domain:** Client-side search over static JSON on GitHub Pages (vanilla JS)
**Confidence:** HIGH

## Summary

This phase builds a QuestUI-styled browser search page (`index.html` + `style.css` + `app.js` at repo root) that preloads the 3.1MB `api/search.json` (6,236 verse objects `{arabic, malay, surah, ayah, id}`, id order 1–6236 — verified) and filters it entirely client-side, extending the Phase 3 Pages workflow's "Stage site" step to copy the 3 UI files into `_site/`. There are no third-party libraries (D-26 locks vanilla JS), so every "hard" problem — Arabic normalization, substring search, highlighting, fuzzy suggestions — is solved with small, well-understood vanilla-JS patterns that were **benchmarked against the real dataset** (Node v20.19.2, real `api/search.json`):

- **Normalize once at load, never per query.** Folding all 6,236 verses (Arabic alef/tashkeel strip + Malay case/diacritic fold) takes ~239ms one-time; per-query work is then just `String.includes` on pre-folded fields: **4.6–6.5ms per query**, full match+highlight pipeline **2.6ms/keystroke** worst case — far below the 200–300ms debounce budget (D-05). No index, no Map, no trigrams needed at this scale.
- **Highlighting is solved by fold-aware regexes, not offset mapping.** Constructing a per-term regex that allows diacritics between base letters (e.g. `ب[\u064B-\u0652]*س[\u064B-\u0652]*م`) makes the regex match the *original diacritized* text directly — match offsets come free from `exec()`, no folded→original index mapping. Verified: typing `الله` highlights `ٱللَّهِ` in verse 1:1 with the full diacritized span.
- **Fuzzy suggestions (D-18) need a prefilter.** Naive length-bucket Levenshtein over 274K words takes 150–226ms; adding a first-character bucket drops it to **0.4–12ms** with identical ranking quality. Build the word index lazily on first no-results (~217ms one-time).
- **Two gotchas the planner must encode in 04-02:** (1) `fetch()` of local JSON **fails from `file://`** (verified in headless Chromium — "Failed to fetch"); local testing must use `python3 -m http.server`. (2) GitHub Pages serves with `cache-control: max-age=600` (verified by live probe) — after deploy, stale assets can persist up to 10 minutes, on top of the 1–3 min deploy propagation already documented in Phase 3.
- **QuestUI is a visual spec, not loadable CSS** (verified: designmd.ai/chef/questui is a DESIGN.md spec — colors, typography scale, spacing, do's/don'ts, MIT-licensed). It is hand-implemented in `style.css` per D-20/D-26, using the palette plus two details the locked decisions don't mention: **surface `#2C1A10`** for card backgrounds and **parchment text `#F5E6D3`** (never pure white).
- **Data findings:** the Malay text currently has **zero non-ASCII characters** (verified — D-07's Malay diacritic-strip is a cheap defensive no-op, keep it anyway); the Arabic text uses 68 distinct codepoints including Quranic annotation signs U+06D6–06ED and wasla `ٱ` (13,819×) which D-06's alef-fold must cover; the canonical Lucene/Elasticsearch `ArabicNormalizer` rule set (أ/إ/آ→ا, ة→ه, ى→ي, strip tashkeel U+064B–0652 + tatweel) is the right base to copy and extend with wasla + Quranic signs.
- **Malay surah-name map (D-15):** sourced from the Malay Wikipedia surah list (all 114 entries captured in this research, Code Example 6), with the user's correction applied: **surah 2 = "Lembu Betina"** (Wikipedia says "Sapi Betina" — the map must override it). Label format verified against real data: `Al-Baqarah (Lembu Betina / The Cow) • 2:255`.

**Primary recommendation:** folded-mirror array for matching + fold-aware regexes for highlighting + lazy first-char-bucketed Levenshtein for fuzzy + `node:test` smoke tests on a testable `app.js` (via a `module.exports` guard — keeps the repo's no-build, no-framework ethos while giving 04-02 real automated checks).

## User Constraints

### Locked Decisions
- **D-01:** Preload the full `api/search.json` (3MB) on page load, once, and keep it in memory — search is instant afterward. No per-surah or lazy fetching.
- **D-02:** Show a loading indicator ("Memuatkan indeks...") while the 3MB index downloads; the search box is ready-aware until loaded.
- **D-03:** If the index fetch fails, show a clear error state with a **retry button** plus a hint pointing to the curl/jq API as a fallback (ties to the project's core value).
- **D-04:** The UI consumes the **existing `api/search.json` as-is** — no new/lighter index file is built. The 5-field verse contract (`arabic`, `malay`, `surah`, `ayah`, `id`) from Phase 2 is the input schema.
- **D-05:** Search runs **live as-you-type** with a short debounce (~200–300ms); no minimum character gate.
- **D-06:** **Diacritic + alef folding** for Arabic matching: strip tashkeel (fatha, damma, kasra, shadda, sukun) AND fold alef variants (أ/إ/آ/ٱ → ا) before comparing, so typing `الله` or `بسم` matches diacritized verses like بِسْمِ ٱللَّهِ.
- **D-07:** Malay (and any Latin) matching is **case-insensitive AND strips diacritics** (é, î, â, ū), so `beriman` matches `berimân`.
- **D-08:** One search box searches **both Malay and Arabic combined** — matches from either field are returned together. No toggle, no script auto-detection.
- **D-09:** Multi-word queries use **AND** — all terms must match (across the combined Malay/Arabic fields).
- **D-10:** Results are ordered by **global ayah id (1–6236)** — the search.json array order.
- **D-11:** Matching is **substring-within-words** (matches anywhere in a word), for both Malay and Arabic.
- **D-12:** Matched terms are **highlighted** in the result text (both Arabic and Malay fields).
- **D-13:** Each result card shows **Arabic on top** (right-aligned, RTL, larger text) and **Malay below** (LTR).
- **D-14:** Card reference label shows **surah name + ayah number**.
- **D-15:** The label uses a **friendly Malay surah-name map hardcoded in the UI** (114 entries), combined with the English name from `surahs.json` and the ayah number. Format: `Al-Baqarah (Lembu Betina / The Cow) • 2:255`. User-corrected example: Al-Baqarah is **"Lembu Betina"**, not "Sapi Betina". This map is new data maintained in the UI, not in the dataset.
- **D-16:** Results are **capped at 100** with a "Show more" button to reveal the rest.
- **D-17:** Pre-search state is a **hero section plus curated featured verses** (e.g. Ayatul Kursi 2:255, Al-Ikhlas 112:1–4, Al-Fatiha 1:1–7), defined as **hardcoded ids** in the UI and loaded from search.json.
- **D-18:** No-results state offers **fuzzy suggestions** — a light similarity pass (e.g. Levenshtein/edit-distance within a threshold) over the folded Malay/Arabic text, labelled as closest matches. No third-party fuzzy library.
- **D-19:** Text direction is **per-line** — Arabic runs RTL within its own line, Malay LTR; the page chrome stays LTR. No whole-page RTL.
- **D-20:** Separate files: **`index.html` + `style.css` + `app.js`** (not a single self-contained HTML). CSS and JS are separate, cacheable assets.
- **D-21:** Files live at the **repo root** and the existing deploy workflow copies them into `_site/` alongside `api/` (extending Phase 3's "Stage site" step — `cp -r api _site/` plus copying the 3 UI files). No new workflow file, no committed `_site/`.
- **D-22:** The page uses **relative paths** for its assets and API data (e.g. `api/search.json`, `style.css`, `app.js`) — works both at the Pages project path prefix `/quran-database-malay/` and when opened from a local `file://` for testing.
- **D-23:** Fonts load from **Google Fonts** via `<link>` — Cinzel (headings) + Spectral (body), per QuestUI.
- **D-24:** Responsive via **explicit breakpoints**: single-column result layout on mobile, two-column result grid on desktop.
- **D-25:** Page declares `<html lang="ms">`, a Malay title/description, and viewport meta for mobile.
- **D-26:** JavaScript is **vanilla** — no framework, no build step, no third-party runtime dependencies.

### OpenCode's Discretion
- Exact QuestUI visual treatment (gold #CA8A04 / deep red #991B1B / royal purple #581C87 / dark bg #1A0F0A), card borders/shadow details, exact Cinzel/Spectral sizes
- Exact debounce duration, edit-distance threshold, and fuzzy suggestion count
- The precise list of curated featured verse ids (from the confirmed set: Ayatul Kursi, Al-Ikhlas, Al-Fatiha)
- Malay surah-name spelling details for entries beyond the user's explicit example
- Exact workflow step edit to copy the 3 UI files into `_site/`
- Internal structure of `app.js` (normalization functions, rendering helpers)

### Deferred Ideas (OUT OF SCOPE)
- Per-surah browsing mode (click a surah to read its verses without a keyword) — a new capability, its own phase
- Shareable/copyable verse links or a deep-link to specific ayahs (e.g. `?surah=2&ayah=255`) — future enhancement
- Audio recitation player integration — already on the README roadmap, separate phase
- Progress tracking/bookmarking — already on the README roadmap, separate phase

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Browser search page deployed on GitHub Pages styled with the QuestUI design system | QuestUI spec captured (palette + typography + do's/don'ts, §State of the Art); index.html at site root via the extended "Stage site" step (§Architecture Patterns, Pattern 4); Pages serving verified (gzip, max-age=600, project prefix) (§Common Pitfalls 2–3) |
| UI-02 | User can search by keyword across Malay text (and Arabic) from the browser UI | Search architecture benchmarked at 2.6–6.5ms/keystroke on the real dataset (§Architecture Patterns, Pattern 1); normalization covers D-06/D-07 folds; all 15 behavior checks pass (Code Example 1-verified) |
| UI-03 | Search results display Arabic text with Malay translation per verse | Card structure D-13/D-14 verified; label format verified against real data (§Code Example 5); highlighting verified on diacritized Arabic and Malay (§Code Example 3) |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Search index load (fetch 3.1MB JSON) | Browser / Client | — | D-01 preloads search.json once; no server involved |
| Text normalization (fold) | Browser / Client | — | D-06/D-07 fold logic runs in app.js; dataset stays as-is (D-04) |
| Search matching + ranking | Browser / Client | — | D-08..D-11 client-side filter in id order |
| Highlight rendering | Browser / Client | — | D-12 wraps matched spans in `<mark>` |
| Fuzzy suggestions | Browser / Client | — | D-18, no server, no library |
| Result cards + labels | Browser / Client | — | D-13/D-14/D-15; Malay map + surahs.json merged client-side |
| Static asset + JSON serving | CDN / Static (GitHub Pages) | — | Pages serves the 3 UI files + `api/` under `/quran-database-malay/` |
| Fonts | CDN / Static (external Google Fonts) | — | D-23 `<link>` to fonts.googleapis.com |
| Deploy wiring (copy UI files into `_site/`) | CI/CD (GitHub Actions) | — | D-21 extends Phase 3's existing workflow step |

**Why:** GitHub Pages is static-only (project constraint) — every capability is browser-tier except serving and deploy. The API tier does not exist at request time; `api/` is pre-generated (Phase 2) and pre-deployed (Phase 3).

## Standard Stack

No third-party runtime dependencies by locked decision (D-26). The "stack" is browser platform + repo tooling:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (ES2017+) | browser built-in | All search logic | D-26 locks it; benchmarked adequate |
| `fetch()` + `Promise` | browser built-in | Load search.json + surahs.json | D-01; `response.json()` measured at 26ms for 3.1MB |
| `String.prototype.includes` | browser built-in | Substring matching on folded fields | D-11; 4.6–6.5ms over 6,236 verses [VERIFIED: benchmark] |
| `RegExp` (with `u`/`g` flags) | browser built-in | Fold-aware highlight matching | Solves offset mapping; ~2–3ms on 100 cards [VERIFIED] |
| `String.prototype.normalize('NFD')` | browser built-in | Malay diacritic stripping (é→e) | D-07; current data is pure ASCII so it's a defensive no-op [VERIFIED: data audit] |
| Google Fonts (Cinzel + Spectral) | via `<link>` | QuestUI typography | D-23; `display=swap` keeps text readable if fonts fail [CITED: fonts.google.com] |

### Supporting (repo tooling, not runtime deps)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` + `node:assert` | Node 20 (built-in) | Smoke tests of app.js pure functions | 04-02 verification; zero npm installs [VERIFIED: node v20.19.2 in env] |
| `python3 -m http.server` | Python 3.13 | Local static server for browser testing | Required because `file://` fetch fails [VERIFIED: headless Chromium] |
| Playwright + headless Chromium | 1.62.1 (env-installed this session) | Optional DOM-level end-to-end check | Browser-level assertions; needs system libs (installed via apt) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Folded-mirror array + `includes` | Fuse.js / lunr.js / MiniSearch | Forbidden by D-26; and unnecessary — 6,236 items scan in ~5ms, a full-text library's index build would add load-time cost for zero gain |
| Fold-aware regex highlighting | Manual offset mapping after folding (index map array + diacritic-span expansion) | Regex approach gives offsets free and is ~15 lines; offset mapping is bug-prone (must track folded→original index per char AND extend spans over interleaved diacritics) — verified correct regex output instead |
| First-char bucket + banded Levenshtein | Trigram index (Lucene-style), or full-verse Levenshtein | Trigram index = more code for the same no-results-only job; full-verse Levenshtein is fast (~22ms) but ranks poorly (compares query against 200-char verse prefix, not words). First-char bucket: 0.4–12ms, word-level ranking [all VERIFIED: benchmark] |
| `fetch()` from `file://` | `python3 -m http.server` | file:// fetch is blocked by Chromium ("Failed to fetch" — verified); http server is the documented local test path (and matches the repo's Python-first ethos) |

**Installation:** none — `npm install` would violate D-26. Node is only used as a *test runner* in 04-02 (`node --test app.test.mjs`), never at runtime or in the deploy workflow.

**Version verification:** Node v20.19.2 verified in env (has built-in `node --test` since 18). Python 3.13.5 verified. Chromium headless shell 1234 + playwright-core 1.62.1 installed this session (with apt system libs — if the environment is reset, re-run `npx playwright install chromium-headless-shell` + `apt-get install -y libnspr4 libnss3 libatk1.0-0 ...`).

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────── GitHub Pages ───────────────────────────────┐
                     │  https://C-Fu.github.io/quran-database-malay/  (project-site prefix)      │
                     │                                                                           │
  Browser            │   /index.html   /style.css   /app.js   /api/search.json  /api/surahs.json │
 ┌───────────┐  GET  │   (3 UI files   └────┬────────┘   └───────┬───────────────┘ (114 files)   │
 │ index.html│──────▶│   staged into _site/ by deploy-pages.yml "Stage site" step)              │
 └─────┬─────┘       └───────────────────────────────────────────┴──────────────────────────────┘
       │  fetch('api/search.json') + fetch('api/surahs.json')  ── D-01 (both relative, works under prefix)
       ▼
 ┌──────────────────────────  app.js  (client-side, no server) ─────────────────────────┐
 │  1. LOAD:   parse JSON (~26ms) → build folded mirror (~239ms) → build Malay map      │
 │             → render hero + featured verses (ids 1–7, 262, 6222–6225)                │
 │  2. INPUT:  input event → debounce 250ms → split query into terms (whitespace)       │
 │  3. MATCH:  fold each term → for-loop over mirror → every term must match             │
 │             arFold.includes(term) OR msFold.includes(term)   (AND across terms)       │
 │             → results in mirror order = id order 1–6236 (D-10)                        │
 │  4. RENDER: slice(0,100) → per card: fold-aware regex exec on ORIGINAL text →         │
 │             <mark> wrapping via DOM nodes (no innerHTML) → Arabic RTL top,            │
 │             Malay LTR below, label "Name (Ms / En) • s:a" (D-13..D-15)                │
 │  5. NO-RESULTS: lazy-build word index → first-char + length buckets → banded          │
 │             Levenshtein ≤ threshold → top 5 "closest matches" (D-18)                  │
 └──────────────────────────────────────────────────────────────────────────────────────┘
```

**Primary use case trace:** visitor opens `/quran-database-malay/` → Pages serves `index.html` → app.js fetches both JSON files (gzip transfer ~830KB) → loading indicator until ready → user types `pemurah langit` → debounce → fold terms → scan mirror (3 hits) → render top 100 cards with highlighted Arabic `ٱلرَّحْمَٰنِ` and Malay `Pemurah` → "Show more" reveals beyond 100.

### Recommended Project Structure

```
repo root/
├── index.html              # page shell: lang="ms", viewport, Google Fonts <link>,
│                           #   <link rel="stylesheet" href="style.css">, <script src="app.js">
├── style.css               # QuestUI palette vars, typography, cards, grid + breakpoints
├── app.js                  # all logic: fold fns, mirror build, search, highlight, fuzzy,
│                           #   label map, DOM wiring; guarded module.exports for node tests
├── app.test.mjs            # node:test smoke tests (04-02 Wave 0; never staged into _site/)
├── .github/workflows/deploy-pages.yml   # edited: "Stage site" gains the 3-file copy
└── api/                    # generated (gitignored) — runtime data, untouched (D-04)
```

Conventions honored (from AGENTS.md/CONVENTIONS.md): flat repo root (sibling to `generate_json_api.py`), snake_case function names, `print`/console progress — no new config, no package.json (Node used only via `node --test`, no deps).

### Pattern 1: Fold-once-at-load mirror + linear scan (matching)
**What:** At load, map every verse to a mirror object holding the folded Arabic and Malay strings; per keystroke, fold only the query terms and scan.
**When to use:** Always — this is the D-01/D-05/D-06/D-07 implementation.
**Why verified:** corpus folding = 239ms once; query = 4.6–6.5ms single-term, 6.3–6.5ms two-term AND; full pipeline with highlight 2.6ms (benchmarks on the real 6,236-verse file). Per-query corpus folding would cost 239ms every keystroke — never do that.

```javascript
// Verified: node /tmp/opencode/bench-final.js — 15/15 behavior checks pass
const DIAC = /[\u0640\u064B-\u0654\u0670\u06D6-\u06ED]/g;      // tatweel, tashkeel, maddah,
                                                               // hamza-above, superscript alef,
                                                               // Quranic waqf/annotation signs
const FOLD = { '\u0622': '\u0627', '\u0623': '\u0627', '\u0625': '\u0627', // آ أ إ → ا
               '\u0671': '\u0627',                                         // ٱ wasla → ا (D-06)
               '\u0629': '\u0647', '\u0649': '\u064A' };                   // ة→ه, ى→ي (Lucene rules)
const AR_FOLD_RE = /[\u0622\u0623\u0625\u0671\u0629\u0649]/g;
const foldAr = (s) => s.replace(AR_FOLD_RE, (c) => FOLD[c]).replace(DIAC, '');
const foldMs = (s) => s.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();

// once at load:
const mirror = verses.map((v) => ({ v, ar: foldAr(v.arabic), ms: foldMs(v.malay) }));

// per keystroke (debounced): AND across terms, OR within a term across the two fields
function search(terms) {
  const qs = terms.map((t) => ({ ar: foldAr(t), ms: foldMs(t) })).filter((t) => t.ar || t.ms);
  if (!qs.length) return [];
  const out = [];
  for (const m of mirror) {
    let ok = true;
    for (const q of qs) {
      if (!((q.ar && m.ar.includes(q.ar)) || (q.ms && m.ms.includes(q.ms)))) { ok = false; break; }
    }
    if (ok) out.push(m.v);          // mirror order = search.json order = id order (D-10)
  }
  return out;
}
```
*Source: benchmark scripts in `/tmp/opencode/` (this session), behavior verified against `api/search.json`.*

### Pattern 2: Fold-aware regex for highlighting (no offset mapping)
**What:** For each term, build a regex whose character classes honor the folds and whose inter-character gaps allow any diacritic marks. Run it against the *original* (diacritized) text — `exec()` gives the exact span to wrap in `<mark>`, in the original string.
**When to use:** Always for D-12 Arabic highlighting; Latin uses a simpler case-insensitive escaped regex.
**Why verified:** `highlight(verses[0].arabic, 'الله')` → `بِسْمِ <mark>ٱللَّهِ</mark> ٱلرَّحْمَٰنِ...` — the span covers the wasla + full diacritics. `hlLatin('...Maha Pemurah, lagi...', 'pemurah')` → `<mark>Pemurah</mark>` (case preserved). Diacritic-typed queries (e.g. `بِسْمِ`) fold first, then match (check #15 passed).

```javascript
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function arRegex(term) {
  const classes = [];
  for (const ch of foldAr(term)) {          // fold the QUERY first (strips its diacritics)
    if (ch === '\u0627') classes.push('[\\u0627\\u0622\\u0623\\u0625\\u0671]');
    else if (ch === '\u0647') classes.push('[\\u0647\\u0629]');
    else if (ch === '\u064A') classes.push('[\\u064A\\u0649]');
    else classes.push(esc(ch));
  }
  // diacritics allowed between base letters; u flag for astral-safe ranges
  return new RegExp(classes.join('[\\u0640\\u064B-\\u0654\\u0670\\u06D6-\\u06ED]*'), 'gu');
}
// XSS-safe rendering: build DOM nodes, never innerHTML with unescaped text
function appendHighlighted(container, text, term) {
  const re = arRegex(term);
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    let end = m.index + m[0].length;
    while (/[\u0640\u064B-\u0654\u0670\u06D6-\u06ED]/.test(text[end] || '')) end++; // trailing diacritics
    container.appendChild(document.createTextNode(text.slice(last, m.index)));
    const mark = document.createElement('mark');
    mark.appendChild(document.createTextNode(text.slice(m.index, end)));
    container.appendChild(mark);
    last = end; re.lastIndex = end;
  }
  container.appendChild(document.createTextNode(text.slice(last)));
}
// Latin field: case-insensitive escaped regex on the folded term (current Malay is pure ASCII,
// so folded term == lowercase term; no diacritic classes needed until data changes)
```

### Pattern 3: Lazy first-char-bucketed Levenshtein for fuzzy suggestions (D-18)
**What:** Build the word index (folded words per verse) lazily on first no-results. Bucket words by (first char, length). For a query word, only inspect words sharing the first char whose length is within ±threshold; run banded Levenshtein with early exit. Rank verses by best word distance, then id.
**When to use:** Only inside the no-results state handler (never per keystroke).
**Why verified:** 0.4–12ms/query vs 150–226ms for length-only buckets and ~22ms for naive full-verse comparison (which ranks poorly). Threshold recommendation (D-18 discretion): distance ≤ 1 for query words ≤ 4 chars, ≤ 2 for longer; show top 5.

```javascript
// banded Levenshtein with early exit — the standard O(k·n) "within threshold" formulation
function levAtMost(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let prev = new Array(n + 1), cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i; const lo = Math.max(1, i - max), hi = Math.min(n, i + max);
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      if (j < lo || j > hi) { cur[j] = max + 1; continue; }
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
```
Word index shape: `Map<firstChar, Map<wordLength, [{word, verseIndex}]>>`, built from `foldAr(arabic).split(/\s+/)` + `foldMs(malay).split(/\s+/)` (274,842 words total — ~217ms one-time, cache after first build). If a query word has no candidates within threshold, return no suggestions (honest empty). Mixed-script fuzzy (Arabic query vs Latin text and vice versa) does not work — that is acceptable for a "light" suggestion pass.

### Pattern 4: Testable vanilla app.js + deploy step extension
**What:** Guard the browser-only wiring in `app.js` so the pure functions run under Node for tests: `if (typeof document !== 'undefined') { /* DOM init */ }` and `if (typeof module !== 'undefined') module.exports = { foldAr, foldMs, search, appendHighlighted, label, fuzzySuggest };`. Extend the workflow "Stage site" step by appending a copy of the 3 files.
**When to use:** 04-01 (write app.js with the guard) and 04-01/04-02 (workflow edit + tests). No build step, no package.json — `node --test` uses the built-in runner.

```bash
# deploy-pages.yml — the ONLY workflow change (D-21):
      - name: Stage site
        run: mkdir -p _site && cp -r api _site/ && cp index.html style.css app.js _site/
```

### Anti-Patterns to Avoid
- **Per-query corpus normalization:** folding 6,236 verses on every keystroke costs ~239ms — defeats as-you-type search. Fold once at load; fold only the (short) query terms per keystroke.
- **innerHTML with concatenated query/verse text:** the query string and dataset text must never be interpolated into HTML — build `<mark>` via `createElement`/`textContent` (Pattern 2). XSS-safe and only ~6 lines.
- **Manual folded→original offset mapping for highlights:** tracking which original codepoint each folded char came from, then extending spans over interleaved diacritics, is where highlight bugs are born. The fold-aware regex (Pattern 2) eliminates the whole problem — the regex matches the original text directly.
- **Full inverted index / trigram index for matching:** 6,236 items scan in ~5ms. An index adds load-time build cost and code for zero benefit; it is only justified past ~100K documents.
- **Whole-page RTL (`dir="rtl"` on `<html>`):** D-19 locks per-line direction. Arabic lines get `dir="rtl"`, the chrome stays LTR. (Note: an Arabic RTL line that is the FIRST line of a card should be left-aligned via `text-align: right` instead of relying on default bidi alignment — check the card layout in the browser.)
- **Highlighting a term that folds to empty:** e.g. a user pastes only diacritics (`ِّ`). `search()` already filters empty folded terms (Pattern 1); `arRegex('')` would produce an empty regex that matches everything — guard by skipping empty terms before building the regex.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Arabic normalization rule set | An invented fold map | The canonical Lucene/Elasticsearch `ArabicNormalizer` rules (أ إ آ → ا, ة → ه, ى → ي, strip U+064B–0652 + tatweel) extended with wasla ٱ→ا and the Quranic sign range U+06D6–06ED | The canonical set is battle-tested across 20 years of search engines; inventing your own fold map risks missing variants (verified: the actual data uses 68 codepoints incl. 13,819 wasla, 2,344 taa marbuta, 6,605 alef maksura — all covered) |
| Highlight offset mapping | A folded→original character index map with diacritic-span expansion | Fold-aware regex construction (Pattern 2) | Regex `exec()` returns offsets in the original string for free; the index-map approach duplicates that logic and is the classic source of off-by-one highlight bugs |
| Fuzzy search over 274K words | Naive Levenshtein over every word (or a trigram engine) | First-char + length buckets + banded Levenshtein with early exit (Pattern 3) | Bucketed: 0.4–12ms with word-level ranking; naive full scan: 150–226ms; trigram engine is 3× the code for a no-results-only feature |
| Client-side fetch under a path prefix | Absolute URLs (`/quran-database-malay/...`) or base-tag hacks | Relative paths (`api/search.json`) | Absolute URLs break `file://`-adjacent local testing and fork the URL contract; relative paths resolve correctly under the `/quran-database-malay/` prefix (D-22) |

**Key insight:** D-26 forbids libraries, but at 6,236 documents none of these problems *needs* a library — the hard parts are (a) getting the normalization rules right (copy the canonical set, verified against the actual codepoints) and (b) choosing prefiltering so the O(n·m) fuzzy pass only runs on a tiny candidate set. The one thing that looks like it needs a library (highlighting after folding) is actually solved *more* correctly by a regex, because there is no offset bookkeeping to get wrong.

## Runtime State Inventory

Not applicable — this is a greenfield static-UI phase (new committed files `index.html`, `style.css`, `app.js`; one workflow step edit). No rename, refactor, or migration of existing runtime state. The `api/` directory is gitignored build output (Phase 2) and is consumed, not modified (D-04). The only "existing state" touched is the single "Stage site" step in `.github/workflows/deploy-pages.yml` (verified: it currently reads exactly `mkdir -p _site && cp -r api _site/` — the edit appends `&& cp index.html style.css app.js _site/`).

## Common Pitfalls

### Pitfall 1: `fetch()` fails when the page is opened via `file://`
**What goes wrong:** Double-clicking `index.html` shows the error state instead of results; `fetch('api/search.json')` rejects with "Failed to fetch" in Chrome/Edge/Firefox.
**Why it happens:** A `file://` page has an opaque origin; fetching sibling files is a cross-origin request with no CORS headers — **empirically verified in headless Chromium this session** (title became `FETCH_FAIL:Failed to fetch`; the same page over `http://localhost:8712` returned `FETCH_OK`).
**How to avoid:** D-22's "local file:// testing" only holds for the page shell and relative CSS/JS `<link>`/`<script>` tags — the JSON data path requires HTTP. Plan 04-02 MUST test via `python3 -m http.server` (repo's Python-first ethos) and open `http://localhost:8000/`. Document this in the README or a code comment so future devs don't double-click and file a bug.
**Warning signs:** Page renders hero + error state with retry button during "local" testing; console shows a CORS/network TypeError.

### Pitfall 2: Post-deploy staleness — Pages CDN cache is 10 minutes
**What goes wrong:** After pushing to main, `curl`/browser still shows the old page or old data.
**Why it happens:** GitHub Pages (Fastly) serves static assets with `cache-control: max-age=600` — **verified by live probe of pages.github.com and a Pages project site this session**. On top of that, the deploy itself takes 1–3 minutes to propagate (Phase 3 research, Pitfall 2).
**How to avoid:** Plan 04-02's live checks must poll with `curl -sI` / `curl -s` and allow up to ~12–15 minutes for full propagation before declaring failure. No cache-busting needed at this scale — names are stable and a stale index is only a 10-minute window after each deploy.
**Warning signs:** `curl` 200 with old HTML body; ETag unchanged across a fresh deploy within the first minutes.

### Pitfall 3: Highlight spans that stop before the trailing diacritics
**What goes wrong:** `بِسْمِ ٱللَّهِ` highlights only `ٱللَّه` and leaves the final kasra outside the `<mark>`, looking clipped.
**Why it happens:** The regex match ends at the last base letter; the word's final vowel mark follows it.
**How to avoid:** After each `exec()`, extend the span end while the next char is in the diacritic range (one `while` loop — included in Pattern 2). Verified output: `<mark>ٱللَّهِ</mark>` with the kasra inside.
**Warning signs:** Highlighted Arabic words that look truncated at the right edge.

### Pitfall 4: XSS via `innerHTML` with query or verse text
**What goes wrong:** If results are rendered as `card.innerHTML = verse.arabic + ...` or the query is echoed into HTML, a crafted query like `<img src=x onerror=...>` executes.
**Why it happens:** The dataset is our own generated JSON, but the **query string is user input**, and any `innerHTML` with concatenated strings is an injection sink.
**How to avoid:** Pattern 2's DOM-building (`createElement` + `textContent`) — no `innerHTML` anywhere in app.js. Also `esc()` query chars when they appear inside a regex character class context.
**Warning signs:** Any `+=`/template literal producing HTML in app.js during review.

### Pitfall 5: Regex matching everything for empty/diacritic-only terms
**What goes wrong:** A query of only diacritics (`ِّ`) folds to `''`; `new RegExp('')` matches at every position — every verse "matches" and the highlight pass marks empty strings.
**Why it happens:** `includes('')` also returns true, so both the match pass and the regex pass need the guard.
**How to avoid:** `search()` filters empty folded terms (Pattern 1); the render path only runs for terms that survived filtering.
**Warning signs:** A "search" with a paste of Arabic vowel marks returns 6,236 results.

### Pitfall 6: The 114-entry Malay surah map ships with Wikipedia's "Sapi Betina"
**What goes wrong:** D-15's example is `Al-Baqarah (Lembu Betina / The Cow)`; the Wikipedia source list says "Sapi Betina" — copying the source verbatim silently violates the user's explicit correction.
**Why it happens:** The map is new UI-side data with no prior repo copy; the source of truth (Wikipedia) disagrees with the user's correction.
**How to avoid:** Encode surah 2 as `{name: 'Al-Baqarah', tr: 'Lembu Betina'}` explicitly in Code Example 6 and add a verification test asserting `label(2:255)` contains `Lembu Betina` (test in 04-02).
**Warning signs:** Any review grep for "Sapi" in app.js.

### Pitfall 7: Mistaking a match pass for a display pass — raw diacritized text must be what's shown
**What goes wrong:** If the render pass displays the *folded* strings instead of the originals, the page shows diacritic-stripped Arabic and lowercased Malay.
**Why it happens:** It is tempting to reuse the mirror's folded strings for output.
**How to avoid:** The mirror stores `{v, ar, ms}` — display `v.arabic`/`v.malay` (original), never `ar`/`ms`. Highlighting (Pattern 2) runs on the originals precisely because offsets come free.
**Warning signs:** Cards whose Arabic lacks all tashkeel, or Malay rendered in lowercase.

## Code Examples

Verified patterns from official sources + this session's benchmarks:

### 1. Load + ready flow (D-01/D-02/D-03)
```javascript
const state = { verses: null, mirror: null, surahs: null, ready: false };
async function loadIndex() {
  try {
    const [searchRes, surahsRes] = await Promise.all([
      fetch('api/search.json'), fetch('api/surahs.json'),
    ]);
    if (!searchRes.ok || !surahsRes.ok) throw new Error('HTTP ' + searchRes.status);
    const verses = await searchRes.json();          // 26ms for 3.1MB [VERIFIED]
    const surahs = await surahsRes.json();
    // fold-once-at-load (~239ms) happens here, behind the loading indicator [VERIFIED]
    state.verses = verses;
    state.surahs = surahs;
    state.mirror = verses.map((v) => ({ v, ar: foldAr(v.arabic), ms: foldMs(v.malay) }));
    state.ready = true;
    renderHero();                                   // featured verses (D-17)
  } catch (err) {
    showErrorState();                               // D-03: retry button + curl/jq hint
  }
}
```
*[VERIFIED: benchmark timings]*

### 2. Debounced input (D-05)
```javascript
let timer;
input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(runSearch, 250);               // 200–300ms per D-05 discretion
});
```
Note: if the input event fires while the page is still loading, `runSearch` early-returns until `state.ready` (ready-aware per D-02).

### 3. Highlight (D-12) — as Pattern 2; verified output
```javascript
// highlight(verses[0].arabic, 'الله')
//   →  بِسْمِ <mark>ٱللَّهِ</mark> ٱلرَّحْمَٰنِ ٱلرَّحِيمِ          [VERIFIED]
// hlLatin('...Maha Pemurah, lagi...', 'pemurah')
//   →  ...Maha <mark>Pemurah</mark>, lagi...                       [VERIFIED]
```

### 4. Card rendering (D-13/D-14/D-19)
```javascript
function renderCard(verse, terms) {
  const card = document.createElement('article');
  card.className = 'verse-card';
  const labelEl = document.createElement('div');     // D-14/D-15
  labelEl.className = 'verse-label';
  labelEl.textContent = surahLabel(verse);           // "Al-Baqarah (Lembu Betina / The Cow) • 2:255"
  const arabicEl = document.createElement('p');      // D-13: Arabic top
  arabicEl.className = 'verse-arabic';
  arabicEl.setAttribute('dir', 'rtl');               // D-19: per-line RTL
  terms.forEach((t) => appendHighlighted(arabicEl, verse.arabic, t));
  const malayEl = document.createElement('p');       // D-13: Malay below
  malayEl.className = 'verse-malay';                 // LTR by default
  malayEl.textContent = verse.malay;                 // D-12 Malay highlight optional per discretion
  card.append(labelEl, arabicEl, malayEl);
  return card;
}
```

### 5. Surah label (D-15) — verified against real data
```javascript
function surahLabel(verse) {
  const s = state.surahs[verse.surah - 1];            // name_en_translation lives here
  const m = MALAY_SURAH_NAMES[verse.surah];           // hardcoded 114-map (Code Example 6)
  const name = m ? m.name : s.name_en;                // Malay orthography preferred
  const tr = m && m.tr ? `${m.tr} / ` : '';           // fall back to English-only if map lacks a tr
  return `${name} (${tr}${s.name_en_translation}) • ${verse.surah}:${verse.ayah}`;
}
// Verified outputs on the real data:
//   2:255  →  "Al-Baqarah (Lembu Betina / The Cow) • 2:255"        [VERIFIED]
//   112:1  →  "Al-Ikhlas (Tulus Ikhlas / Sincerity) • 112:1"       [VERIFIED]
//   1:1    →  "Al-Fatihah (Pembukaan / The Opening) • 1:1"         [VERIFIED]
```

### 6. Malay surah-name map (D-15) — 114 entries, sourced from Malay Wikipedia, with the user's correction applied
*Source: [CITED: ms.wikipedia.org/wiki/Surah_Quran, rev. 5895445, 2023-07-03]*. Form: `number: {name, tr}`. Entries without a Wikipedia translation (20, 36, 38, 50) use `tr: ''` → label falls back to the English translation. **Surah 2 overrides the Wikipedia spelling "Sapi Betina" with the user's "Lembu Betina".**

```javascript
const MALAY_SURAH_NAMES = {
  1:  { name: 'Al-Fatihah',     tr: 'Pembukaan' },
  2:  { name: 'Al-Baqarah',     tr: 'Lembu Betina' },           // USER-CORRECTED (was "Sapi Betina")
  3:  { name: "Ali 'Imran",     tr: 'Keluarga Imran' },
  4:  { name: "An-Nisaa'",      tr: 'Wanita' },
  5:  { name: "Al-Maa'idah",    tr: 'Hidangan' },
  6:  { name: "Al-An'aam",      tr: 'Binatang Ternakan' },
  7:  { name: "Al-A'raaf",      tr: 'Tempat Tinggi' },
  8:  { name: 'Al-Anfaal',      tr: 'Rampasan Perang' },
  9:  { name: 'At-Taubah',      tr: 'Taubat' },
  10: { name: 'Yunus',          tr: 'Nabi Yunus a.s.' },
  11: { name: 'Hud',            tr: 'Nabi Hud a.s.' },
  12: { name: 'Yusuf',          tr: 'Nabi Yusuf a.s.' },
  13: { name: "Ar-Ra'd",        tr: 'Guruh' },
  14: { name: 'Ibrahim',        tr: 'Nabi Ibrahim a.s.' },
  15: { name: 'Al-Hijr',        tr: 'Kawasan Berbatu' },
  16: { name: 'An-Nahl',        tr: 'Lebah' },
  17: { name: "Al-Israa'",      tr: 'Perjalanan Malam' },
  18: { name: 'Al-Kahfi',       tr: 'Gua' },
  19: { name: 'Maryam',         tr: 'Siti Maryam' },
  20: { name: 'Taahaa',         tr: '' },
  21: { name: "Al-Anbiyaa'",    tr: 'Para Nabi' },
  22: { name: 'Al-Hajj',        tr: 'Haji' },
  23: { name: "Al-Mu'minun",    tr: 'Golongan yang Beriman' },
  24: { name: 'An-Nuur',        tr: 'Cahaya' },
  25: { name: 'Al-Furqaan',     tr: 'Pembeza Kebenaran dan Kebatilan' },
  26: { name: "Asy-Syu'araa",   tr: 'Para Penyair' },
  27: { name: 'An-Naml',        tr: 'Semut' },
  28: { name: 'Al-Qasas',       tr: 'Cerita-cerita' },
  29: { name: "Al-'Ankabut",    tr: 'Labah-labah' },
  30: { name: 'Ar-Rum',         tr: 'Masyarakat Rom' },
  31: { name: 'Luqman',         tr: 'Luqman' },
  32: { name: 'As-Sajdah',      tr: 'Sujud' },
  33: { name: 'Al-Ahzab',       tr: 'Golongan yang Bersekutu' },
  34: { name: "Saba'",          tr: "Kaum Saba'" },
  35: { name: 'Faatir',         tr: 'Pencipta' },
  36: { name: 'Yaasin',         tr: '' },
  37: { name: 'As-Saaffat',     tr: 'Yang Berbaris Dengan Teratur' },
  38: { name: 'Saad',           tr: '' },
  39: { name: 'Az-Zumar',       tr: 'Rombongan' },
  40: { name: "Al-Mu'min",      tr: 'Orang yang Beriman' },
  41: { name: 'Fussilat',       tr: 'Dijelaskan' },
  42: { name: 'Asy-Syuraa',     tr: 'Permesyuaratan' },
  43: { name: 'Az-Zukhruf',     tr: 'Perhiasan Emas' },
  44: { name: 'Ad-Dukhaan',     tr: 'Kabut/Asap' },
  45: { name: 'Al-Jatsiyah',    tr: 'Yang Berlutut' },
  46: { name: 'Al-Ahqaaf',      tr: 'Bukit-bukit Pasir' },
  47: { name: 'Muhammad',       tr: 'Nabi Muhammad s.a.w.' },
  48: { name: 'Al-Fath',        tr: 'Kemenangan' },
  49: { name: 'Al-Hujurat',     tr: 'Bilik-bilik' },
  50: { name: 'Qaf',            tr: '' },
  51: { name: 'Adz-Dzariyaat',  tr: 'Angin yang Menerbangkan' },
  52: { name: 'At-Tur',         tr: 'Gunung' },
  53: { name: 'An-Najm',        tr: 'Bintang' },
  54: { name: 'Al-Qamar',       tr: 'Bulan' },
  55: { name: 'Ar-Rahman',      tr: 'Yang Maha Pemurah' },
  56: { name: "Al-Waqi'ah",     tr: 'Peristiwa yang Tidak Dapat Dielakkan' },
  57: { name: 'Al-Hadid',       tr: 'Besi' },
  58: { name: 'Al-Mujadilah',   tr: 'Perempuan yang Merayu' },
  59: { name: 'Al-Hasyr',       tr: 'Pengusiran' },
  60: { name: 'Al-Mumtahanah',  tr: 'Perempuan yang Diuji' },
  61: { name: 'As-Saff',        tr: 'Barisan' },
  62: { name: "Al-Jumu'ah",     tr: 'Hari Jumaat' },
  63: { name: 'Al-Munafiquun',  tr: 'Golongan Munafik' },
  64: { name: 'At-Taghabun',    tr: 'Saling Untung dan Rugi' },
  65: { name: 'At-Talaq',       tr: 'Cerai' },
  66: { name: 'At-Tahrim',      tr: 'Mengharamkan' },
  67: { name: 'Al-Mulk',        tr: 'Kerajaan' },
  68: { name: 'Al-Qalam',       tr: 'Pen' },
  69: { name: 'Al-Haaqqah',     tr: 'Keadaan Sebenar' },
  70: { name: "Al-Ma'arij",     tr: 'Tempat-tempat Naik' },
  71: { name: 'Nuh',            tr: 'Nabi Nuh a.s.' },
  72: { name: 'Al-Jin',         tr: 'Jin' },
  73: { name: 'Al-Muzammil',    tr: 'Yang Berselimut' },
  74: { name: 'Al-Muddathir',   tr: 'Yang Berselimut' },
  75: { name: 'Al-Qiamah',      tr: 'Kebangkitan' },
  76: { name: 'Al-Insaan',      tr: 'Manusia' },
  77: { name: 'Al-Mursalat',    tr: 'Yang Diutus' },
  78: { name: "An-Naba'",       tr: 'Berita Besar' },
  79: { name: "An-Naazi'aat",   tr: 'Yang Mencabut' },
  80: { name: "'Abasa",         tr: 'Dia Bermasam Muka' },
  81: { name: 'At-Takwiir',     tr: 'Menggulung' },
  82: { name: 'Al-Infitar',     tr: 'Pecah Belah' },
  83: { name: 'Al-Mutaffifiin', tr: 'Golongan yang Curang' },
  84: { name: 'Al-Insyiqaaq',   tr: 'Terbelah' },
  85: { name: 'Al-Buruj',       tr: 'Gugusan Bintang' },
  86: { name: 'At-Taariq',      tr: 'Pengunjung Malam' },
  87: { name: "Al-A'laa",       tr: 'Yang Tertinggi' },
  88: { name: 'Al-Ghaasyiah',   tr: 'Peristiwa yang Menggelisahkan' },
  89: { name: 'Al-Fajr',        tr: 'Fajar/Sinar Mentari' },
  90: { name: 'Al-Balad',       tr: 'Negeri' },
  91: { name: 'Asy-Syams',      tr: 'Matahari' },
  92: { name: 'Al-Lail',        tr: 'Malam' },
  93: { name: 'Adh-Dhuha',      tr: 'Pagi yang Cemerlang' },
  94: { name: 'Al-Insyirah',    tr: 'Kelapangan' },
  95: { name: 'At-Tin',         tr: 'Buah Ara' },
  96: { name: "Al-'Alaq",       tr: 'Gumpalan Darah' },
  97: { name: 'Al-Qadr',        tr: 'Kemuliaan' },
  98: { name: 'Al-Baiyinah',    tr: 'Bukti yang Nyata' },
  99: { name: 'Al-Zalzalah',    tr: 'Kegoncangan' },
  100:{ name: "Al-'Aadiyaat",   tr: 'Yang Berlari Kencang' },
  101:{ name: "Al-Qari'ah",     tr: 'Hari Yang Hingar Bingar' },
  102:{ name: 'At-Takathur',    tr: 'Bermegah-megah' },
  103:{ name: "Al-'Asr",        tr: 'Waktu' },
  104:{ name: 'Al-Humazah',     tr: 'Pengumpat' },
  105:{ name: 'Al-Fiil',        tr: 'Gajah' },
  106:{ name: 'Quraisy',        tr: 'Kaum Quraisy' },
  107:{ name: "Al-Ma'un",       tr: 'Barangan Berguna' },
  108:{ name: 'Al-Kauthar',     tr: 'Melimpah-ruah' },
  109:{ name: 'Al-Kafirun',     tr: 'Golongan Kafir' },
  110:{ name: 'An-Nasr',        tr: 'Pertolongan' },
  111:{ name: 'Al-Lahab',       tr: 'Nyalaan Api' },
  112:{ name: 'Al-Ikhlas',      tr: 'Tulus Ikhlas' },
  113:{ name: 'Al-Falaq',       tr: 'Subuh/Dinihari' },
  114:{ name: 'An-Nas',         tr: 'Manusia' },
};
```
*Note: the map is keyed by surah number; orthographic details (e.g. "Al-Kahfi" vs "Al-Kahf") are OpenCode's Discretion per D-15. The user's correction for surah 2 is LOCKED.*

### 7. Featured verses (D-17) — hardcoded ids, all verified to exist
```javascript
const FEATURED_IDS = [1, 2, 3, 4, 5, 6, 7, 262, 6222, 6223, 6224, 6225];
// 1:1–7 = Al-Fatiha; 262 = 2:255 Ayatul Kursi; 6222–6225 = 112:1–4 Al-Ikhlas
// [VERIFIED: computed from api/surahs.json ayah_counts; all ids valid in search.json]
```
Ids are resolved by `state.verses[id - 1]` (array is in id order 1–6236 — verified). Cards can optionally render Arabic-only (no Malay) since pre-search cards are decorative; keep them identical to search-result cards for consistency.

### 8. Testable module guard + node smoke test (04-02)
```javascript
// end of app.js:
if (typeof document !== 'undefined') { init(); }
if (typeof module !== 'undefined') module.exports = { foldAr, foldMs, search, arRegex, surahLabel, MALAY_SURAH_NAMES, levAtMost };
```
```javascript
// app.test.mjs (node --test, zero deps; loads the REAL api/search.json):
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { foldAr, search, surahLabel, MALAY_SURAH_NAMES } = await import('./app.js');
const verses = JSON.parse(readFileSync('api/search.json', 'utf8'));

test('diacritic + alef folding (D-06)', () => {
  assert.equal(foldAr('بِسْمِ ٱللَّهِ'), 'بسم الله');          // wasla + tashkeel stripped
  assert.ok(search(['بسم']).some((v) => v.id === 1));
});
test('Malay case-insensitive (D-07)', () => {
  assert.ok(search(['BERIMAN']).length > 0);
});
test('AND across terms (D-09)', () => {
  assert.ok(search(['pemurah', 'langit']).length === 3);        // [VERIFIED on real data]
});
test('id order (D-10)', () => {
  const r = search(['pemurah']);
  assert.ok(r.every((v, i) => i === 0 || r[i - 1].id < v.id));
});
test('label format (D-15) incl. user correction', () => {
  assert.equal(surahLabel({ surah: 2, ayah: 255 }), 'Al-Baqarah (Lembu Betina / The Cow) • 2:255');
  assert.ok(Object.keys(MALAY_SURAH_NAMES).length === 114);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Whole-text search needs an inverted index | Linear scan with `includes` is fine up to ~10⁵ documents; JIT-compiled loops do 6,236 × 2 string checks in ~5ms | Sustained (V8 JIT) | No index to build/maintain for this phase; D-01's "consume as-is" is not just a constraint, it's the right call [VERIFIED: benchmark] |
| Client search = jQuery/underscore/lodash or a framework | Native `fetch`, `Map`, arrow fns, `node:test` — the platform is the library | ~2016–2020 (ES2015+ ubiquity) | D-26's vanilla-JS constraint costs nothing here; all patterns are ~20-line native implementations |
| Highlight = regex on plain text | Fold-aware regex with diacritic-wildcards for normalized matching | Continuous (text-normalization + search UX literature) | Eliminates the folded→original offset-mapping problem entirely [VERIFIED: outputs] |
| Fuzzy = edit distance over everything | Prefiltered candidate sets (first char + length buckets) + banded DP | Classic IR practice (Lucene-era) | 12ms instead of 226ms for the same ranking [VERIFIED: benchmark] |
| Arabic normalization invented per-project | Copy the canonical Lucene/ES `ArabicNormalizer` rules, extend for Quranic signs + wasla | Lucene rules stable since ~2004 | Matching behavior matches what search-engine users expect (بسم finds بِسْمِ) [CITED: Apache Lucene source; VERIFIED: data audit] |

**Deprecated/outdated:**
- **Loading JSON via `<script src>` + global callback (JSONP-style):** unnecessary — `fetch` is universal; also the file is served same-origin.
- **jQuery-based DOM manipulation:** native `createElement`/`textContent` covers this phase's rendering needs.
- **Debounce utilities from lodash:** a 5-line `setTimeout`/`clearTimeout` is the standard pattern (Code Example 2).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Visitors use a browser from the last ~7 years (ES2017: async/await, `includes`, `normalize`, `u`-flag regex) | Standard Stack | If ancient browsers must be supported, app.js needs transpilation (forbidden by D-26 no-build) — out of scope; the project targets "anyone with a browser + curl" |
| A2 | Malay text stays ASCII-only (current data has zero non-ASCII — verified); D-07's diacritic-strip is a defensive no-op today | Summary / D-07 | If diacritized Malay is introduced later, the fold already handles it — no code change needed. No risk either way |
| A3 | GitHub Pages serves gzip for `.json` like it does for `.html` (gzip verified on HTML; same Fastly infra for all static assets) | Pages serving | If unverified for JSON specifically, transfer is 3.1MB instead of ~830KB — slower first load but functional (loading indicator covers it) |
| A4 | The repo is public and Pages is enabled for `C-Fu/quran-database-malay` (Phase 3's premise; API lookup rate-limited this session) | Deploy | If Pages is misconfigured, plan 04-02's live checks fail — the same risk Phase 3 already accepted and documented |
| A5 | Extending D-06's fold set with ة→ه and ى→ي (canonical Lucene rules, not locked by D-06's text) | Pattern 1 | Changes recall: `على` matches `علي`, `رحمة` matches `رحمه` — standard Quran-search behavior; if the user objects, deleting two map entries disables it. Flag for discuss-phase confirmation |
| A6 | Google Fonts `<link>` remains reachable (fonts.googleapis.com is the D-23-locked source) | Standard Stack | If blocked, `font-display: swap` + the fallback serif stack keeps the page readable; no functional loss |

## Open Questions

1. **Should the label also highlight when the Malay map lacks a translation (surahs 20, 36, 38, 50)?**
   - What we know: Wikipedia gives no Malay translation for those 4; the fallback in Code Example 5 renders `Taahaa (The Letters Ta, Ha) • 20:1`-style labels.
   - What's unclear: whether the user wants those labels to show *only* the English translation, or a short Malay note.
   - Recommendation: ship the fallback (English-only); it is visible only for 4 surahs and is trivially adjustable later. No planning impact.

2. **CSP meta tag?**
   - What we know: the page has no inline scripts/styles (D-20), so a strict CSP (`default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'`) is trivially compatible.
   - What's unclear: adding it is beyond locked decisions; GitHub Pages sends no CSP headers by default.
   - Recommendation: include the `<meta http-equiv="Content-Security-Policy">` in index.html as a one-line hardening measure (plan 04-01 task 1); if it breaks the Google Fonts rendering during 04-02 testing, drop it — it is discretionary.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node --test` smoke tests (04-02) | ✓ | v20.19.2 | — (has built-in test runner since 18) |
| Python 3 | Local static server `python3 -m http.server` (mandatory local test path — file:// fetch fails) | ✓ | 3.13.5 | `npx serve` (npm — avoid per no-deps ethos) |
| Playwright + headless Chromium | Optional DOM-level E2E checks | ✓ | 1.62.1 + chromium_headless_shell-1234 (installed this session; system libs via apt) | Manual browser testing |
| `curl` + `jq` | Post-deploy live checks (04-02), curl-hint in error state | ✓ | curl 8.x, jq 1.7 [CITED: 03-RESEARCH] | — |
| Google Fonts (fonts.googleapis.com / fonts.gstatic.com) | Runtime typography (D-23) | external | — | `font-display: swap` + serif fallback stack in style.css |
| GitHub Actions `ubuntu-latest` runner | Deploy (existing workflow) | at deploy time | — | Phase 3 verified the full chain in a temp-dir simulation |
| GitHub Pages | Live site | at deploy time | — | Local `python3 -m http.server` for pre-deploy verification |

**Missing dependencies with no fallback:** none — every runtime need is the browser itself (client-side), and every tool this phase's plans need is present in the environment or at deploy time.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — this section applies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` + `node:assert` (no install, no package.json — matches the repo's no-deps ethos); optional Playwright headless-Chromium DOM checks |
| Config file | none — `node --test` discovers `app.test.mjs` by convention |
| Quick run command | `node --test app.test.mjs` (reads the real `api/search.json` — runs in < 1s) |
| Full suite command | `node --test app.test.mjs` + browser smoke: `python3 -m http.server` → manual/Playwright check → post-deploy `curl` checks |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | 3 files exist at repo root; workflow stages them; deployed root serves index.html | unit + deploy-check | `test -f index.html && test -f style.css && test -f app.js`; `grep -q 'cp index.html style.css app.js' .github/workflows/deploy-pages.yml`; post-deploy `curl -s https://C-Fu.github.io/quran-database-malay/ \| grep -q '<html lang="ms">'` | ❌ Wave 0 (test file) |
| UI-02 | Search matches Malay + Arabic with folds, AND, id order, cap-100 | unit (node:test) | `node --test app.test.mjs` — cases: `بسم` matches 1:1, `BERIMAN` > 0, AND(`pemurah`,`langit`) == 3, id-order, empty-query guard | ❌ Wave 0 |
| UI-03 | Card shows Arabic (RTL) + Malay (LTR) + label | unit (label) + DOM check | label test asserts `Al-Baqarah (Lembu Betina / The Cow) • 2:255`; Playwright: after search, `page.locator('.verse-arabic').first()` has `dir=rtl` and non-empty text, `.verse-malay` non-empty | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test app.test.mjs` (once app.js guard + test file exist)
- **Per wave merge:** same + structural greps on the workflow
- **Phase gate:** full suite green + post-deploy curl checks pass before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `app.test.mjs` — node:test smoke tests (Code Example 8); must be created before/with app.js in plan 04-01 task 1
- [ ] `app.js` module-export guard (`if (typeof module !== 'undefined')`) — Wave 0 of 04-01, required by the test harness
- [ ] (Optional) Playwright DOM check script — only if 04-02 wants automated DOM assertions; manual browser verification via `python3 -m http.server` is the fallback

## Security Domain

`security_enforcement` is not explicitly false in config → enabled. Applied to this phase.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Public static data, no auth surface (project constraint) |
| V3 Session Management | no | No sessions; no cookies set by the page |
| V4 Access Control | no | All data is public by design; no privileged operations |
| V5 Input Validation | **yes** | Query strings are user input: never concatenate into HTML (use `createElement`/`textContent`); regex-escape query chars when building patterns (`esc()`); guard empty-folded terms |
| V6 Cryptography | no | No secrets, no transport of sensitive data (all public, served over HTTPS by Pages) |
| V12 Files & Resources | no | No file upload, no server-side processing |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via query string echoed into `innerHTML` (e.g. `<img src=x onerror=...>`) | Tampering / Repudiation | DOM building with `textContent` only — no `innerHTML` anywhere in app.js (Pattern 2); verified code pattern in Code Example 4 |
| HTML/script injection via verse text if a future data change ever inserted markup into `arabic`/`malay` | Tampering | Defense-in-depth: same `textContent`-only rendering covers the dataset too; Phase 2's `--validate` keeps the contract plain text |
| Regex ReDoS from a pathological query on the highlight/fuzzy regexes | DoS | Patterns are anchored to ≤ ~20-char user terms, single-pass `exec()` loops with explicit `lastIndex` advance, no nested quantifiers over user text (wildcards are fixed literal ranges); no server is involved so impact is one tab |
| Third-party font script (Google Fonts) | Spoofing | Fonts load via `<link>` only (no JS from Google); optional CSP meta (Open Question 2); page remains readable if fonts fail |
| Stale/cached old page after deploy (CDN max-age=600) | — (availability) | Documented in Pitfall 2; verification polls tolerate the cache window |

## Sources

### Primary (HIGH confidence)
- `api/search.json` + `api/surahs.json` — the actual runtime data (6,236 verses, 5-field contract, 114 surahs); codepoint audit of all 68 Arabic characters and Malay ASCII-only finding [VERIFIED: direct data analysis this session]
- Apache Lucene `ArabicNormalizer.java` (main branch, raw source) — canonical Arabic normalization rules (أ إ آ → ا, ة → ه, ى → ي, strip U+064B–0652, tatweel) [VERIFIED: raw.githubusercontent.com/apache/lucene/.../ArabicNormalizer.java]
- DESIGNmd QuestUI spec (designmd.ai/chef/questui) — palette, typography scale, spacing, elevation, do's/don'ts, MIT license [VERIFIED: page fetch this session]
- Live CDN probes — GitHub Pages serves gzip + `cache-control: max-age=600` [VERIFIED: curl -sI pages.github.com + a Pages project site]
- Headless Chromium experiments — `file://` fetch fails ("Failed to fetch"), `http://localhost` fetch succeeds [VERIFIED: Playwright 1.62.1 this session]
- Benchmarks on the real dataset (Node v20.19.2) — fold 239ms, parse 26ms, search 4.6–6.5ms, pipeline 2.6ms, fuzzy 0.4–12ms, word index 217ms, 15/15 behavior checks [VERIFIED: /tmp/opencode/bench-*.js this session]
- Phase 2/3 research artifacts (`.planning/phases/02-*/03-*/*.md`) — search.json contract, deploy workflow shape, `_site/` staging, deployment propagation pitfall [VERIFIED: repo files]

### Secondary (MEDIUM confidence)
- Malay Wikipedia "Surah Quran" list (rev. 5895445, 2023-07-03) — the 114-entry Malay surah name source for D-15 [CITED: ms.wikipedia.org/wiki/Surah_Quran]
- Elasticsearch docs — `arabic_normalization` token filter exists and is the ES name for Lucene's ArabicNormalizer [CITED: elastic.co/docs/reference/text-analysis/normalizers]
- MDN Fetch API docs — fetch is promise-based, CORS-default mode [CITED: developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch]
- GitHub Docs "About GitHub Pages" — project sites live at `<owner>.github.io/<repo>`; one site per repo [CITED: docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages]

### Tertiary (LOW confidence)
- None — all behavioral claims were verified empirically or against primary sources this session. The only [ASSUMED] items are listed in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no libraries to choose (D-26); all platform APIs verified by benchmark/experiment on the real data
- Architecture: HIGH — the exact recommended pipeline (mirror + regex highlight + bucketed fuzzy) was executed end-to-end with 15/15 passing checks and measured timings
- Pitfalls: HIGH — the two environment-specific ones (file:// fetch, CDN cache) were reproduced/measured live; the rest are verified against the implementation patterns

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 (30 days — browser platform APIs are stable; Google Fonts/Palette URLs could drift, re-verify only if style.css render breaks)
