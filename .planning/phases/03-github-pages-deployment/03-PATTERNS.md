# Phase 3: GitHub Pages Deployment - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 2 new/modified (`.github/workflows/deploy-pages.yml`, `README.md`)
**Analogs found:** 1 / 2 source files matched in-repo (`README.md` self-analog); the workflow has NO in-repo analog — pattern source is the official GitHub starter workflow (external, fetched 2026-07-31)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/deploy-pages.yml` — two-job Pages deploy workflow | CI/CD config | batch/deploy | `actions/starter-workflows/pages/static.yml` (external, fetched 2026-07-31) — canonical shape; D-01 mandates official actions | external (no in-repo analog — `.github/` does not exist in this repo, verified) |
| `README.md` — add `## API` section (D-11/D-12/D-13) | docs | — | `README.md:1-223` (self) — existing section structure (`## Contents`, `## Database Schema`, `## Setup`), tables, fenced code blocks with `curl`/`python` examples | exact (append a new `##` section following existing conventions) |

## Pattern Assignments

### `.github/workflows/deploy-pages.yml` (CI/CD, batch/deploy)

**Analog:** `actions/starter-workflows/pages/static.yml` (official GitHub starter, fetched 2026-07-31 — the canonical source for this phase's shape; D-01/D-03 lock the official actions + two-job split)

**Structure pattern — official two-job Pages workflow** (deploy-pages README "dedicated job" recommendation + starter workflow):
```yaml
name: Deploy static content to Pages

on:
  push:
    branches: [main]        # D-08 — only main, no tags
  workflow_dispatch:         # D-08 — manual re-deploy

permissions:                 # D-04
  contents: read
  pages: write
  id-token: write

concurrency:                 # D-10
  group: pages
  cancel-in-progress: true

jobs:
  build:                     # D-03 build job
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'     # D-15
      - uses: actions/configure-pages@v5   # D-02 "pages config block" part of official pattern
      - run: gunzip -k quran.db.gz           # D-14
      - run: python3 generate_json_api.py --generate   # D-09
      - run: python3 generate_json_api.py --validate   # D-09 — exit≠0 fails job, blocks deploy
      - run: mkdir -p _site && cp -r api _site/        # D-06
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site                        # D-05 — only api/ published (default is _site/ per action README)

  deploy:                    # D-03 deploy job
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build             # D-09 gate — deploy only after build+validate succeed
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

**Version-pinning pattern:** `@vN` major tags exactly as fetched from the starter workflow (2026-07-31): `checkout@v4`, `setup-python@v5`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v5`. No floating tags, no SHA pins (repo convention has no existing CI to mirror; official starters use `@vN`).

**Action-version fallback note (Research A1):** the deploy-pages action README example shows `@v4` while the starter workflow uses `@v5` — pin `@v5` per the canonical starter; if the tag fails to resolve at run time, fall back to `@v4` (identical contract).

### `README.md` (docs)

**Analog:** `README.md:1-223` (self)

**Section-structure pattern** (existing `##` sections: `## Contents`, `## Database Schema`, `## Setup`, `## Roadmap`, `## Contributing`, ...):
- New `## API` section follows D-11 (no separate `docs/api.md`).
- Fenced code blocks with bash commands match the existing style (`README.md:107-131` uses ` ```bash ` blocks for `unzip`, `gunzip`, `sqlite3`).
- Table style for structured info matches `## Contents` (`README.md:7-11`).

**Documented-URL pattern (D-12):** every example uses the exact live base URL `https://C-Fu.github.io/quran-database-malay` — the same URL contract that Phase 2's D-07 locked (`api/` layout → `/api/surah/2.json` under the project-site path prefix). README examples MUST use this full URL (never a relative path), because curl consumers outside the repo need absolute URLs.

**jq filter pattern (D-12/API-05):** `jq '.[] | select(.malay | contains("<keyword>"))'` — the exact filter shape from REQUIREMENTS.md API-05 and Phase 2's verified consumer pattern (`02-RESEARCH.md:391-396`). Keep the single-quote wrapping (protects `<keyword>` from shell expansion) exactly as API-05 specifies.

## Shared Patterns

### Milestone-print + `Done!` sentinel (repo convention — from existing scripts)
**Source:** `convert_to_sqlite.py:408-419`, `add_malay_translation.py:219-234`, `generate_json_api.py:186-194`
**Apply to:** not needed in YAML — the workflow's `run:` steps inherit the scripts' output; the Actions log displays it. No new print patterns introduced.

### Wipe-and-regenerate determinism (repo convention)
**Source:** `convert_to_sqlite.py:350-351` (wipes quran.db), `generate_json_api.py:95` (wipes api/)
**Apply to:** the workflow rebuilds from the committed `quran.db.gz` fresh on every run (D-14) — the runner's fresh checkout IS the wipe. No `_site/` cleanup needed (build-time only, never committed).

### Exit-code contract (repo convention)
**Source:** `generate_json_api.py:194` (`return 0 if not errors else 1`), Phase 2 D-18
**Apply to:** `run: python3 generate_json_api.py --validate` as a standalone step — non-zero exit fails the `build` job, and `deploy` has `needs: build` (D-09). This is the CI-native form of the repo's exit-code discipline.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.github/workflows/deploy-pages.yml` | CI/CD config | batch/deploy | No `.github/` directory exists in the repo (verified) — first CI artifact. Pattern source is the official GitHub starter workflow (external), which this phase follows per D-01/D-03. |

## Metadata

**Analog search scope:** repo root + `.github/` (absent) + official `actions/starter-workflows` (external, fetched 2026-07-31)
**Files scanned:** repo root listing (no `.github/`), `README.md`, `.gitignore`, `generate_json_api.py` (for exit-code + print conventions)
**Pattern extraction date:** 2026-07-31

**Key deviations to flag for the planner:**
1. The workflow file is the repo's FIRST CI artifact — no in-repo YAML conventions exist; follow the official starter shape verbatim (pinned @vN tags).
2. `upload-pages-artifact` default path is `_site/` (action README) — passing `path: _site` explicitly is self-documenting and matches D-06.
3. README's existing structure has no API section; append `## API` following the established `##`-section + fenced-bash-block conventions.
4. All README URLs must be absolute (`https://C-Fu.github.io/quran-database-malay/api/...`) per D-12 — curl consumers are outside the repo.
