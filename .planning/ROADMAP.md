# Roadmap: Quran Database Malay

## Overview

Starting from an existing Quran SQLite database with 134 editions, this project adds the Basmeih Malay translation, then exposes the data as a curl-able static JSON API on GitHub Pages, and finally adds a browser search UI styled with the QuestUI design system. The journey: enrich the database → generate JSON artifacts → automate deployment → make search friendly.

## Phases

- [x] **Phase 1: Malay Translation Data** - Fetch Basmeih translation and add it to the SQLite database (completed 2026-07-31)
- [ ] **Phase 2: JSON API Generation** - Export per-surah JSON files and a full search index from SQLite
- [ ] **Phase 3: GitHub Pages Deployment** - GitHub Actions workflow builds and deploys JSON to Pages with usage docs
- [ ] **Phase 4: Search UI** - Browser search page styled with QuestUI design system

## Phase Details

### Phase 1: Malay Translation Data
**Goal**: SQLite database contains the complete Basmeih Malay translation (all 6,236 ayahs) as edition `ms.basmeih`, without disturbing existing data
**Depends on**: Nothing (first phase)
**Requirements**: MALAY-01, MALAY-02, MALAY-03, MALAY-04
**Success Criteria** (what must be TRUE):
  1. `editions` table contains a `ms.basmeih` row (language `ms`, type `translation`)
  2. `ayah_edition` has 6,236 rows for `ms.basmeih` — every ayah has a Malay translation
  3. All 134 pre-existing editions still queryable with identical row counts
  4. Malay text matches the Basmeih source (spot-checked against alquran.cloud)
**Plans**: 2 plans

Plans:
- [x] 01-01: Fetch Basmeih translation from public API and stage the data
- [x] 01-02: Add edition + ayah_edition rows to SQLite; verify integrity

### Phase 2: JSON API Generation
**Goal**: A generator script produces per-surah JSON files and a full `search.json` index, each verse carrying Arabic + Malay + references
**Depends on**: Phase 1
**Requirements**: API-01, API-02, API-03
**Success Criteria** (what must be TRUE):
  1. Running the generator produces `surah/1.json` through `surah/114.json`
  2. Each verse entry contains Arabic text, Malay text, surah number, ayah number, and global ayah id
  3. `search.json` exists covering all 6,236 ayahs for keyword filtering
  4. Script runs from the SQLite DB with Python stdlib only
**Plans**: 2 plans

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Write JSON generator script (per-surah files + search index)
**Wave 2 *(blocked on Wave 1 completion)* **
- [x] 02-02-PLAN.md — Validate output structure, sizes, and verse count coverage

**Cross-cutting constraints:**
- Every verse object has exactly the 5 keys `arabic, malay, surah, ayah, id` with non-empty Arabic and Malay text (D-02) — shared contract across all output files
- `search.json` is a flat array of 6,236 verse objects in global id order 1–6236, built in the same generation pass as the surah files (D-04/D-05/D-06)
- `--validate` exits 0 with 114/114 surah files, 6,236 total verses, 0 errors (D-17/D-18) — the phase's automated test surface

### Phase 3: GitHub Pages Deployment
**Goal**: A GitHub Actions workflow builds the JSON files and deploys them to GitHub Pages; README documents curl + jq usage
**Depends on**: Phase 2
**Requirements**: API-04, API-05
**Success Criteria** (what must be TRUE):
  1. GitHub Actions workflow builds JSON artifacts and deploys to Pages on push
  2. `curl https://<owner>.github.io/<repo>/api/surah/2.json` returns surah 2 JSON
  3. `curl .../api/search.json | jq '.[] | select(.malay | contains("<keyword>"))'` returns matching verses
  4. README documents the endpoints and curl examples
**Plans**: 2 plans

Plans:
- [ ] 03-01: Create GitHub Actions Pages deployment workflow
- [ ] 03-02: Write API usage docs (curl + jq examples) and verify deployed URLs

### Phase 4: Search UI
**Goal**: A browser search page deployed on GitHub Pages, styled with the QuestUI design system, letting visitors search Malay/Arabic text and view Arabic + Malay verses
**Depends on**: Phase 3
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. Search page is live on GitHub Pages (index.html at site root)
  2. User can type a keyword and see matching verses (Malay and Arabic) in the browser
  3. Results render with QuestUI styling (Cinzel/Spectral, gold/dark palette) and show Arabic + Malay per verse
  4. Page loads the search index via the static API endpoints
**Plans**: 2 plans

Plans:
- [ ] 04-01: Build QuestUI-styled search page (HTML/CSS/JS)
- [ ] 04-02: Wire page to search index, test locally and after deploy

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Malay Translation Data | 2/2 | Complete | 2026-07-31 |
| 2. JSON API Generation | 0/2 | Not started | - |
| 3. GitHub Pages Deployment | 0/2 | Not started | - |
| 4. Search UI | 0/2 | Not started | - |
