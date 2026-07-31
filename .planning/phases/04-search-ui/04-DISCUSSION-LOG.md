# Phase 4: Search UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 4-search-ui
**Areas discussed:** Search data loading, Arabic matching behavior, Results presentation, Page architecture & deploy wiring

---

## Search data loading

| Option | Description | Selected |
|--------|-------------|----------|
| Preload all on load | fetch search.json once on page load (~3MB), instant search afterward | ✓ |
| Lazy-fetch on first search | page loads fast, 3MB fetched on first keystroke | |
| Per-surah progressive loading | small per-surah files, weak for cross-Quran keyword search | |
| Loading state + error retry | indicator while downloading, clear error + retry on failure | ✓ |
| No loading state | search box always enabled, returns nothing until loaded | |
| Include surah filter too | also fetch surahs.json for a surah dropdown | |
| Use existing search.json | consume committed api/search.json, no new index | ✓ |
| Create a lighter index file | separate slim index, new build surface | |
| Cap at 100 + show more | collapse beyond 100 with a Show more button | ✓ |
| Render all matches | all at once, slow for common words | |
| Paginate in pages of 50 | prev/next controls, more UI surface | |
| Live as-you-type | debounced search as you type | ✓ |
| Search on submit only | on Enter/button | |
| Live + min 2 chars | live but requires 2+ characters | |
| Retry button + curl hint | re-fetch button + curl/jq fallback hint | ✓ |
| Retry button only | re-fetch button, no hint | |
| Auto-retry then manual | auto retry once then manual | |

**User's choice:** Preload all on load; loading state + error retry; use existing search.json; cap at 100 + show more; live as-you-type; retry button + curl hint
**Notes:** User asked to continue to a second/third round of questions on this area — debounce/trigger and failure-state detail were both explored.

---

## Arabic matching behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Diacritic + alef folding | strip tashkeel AND fold alef variants, so الله matches ٱللَّه | ✓ |
| Exact match only | exact substring, الله would not match diacritized text | |
| Strip diacritics only | partial — الله still won't match wasla alef | |
| Both, combined | one box searches Malay AND Arabic simultaneously | ✓ |
| Toggle Malay / Arabic | segmented control, splits results view | |
| Auto-detect by script | detect Arabic chars vs Latin, pick field | |
| AND — all terms must match | multi-word queries require every word | ✓ |
| OR — any term matches | noisier, high recall | |
| Phrase match | whole query as exact phrase | |
| Ayah id order | results in global id order 1–6236 | ✓ |
| Relevance scoring | ranked by relevance, more complex | |
| Surah/ayah grouped | grouped per surah | |
| Strip diacritics too | Malay diacritics (é, î, â, ū) also stripped | ✓ |
| Case-insensitive only | keep Malay diacritics | |
| Highlight matches | matched term highlighted in both fields | ✓ |
| No highlighting | plain verse text | |
| Highlight matching field only | highlight only the field that matched | |
| Substring within words | matches anywhere in a word | ✓ |
| Whole-word only | only full-word matches | |
| Per-script rule | whole-word for Malay, substring for Arabic | |

**User's choice:** Diacritic + alef folding; both combined; AND; ayah id order; strip diacritics too; highlight matches; substring within words
**Notes:** None — all recommended options accepted.

---

