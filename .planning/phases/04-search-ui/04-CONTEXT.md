# Phase 4: Search UI - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

A browser search page deployed on GitHub Pages at the site root, styled with the QuestUI design system, letting visitors type a keyword and see matching Quran verses (Arabic + Basmeih Malay). Search is entirely client-side — the page preloads the existing `api/search.json` (3MB, 6,236 verses) and filters in the browser; there is no server on Pages. This phase delivers UI-01, UI-02, UI-03 only — the JSON API endpoints from Phases 2–3 are consumed, not regenerated.

</domain>

<decisions>
## Implementation Decisions

### Search data loading
- **D-01:** Preload the full `api/search.json` (3MB) on page load, once, and keep it in memory — search is instant afterward. No per-surah or lazy fetching.
- **D-02:** Show a loading indicator ("Memuatkan indeks...") while the 3MB index downloads; the search box is ready-aware until loaded.
- **D-03:** If the index fetch fails, show a clear error state with a **retry button** plus a hint pointing to the curl/jq API as a fallback (ties to the project's core value).
- **D-04:** The UI consumes the **existing `api/search.json` as-is** — no new/lighter index file is built. The 5-field verse contract (`arabic`, `malay`, `surah`, `ayah`, `id`) from Phase 2 is the input schema.
- **D-05:** Search runs **live as-you-type** with a short debounce (~200–300ms); no minimum character gate.

### Search matching behavior
- **D-06:** **Diacritic + alef folding** for Arabic matching: strip tashkeel (fatha, damma, kasra, shadda, sukun) AND fold alef variants (أ/إ/آ/ٱ → ا) before comparing, so typing `الله` or `بسم` matches diacritized verses like بِسْمِ ٱللَّهِ.
- **D-07:** Malay (and any Latin) matching is **case-insensitive AND strips diacritics** (é, î, â, ū), so `beriman` matches `berimân`.
- **D-08:** One search box searches **both Malay and Arabic combined** — matches from either field are returned together. No toggle, no script auto-detection.
- **D-09:** Multi-word queries use **AND** — all terms must match (across the combined Malay/Arabic fields).
- **D-10:** Results are ordered by **global ayah id (1–6236)** — the search.json array order.
- **D-11:** Matching is **substring-within-words** (matches anywhere in a word), for both Malay and Arabic.
- **D-12:** Matched terms are **highlighted** in the result text (both Arabic and Malay fields).

### Results presentation
- **D-13:** Each result card shows **Arabic on top** (right-aligned, RTL, larger text) and **Malay below** (LTR).
- **D-14:** Card reference label shows **surah name + ayah number**.
- **D-15:** The label uses a **friendly Malay surah-name map hardcoded in the UI** (114 entries), combined with the English name from `surahs.json` and the ayah number. Format: `Al-Baqarah (Lembu Betina / The Cow) • 2:255`. User-corrected example: Al-Baqarah is **"Lembu Betina"**, not "Sapi Betina". This map is new data maintained in the UI, not in the dataset.
- **D-16:** Results are **capped at 100** with a "Show more" button to reveal the rest.
- **D-17:** Pre-search state is a **hero section plus curated featured verses** (e.g. Ayatul Kursi 2:255, Al-Ikhlas 112:1–4, Al-Fatiha 1:1–7), defined as **hardcoded ids** in the UI and loaded from search.json.
- **D-18:** No-results state offers **fuzzy suggestions** — a light similarity pass (e.g. Levenshtein/edit-distance within a threshold) over the folded Malay/Arabic text, labelled as closest matches. No third-party fuzzy library.
- **D-19:** Text direction is **per-line** — Arabic runs RTL within its own line, Malay LTR; the page chrome stays LTR. No whole-page RTL.

### Page architecture & deploy wiring
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

</decisions>

<specifics>
## Specific Ideas

- "Al-Baqarah is **Lembu Betina** instead of Sapi Betina" — user gave an explicit friendly-Malay correction; the map should prefer natural/classical Malay names.
- The page is for a curl-first audience: the error state should teach the curl/jq alternative, and the page itself demonstrates the same search capability in-browser.
- The 3MB preload was accepted for instant search — the loading indicator and readiness handling compensate for the download.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope
- `.planning/REQUIREMENTS.md` §Search UI — UI-01 (browser page, QuestUI), UI-02 (search Malay/Arabic), UI-03 (results show Arabic + Malay per verse); plus Out of Scope (no server-side search, no mobile app)
- `.planning/ROADMAP.md` §Phase 4 — goal, success criteria (index.html at site root; keyword search returns matches; QuestUI styling with Cinzel/Spectral + gold/dark palette; page loads index via static API endpoints), plan split 04-01/04-02
- `.planning/PROJECT.md` — Constraints (static-only Pages, no request-time logic), Core Value (curl-able verse retrieval), Context (QuestUI palette and font specifics)

### Locked decisions from prior phases (MUST NOT be re-opened)
- `.planning/phases/02-json-api-generation/02-CONTEXT.md` — D-02 (5-field verse contract), D-04/D-06 (`search.json` flat array of 6,236 in id order), D-12/D-13 (`api/surahs.json` fields: `number`, `name_ar`, `name_en`, `name_en_translation`, `type`, `ayah_count`), D-10 (`api/` gitignored, built at deploy time)
- `.planning/phases/03-github-pages-deployment/03-CONTEXT.md` — D-05/D-06 (`_site/` staging dir gets `api/`), D-07 (no index.html in Phase 3 — **this phase adds it at site root**), D-08 (push to main + workflow_dispatch triggers), D-09 (generate + validate gate the deploy)

### The runtime the UI consumes
- `api/search.json` — the preloaded search index: flat array of 6,236 verse objects `{arabic, malay, surah, ayah, id}`, in id order 1–6236, ~3MB. Read the actual file to confirm field values and Arabic diacritics.
- `api/surahs.json` — 114 surah objects with `number`, `name_ar`, `name_en`, `name_en_translation`, `type`, `ayah_count`; source of the English name in the card label (D-15).
- `.github/workflows/deploy-pages.yml` — the existing two-job Pages workflow whose "Stage site" step (`mkdir -p _site && cp -r api _site/`) must be extended to publish `index.html`, `style.css`, `app.js`.

### QuestUI design system (external)
- `https://designmd.ai/chef/questui` — the locked design language: primary gold #CA8A04, deep red #991B1B, royal purple #581C87, dark background #1A0F0A, Cinzel (headings) + Spectral (body).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/search.json` — the exact data the page preloads and filters; already contains Arabic (fully diacritized, e.g. بِسْمِ ٱللَّهِ) + Basmeih Malay per verse, 5-field contract, id order 1–6236.
- `api/surahs.json` — 114 surah metadata objects; provides `name_en` and `name_en_translation` for the card label (D-15 combines these with the new Malay map).
- `.github/workflows/deploy-pages.yml` — the deploy path the UI rides on; its "Stage site" step is the single integration point to extend (D-21).
- `generate_json_api.py` — regenerates `api/` from `quran.db` at deploy time; the UI does NOT change this contract (D-04), but planners should know the data comes from here.

### Established Patterns
- Static, no-runtime-deps ethos: Python stdlib-only for the pipeline; the UI mirrors this with vanilla JS, no frameworks, no build step (D-26).
- Built-at-deploy-time, committed-source culture: `api/` is gitignored and rebuilt in Actions; UI files (index.html/style.css/app.js) are **committed** source staged into `_site/` at deploy (D-21).
- Deterministic rebuilds: the deploy workflow regenerates `api/` every run; the UI files are static and copied verbatim.
- Artifact-first data provenance: consumers (curl users AND the browser page) read the same committed/generated `api/` files — no drift between the curl API and the UI (D-01/D-04).

### Integration Points
- The only deploy change is the "Stage site" step in `deploy-pages.yml` (copy the 3 UI files into `_site/` alongside the existing `cp -r api _site/`).
- The page consumes `api/search.json` (preload, search, featured verses) and `api/surahs.json` (English surah names) via relative paths — works at `https://C-Fu.github.io/quran-database-malay/` (D-22).
- Published URL after this phase: `https://C-Fu.github.io/quran-database-malay/` resolves to `index.html` (currently 404s per Phase 3 D-07).
- The Malay surah-name map (D-15) is new UI-side data — not a dataset/schema change; no SQLite or generator changes.

</code_context>

<deferred>
## Deferred Ideas

- Per-surah browsing mode (click a surah to read its verses without a keyword) — a new capability, its own phase
- Shareable/copyable verse links or a deep-link to specific ayahs (e.g. `?surah=2&ayah=255`) — future enhancement
- Audio recitation player integration — already on the README roadmap, separate phase
- Progress tracking/bookmarking — already on the README roadmap, separate phase

</deferred>

---

*Phase: 04-search-ui*
*Context gathered: 2026-07-31*
