# Requirements: Quran Database Malay

**Defined:** 2026-07-31
**Core Value:** Anyone can curl the GitHub Pages endpoint and get a Quran verse (Arabic + Basmeih Malay) by searching — fast, reliably, without auth.

## v1 Requirements

### Malay Translation

- [ ] **MALAY-01**: SQLite database contains the Basmeih Malay translation for all 6,236 ayahs
- [ ] **MALAY-02**: Malay translation registered as an edition with identifier `ms.basmeih` in the `editions` table
- [ ] **MALAY-03**: Malay translation text sourced from a public Quran API (e.g. alquran.cloud)
- [ ] **MALAY-04**: Existing 134 translation editions remain intact after adding Malay

### GitHub Pages API

- [ ] **API-01**: Per-surah JSON files generated (e.g. `/api/surah/2.json`), each containing all ayahs for that surah
- [ ] **API-02**: Each verse entry includes Arabic text, Basmeih Malay translation, and references (surah number, ayah number, global ayah id)
- [ ] **API-03**: Full search index (`search.json`) generated covering all 6,236 ayahs for keyword filtering
- [ ] **API-04**: JSON files built by a GitHub Actions workflow and deployed to GitHub Pages
- [ ] **API-05**: Consumers can retrieve verses by curling static URLs (e.g. `curl https://<owner>.github.io/<repo>/api/surah/2.json`) and filter locally with `jq`

### Search UI

- [ ] **UI-01**: Browser search page deployed on GitHub Pages styled with the QuestUI design system
- [ ] **UI-02**: User can search by keyword across Malay text (and Arabic) from the browser UI
- [ ] **UI-03**: Search results display Arabic text with Malay translation per verse

## v2 Requirements

### Data Expansion

- **DATA-01**: Add `pages` table (Mushaf page mapping)
- **DATA-02**: Add word-by-word breakdown (Arabic root, morphology)
- **DATA-03**: Add tafsir data and additional translations
- **DATA-04**: Add transliteration for each ayah

## Out of Scope

| Feature | Reason |
|---------|--------|
| Server-side dynamic search (query params) | GitHub Pages is static-only; no request-time processing |
| Authentication / rate limiting | Public static data, no server component |
| Non-Malay translations | 134 editions already exist; this milestone adds Malay only |
| Mobile app / PWA | Web + curl API is the target for this milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MALAY-01 | Phase 1 | Pending |
| MALAY-02 | Phase 1 | Pending |
| MALAY-03 | Phase 1 | Pending |
| MALAY-04 | Phase 1 | Pending |
| API-01 | Phase 2 | Pending |
| API-02 | Phase 2 | Pending |
| API-03 | Phase 2 | Pending |
| API-04 | Phase 3 | Pending |
| API-05 | Phase 3 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-31*
*Last updated: 2026-07-31 after initial definition*