## Results presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Arabic top, Malay below | Arabic on top (RTL, larger), Malay below | ✓ |
| Side-by-side columns | Arabic right, Malay left | |
| Malay top, Arabic below | Malay-first layout | |
| Surah name + ayah no. | label shows surah + ayah number | ✓ |
| Mushaf ayah marker | ornamental ayah-end marker in Arabic | |
| Both label + marker | both label and marker | |
| Use existing name_en fields | Al-Baqara (The Cow) from surahs.json | |
| Use Arabic name | name_ar only | |
| Add Malay surah names | hardcoded 114-entry Malay map in UI | ✓ |
| Malay name + ayah | Malay name + ayah only | |
| Malay + English + ayah | Al-Baqarah (Lembu Betina / The Cow) • 2:255 | ✓ |
| Malay primary, English muted | Malay main, English secondary | |
| Hero + example hints | hero with sample search hints | |
| Minimal search box | just the box | |
| Hero + featured verses | hero plus curated verses pre-search | ✓ |
| Al-Fatiha opening | ids 1–7 | |
| Curated famous verses | curated ids hardcoded (Ayatul Kursi, Al-Ikhlas, Al-Fatiha) | ✓ |
| Random verses | random each load | |
| Hardcode ids in UI | ids hardcoded, loaded from search.json | ✓ |
| Separate curated.json | new API file | |
| Skip featured verses | no featured verses | |
| Friendly no-results + tips | Tiada hasil + search tips | |
| Minimal no-results | minimal message + reset | |
| Fuzzy suggestions | closest matches via light similarity | ✓ |
| Light fuzzy on folded text | edit-distance over folded text, labelled closest matches | ✓ |
| Folding-only 'close' matches | no real fuzzy algorithm | |
| Fuse.js library | third-party fuzzy lib via CDN | |
| Per-line direction | Arabic RTL within line, Malay LTR, page stays LTR | ✓ |
| Whole page RTL | wrong for Malay UI | |
| Auto bidi only | rely on Unicode bidi | |

**User's choice:** Arabic top, Malay below; surah name + ayah no.; **add friendly Malay surah name map** (corrected: "Lembu Betina" not "Sapi Betina"); Malay + English + ayah format; hero + featured verses; curated famous verses; hardcode ids in UI; fuzzy suggestions via light fuzzy on folded text; per-line direction
**Notes:** User retracted the first answer to the surah-reference question and re-answered — the map must use friendly/classical Malay names (Al-Baqarah → "Lembu Betina", explicitly NOT "Sapi Betina").

---

## Page architecture & deploy wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Single self-contained file | one index.html, inline CSS+JS | |
| Separate css/js files | index.html + style.css + app.js | ✓ |
| index.html + app.js | CSS inline, JS separate | |
| Repo root, staged into _site | root files copied into _site/ alongside api/ | ✓ |
| ui/ subdirectory | grouped under ui/ | |
| Inside api/ | conflates data with page chrome | |
| Relative paths | works at project path and file:// | ✓ |
| Absolute live URL | hardcoded domain | |
| Runtime base detection | <base> or location detection | |
| Google Fonts | Cinzel + Spectral via <link> | ✓ |
| System fonts | zero external requests | |
| Self-host fonts | font files in repo | |
| Extend existing workflow | modify Stage site step in deploy-pages.yml | ✓ |
| Separate workflow | isolated but fragile artifact contention | |
| Commit _site/ to repo | violates Phase 3 D-05 | |
| Fluid single-column | one layout, no breakpoints | |
| Breakpoint grid | single-column mobile, two-column desktop | ✓ |
| Mobile-first only | mobile only | |
| Malay lang + meta tags | <html lang="ms">, Malay title/description, viewport | ✓ |
| English lang + meta | English indexing | |
| Skip metadata | no lang/meta | |
| Vanilla JS | no framework, no build step | ✓ |
| Tiny CDN framework | Preact/Alpine via CDN | |
| Full framework | React/Vue with build | |

**User's choice:** Separate css/js files; repo root staged into _site; relative paths; Google Fonts; extend existing workflow; breakpoint grid; Malay lang + meta; vanilla JS
**Notes:** User requested multiple rounds on this area — fonts, responsive layout, metadata, and JS approach were all explored.

---

## OpenCode's Discretion

- Exact QuestUI visual treatment and card styling details
- Debounce duration, fuzzy threshold, featured verse id list
- Malay surah-name spellings beyond the Al-Baqarah example
- Exact workflow step edit for copying UI files into `_site/`
- Internal app.js structure

## Deferred Ideas

- Per-surah browsing mode — future phase
- Shareable/copyable verse deep-links (e.g. ?surah=2&ayah=255) — future enhancement
- Audio recitation player — README roadmap, separate phase
- Bookmarking/progress tracking — README roadmap, separate phase
