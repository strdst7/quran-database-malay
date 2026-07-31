# Quran Database Malay

## What This Is

A public Quran dataset and GitHub Pages site. The database packages the complete Quran (Arabic text + 134 existing translation editions) as SQLite artifacts, and now gains the Basmeih Malay translation. A static GitHub Pages site exposes a curl-able JSON API (per-surah files + full search index, built by GitHub Actions) so anyone can search and retrieve verses in Arabic with Malay translation from the command line, alongside a browser search page styled with the QuestUI design system.

## Core Value

Anyone can curl the GitHub Pages endpoint and get a Quran verse (Arabic + Basmeih Malay) by searching — fast, reliably, and without auth.

## Requirements

### Validated

- ✓ Complete Quran dataset (114 surahs, 6,236 ayahs) in Arabic — existing
- ✓ SQLite export pipeline (`convert_to_sqlite.py`) with normalized schema, FK constraints, indexes, juz/hizb lookup tables — existing
- ✓ 134 translation editions in `editions`/`ayah_edition` tables — existing
- ✓ MySQL source dump + SQLite artifact distribution — existing

### Active

- ✓ Add Basmeih Malay translation (`ms.basmeih`) to the SQLite database — Validated in Phase 1: Malay Translation Data
- ✓ 6,236 ayah_edition rows for ms.basmeih edition — Validated in Phase 1
- ✓ 134 existing editions intact after adding Malay — Validated in Phase 1
- ✓ JSON generator script (`generate_json_api.py`) producing per-surah + search.json + surahs.json from SQLite — Validated in Phase 2: JSON API Generation
- ✓ Per-surah JSON files (`api/surah/1.json`..`api/surah/114.json`) with Arabic + Malay — Validated in Phase 2
- ✓ Full search index (`api/search.json`) all 6,236 ayahs for keyword filtering — Validated in Phase 2
- ✓ validate mode: 114/114 files, 6236 verses, 0 errors — Validated in Phase 2
- ✓ Stdlib-only, read-only DB, gitignored api/ — Validated in Phase 2

### Active

- [ ] Build a GitHub Pages static site with a curl-able JSON API
- [ ] GitHub Actions workflow builds and deploys JSON to Pages
- [ ] Browser search UI styled with QuestUI design system
- [ ] Searchable via `curl | jq` filtering

### Out of Scope

- Server-side dynamic query processing — GitHub Pages is static-only; search is curl-then-filter
- Adding non-Malay translations — 134 editions already exist
- Authentication / rate limiting — public static data, no server

## Context

- Existing repo is a data pipeline (MySQL dump → SQLite), single Python stdlib script, no app runtime
- GitHub Pages cannot process query params server-side — data is pre-generated JSON that consumers curl and filter locally (e.g. with `jq`)
- Basmeih = "Tafsir Pimpinan Ar-Rahman", the standard Malay translation, available as `ms.basmeih` on public Quran APIs (alquran.cloud)
- QuestUI design system: fantasy/RPG-styled — primary gold #CA8A04, deep red #991B1B, royal purple #581C87, dark background #1A0F0A, fonts Cinzel (headings) + Spectral (body). Reference: https://designmd.ai/chef/questui
- Data size: ~208 MB SQLite DB; JSON export of Arabic + Malay per verse is substantially smaller and fits comfortably on Pages

## Constraints

- **Tech stack**: Python 3 stdlib for data pipeline (existing) — no new runtime deps for conversion
- **Hosting**: GitHub Pages — static hosting only, no server-side logic at request time
- **Build**: GitHub Actions allowed at deploy time (builds JSON files, then deploys to Pages)
- **Data**: Must include original Arabic text alongside Malay translation in responses

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Basmeih translation (`ms.basmeih`) | Standard Malay translation, freely available on public APIs | — Pending |
| Source Malay text from public Quran API | No existing Malay data in repo; API is authoritative and free | — Pending |
| GitHub Pages + Actions-built JSON | Static hosting needs pre-generated files; Actions builds them at deploy | — Pending |
| Per-surah files + full search index | Balances file count vs. single-curl search; index enables keyword filtering | — Pending |
| Arabic + Malay in every verse | User wants both for study/verification | — Pending |
| QuestUI design system for browser UI | User-specified design language | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-31 after Phase 2 completion*
