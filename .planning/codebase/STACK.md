---
title: Technology Stack
date: 2026-07-31
focus: tech
---

# Technology Stack

**Analysis Date:** 2026-07-31

## Languages

**Primary:**
- Python 3 (3.6+) — the only runtime language in this repo. `convert_to_sqlite.py` is a single script that converts the MySQL dump to SQLite. Verified working on Python 3.13.5 with SQLite 3.46.1.
- SQL (MySQL 5.7 dialect) — source data in `data/quran.sql.zip` (`quran.sql`, ~196 MB uncompressed), a `phpMyAdmin SQL Dump` with `ENGINE=InnoDB`, `utf8mb4_unicode_ci` collation.
- SQLite SQL — target schema defined in `convert_to_sqlite.py` (`create_sqlite_schema()`, lines 15–95).

**Secondary:**
- Arabic text data — the dataset content (Quranic Arabic script, 6,236 ayahs). Encoded as UTF-8; the dump carries a UTF-8 BOM (`\ufeff`) at the start of the first value, handled explicitly in `parse_sql_value()` (`convert_to_sqlite.py:108`).
- Shell — `install.sh` placeholders in `docker/*/` (empty files, no content).
- PHP 7.1.18 — the *original* dump toolchain (phpMyAdmin 4.7.7), not present in this repo; noted from the dump header only.

## Runtime

**Environment:**
- Python 3 interpreter, no pinned version. The script uses f-strings (`convert_to_sqlite.py:367`), `pathlib.Path` (imported but unused), `os.path.exists` — requires Python 3.6+.
- No virtualenv, no container runtime, no version managers (no `.nvmrc`, `.python-version`, `pyproject.toml`).

**Package Manager:**
- None. No `requirements.txt`, `setup.py`, `pyproject.toml`, or `Pipfile`. The script uses only the Python standard library: `sqlite3`, `re`, `os`, `pathlib`.
- Lockfile: None.

## Frameworks

**Core:**
- None. The repository contains no application framework. `convert_to_sqlite.py` is a procedural stdlib script with a single `convert()` entry point.

**Testing:**
- None. No test files, no test framework, no test configuration.

**Build/Dev:**
- None. No build tooling, no bundlers, no task runners, no linters/formatters config.

## Key Dependencies

**Critical:**
- Python stdlib `sqlite3` — used for all database operations in `convert_to_sqlite.py`. Relies on the host SQLite version's WAL and FK support (`PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`).

**Infrastructure:**
- MySQL 5.7.22 — the source database server that produced `data/quran.sql.zip` (dump header: `Server version: 5.7.22`). MySQL is a *source* only; this repo does not run MySQL.
- SQLite 3 — target database (`quran.db.gz`, ~60 MB compressed / ~208 MB uncompressed).
- PostgreSQL — placeholder only. `schema/postgres/schema.sql` is an empty file; the README roadmap item "Support ~~PostgreSQL and~~ SQLite exports" is struck through, indicating PostgreSQL support was dropped.

## Configuration

**Environment:**
- No environment variables used anywhere. No `.env` files, no config modules.
- All paths are hardcoded constants in `convert_to_sqlite.py:12-13`:
  ```python
  SQL_FILE = "quran.sql"   # input: MySQL dump (unzipped)
  DB_FILE = "quran.db"     # output: SQLite database
  ```

**Build:**
- No build config. The "build" is running the script directly:
  ```bash
  unzip quran.sql.zip
  python3 convert_to_sqlite.py
  ```
  (`README.md:133-137`). The script removes any existing `quran.db` and regenerates from scratch (`convert_to_sqlite.py:350-352`).

## Database Schema

The schema is defined in three places, only one of which is populated:

- **Authoritative (non-empty):** `create_sqlite_schema()` in `convert_to_sqlite.py:15-95` — 6 tables (`surahs`, `juzs`, `hizbs`, `ayahs`, `editions`, `ayah_edition`) with FK/CHECK constraints and 9 indexes.
- **Documentation:** `README.md:17-95` — column-level documentation of the MySQL schema.
- **Placeholders (empty files):** `schema/mysql/schema.sql`, `schema/postgres/schema.sql`, `schema/sqlite/schema.sql` — 0 bytes each, committed in the "establish project structure" commit (2882f0e) but never filled in.

The MySQL dump itself (`data/quran.sql.zip`) contains 9 tables: `surahs`, `ayahs`, `editions`, `ayah_edition`, `juzs`, `hizbs`, plus Laravel scaffolding tables `users`, `password_resets`, `migrations` (evidence the dump originated from a Laravel/Lumen app).

## Docker

**Current state:** Placeholder scaffolding only. All of the following files are 0 bytes:
- `docker/mysql/Dockerfile`, `docker/mysql/install.sh`
- `docker/postgres/Dockerfile`, `docker/postgres/install.sh`
- `docker/sqlite/Dockerfile`, `docker/sqlite/install.sh`
- `docker-compose.yaml` (repo root)

The README roadmap item "Docker setup for easy deployment" (`README.md:174`) is unchecked — containerization is planned but not implemented.

## Platform Requirements

**Development:**
- Python 3.6+ (stdlib only)
- `unzip` and `gzip`/`gunzip` CLI tools for extracting `data/quran.sql.zip` and `quran.db.gz`
- A SQLite client (`sqlite3` CLI) or Python `sqlite3` module for querying

**Production:**
- None. No deployment target, no server code, no runtime service. This is a data-artifact repo (database dumps + conversion tooling), not an application.

## Data Artifacts

| File | Format | Size | Purpose |
| --- | --- | --- | --- |
| `data/quran.sql.zip` | MySQL dump (zip) | ~48 MB zipped / ~196 MB raw | Source of truth; input to converter |
| `quran.db.gz` | SQLite DB (gzip) | ~60 MB zipped / ~208 MB raw | Deliverable; query-ready SQLite database |
| `screenshots/*.png` | PNG images | — | Table screenshots used in `README.md:207-210` |

---

*Stack analysis: 2026-07-31*
