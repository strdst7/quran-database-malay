---
title: External Integrations
date: 2026-07-31
focus: tech
---

# External Integrations

**Analysis Date:** 2026-07-31

## Summary

This repository has **no live external service integrations**. It is a static data-artifact repo: a MySQL dump (`data/quran.sql.zip`) plus a conversion tool (`convert_to_sqlite.py`) that produces a SQLite database (`quran.db.gz`). The only "integration" is the offline ingestion of the MySQL dump and the data provenance behind it. All other integration surfaces (APIs, auth, webhooks, CI/CD, hosting) are either absent or explicitly planned in the roadmap (`README.md:168-184`).

## APIs & External Services

**None present.**
- No REST API, no GraphQL endpoint, no HTTP server code of any kind.
- The roadmap (`README.md:169-175`) plans a future RESTful API (Node.js or Python), a GraphQL endpoint, a full-text Arabic search endpoint, and Swagger/OpenAPI docs — all unchecked.

**Data provenance (offline, not a live integration):**
- Source dump generated 2018-06-07 by **phpMyAdmin 4.7.7** from **MySQL 5.7.22** on localhost (`data/quran.sql.zip` → `quran.sql` header).
- The dump carries Laravel scaffolding tables (`users`, `password_resets`, `migrations`), indicating the dataset was originally produced by a Laravel/Lumen application (see related project [Quran Lumen API](https://github.com/AbdullahGhanem/quran-lumen-api) in `README.md:214`).
- Edition identifiers in the dataset (e.g. `en.sahih`) follow the Quran.com/Tanzil edition naming convention, and the 134 editions cover multiple languages — the data mirrors the Tanzil/Quran.com open dataset lineage. No upstream API is queried; the data is vendored in-repo.

## Data Storage

**Databases:**
- **MySQL 5.7.22** (source of truth) — `data/quran.sql.zip` → `quran.sql`. Schema: `ENGINE=InnoDB`, `DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`. Tables: `surahs` (114 rows), `ayahs` (6,236 rows), `editions` (134 rows), `ayah_edition` (835,624 rows), `juzs`, `hizbs`, plus Laravel tables `users`, `password_resets`, `migrations`.
  - Connection: not configured in-repo; imported via CLI per `README.md:101-109` (`mysql -u <username> -p <database_name> < quran.sql`).
  - Client: none in-repo (no ORM, no connector code). Raw SQL dump only.
- **SQLite** (deliverable) — `quran.db.gz` → `quran.db` (~208 MB). WAL journal mode, FK/CHECK constraints, 9 indexes, 2 views (`surah_stats`, `ayah_with_translation`) — see `convert_to_sqlite.py:15-95` and `convert_to_sqlite.py:386-404`.
  - Connection: Python stdlib `sqlite3` in `convert_to_sqlite.py`; or any SQLite client (`sqlite3 quran.db`) per `README.md:118-121`.
- **PostgreSQL** — not implemented. `schema/postgres/schema.sql` is an empty placeholder; the README struck through PostgreSQL export support ("Support ~~PostgreSQL and~~ SQLite exports", `README.md:156`).

**File Storage:**
- Local filesystem only. Data lives in-repo: `data/quran.sql.zip`, `quran.db.gz`. No cloud object storage, no CDN, no S3-style buckets.
- `.gitignore` excludes only `output/` (`.gitignore:2`) — the data artifacts are committed to git.

**Caching:**
- None.

## Authentication & Identity

**Auth Provider:**
- None. No active auth anywhere in the repo.
- The MySQL dump contains orphaned Laravel tables `users` and `password_resets` (`data/quran.sql.zip`), but they hold no functional role in this repo — the converter ignores them (`TABLE_ORDER = ['surahs', 'ayahs', 'editions', 'ayah_edition']`, `convert_to_sqlite.py:344`).
- Roadmap plans "API rate limiting and authentication" (`README.md:173`) for the future API — unchecked.

## Monitoring & Observability

**Error Tracking:**
- None.

**Logs:**
- Console output only. `convert_to_sqlite.py` prints progress to stdout: row counts per table, sajdah/juz/hizb counts, and final DB size (`convert_to_sqlite.py:347-422`). No logging framework.

## CI/CD & Deployment

**Hosting:**
- None. No server code to host; no deployment target defined.

**CI Pipeline:**
- None. No `.github/workflows`, `.gitlab-ci.yml`, `Jenkinsfile`, or equivalent.

## Environment Configuration

**Required env vars:**
- None. The converter is fully self-contained with hardcoded paths (`SQL_FILE = "quran.sql"`, `DB_FILE = "quran.db"`, `convert_to_sqlite.py:12-13`).

**Secrets location:**
- N/A. No secrets, no `.env` files, no credentials in the repo. The only credential-like artifact is the MySQL CLI username/password in `README.md:108`, provided as `-u <username> -p` placeholders for the consumer to fill in at import time.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

## Planned Integrations (Roadmap)

Per `README.md:159-184`, the following integrations are planned but **not implemented**:

- **Data expansion:** additional translations (Urdu, French, Turkish, Indonesian — relevant given this repo's Malay context), tafsir datasets (Ibn Kathir, Al-Tabari, Al-Sa'di), audio recitation references (Mishary, Al-Husary, Abdul Basit), per-ayah transliteration, asbab al-nuzul, hadith references, dua extractions.
- **API:** RESTful API (Node.js or Python), GraphQL, full-text Arabic search, pagination/filtering, rate limiting + auth, Swagger/OpenAPI docs.
- **Frontend:** web app, ayah-by-ayah reader, audio player with reciter selection, search UI, bookmarking, PWA.
- **Docker:** `docker/mysql/`, `docker/postgres/`, `docker/sqlite/` directories and `docker-compose.yaml` exist as empty placeholders awaiting implementation.

## Data Flow (Current)

1. `unzip data/quran.sql.zip` → `quran.sql` (`README.md:101-104`)
2. `python3 convert_to_sqlite.py` — streams `quran.sql` line-by-line, parses multi-line MySQL INSERTs, writes into the improved SQLite schema, populates `juzs`/`hizbs` lookup tables from hardcoded data, creates views (`convert_to_sqlite.py:175-241`, `244-341`, `386-404`)
3. `quran.db` gzip'd to `quran.db.gz` for distribution
4. Consumers query `quran.db` with any SQLite client or Python `sqlite3` (`README.md:118-131`)

---

*Integration audit: 2026-07-31*
