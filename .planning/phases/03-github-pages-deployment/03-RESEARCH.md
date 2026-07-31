# Phase 3: GitHub Pages Deployment - Research

**Researched:** 2026-07-31
**Domain:** GitHub Actions Pages deployment (official actions pipeline)
**Confidence:** HIGH — verified against live official docs and the canonical starter workflow fetched 2026-07-31

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim)

- **D-01:** Use the **official GitHub Pages deployment actions** (`actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`) — NOT third-party (`peaceiris/actions-gh-pages`) and NOT branch/folder serving.
- **D-02:** Pages deployment source must be set to **"GitHub Actions"** in repo Settings → Pages (one-time setup; a `pages` config block in the workflow is also part of the official pattern).
- **D-03:** Workflow is structured as **two jobs**: a `build` job (checkout → setup Python → generate → validate → upload artifact) and a `deploy` job (`needs: build`, runs `actions/deploy-pages`). Deploy only starts after build/validate succeed.
- **D-04:** Workflow permissions: `contents: read`, `pages: write`, `id-token: write`.
- **D-05:** The Pages artifact is a staging dir **`_site/`** that contains **only the generated `api/` directory** — the published site is ~3.5MB and exposes no scripts, README, or `quran.db.gz`.
- **D-06:** The workflow creates `_site/` (e.g. `mkdir -p _site`), copies the generated `api/` into it (`cp -r api _site/`), and uploads `_site/` as the Pages artifact. This keeps `/api/surah/2.json` resolving at the site root under the project path prefix `/quran-database-malay/`.
- **D-07:** **No root page (index.html) in Phase 3** — `https://C-Fu.github.io/quran-database-malay/` may 404 until Phase 4 adds the search UI. Strictly scoped to deployment.
- **D-08:** Workflow triggers on **push to `main`** plus **`workflow_dispatch`** (manual re-deploy). No tag triggers.
- **D-09:** The build job runs `python3 generate_json_api.py --generate` then `python3 generate_json_api.py --validate`; **validation gates the deploy** — a non-zero exit (or failed generation) blocks the deploy job from running. This honors Phase 2 D-18's CI-friendly exit-code contract.
- **D-10:** Add `concurrency` group on the main branch with `cancel-in-progress: true` so rapid successive pushes only deploy the latest state.
- **D-11:** Add an **"API" section to the existing `README.md`** (no separate `docs/api.md`).
- **D-12:** Document the **3 endpoints** with the **actual live base URL** `https://C-Fu.github.io/quran-database-malay`:
  - fetch a surah: `curl https://C-Fu.github.io/quran-database-malay/api/surah/2.json`
  - Malay keyword search: `curl .../api/search.json | jq '.[] | select(.malay | contains("<keyword>"))'`
  - list surahs: `curl .../api/surahs.json`
- **D-13:** Include a note that `api/` is gitignored and built/deployed by GitHub Actions (one sentence; the README also documents the curl + jq pattern from API-05).
- **D-14:** The workflow obtains `quran.db` by running **`gunzip -k quran.db.gz`** (the committed 62MB artifact, verified to contain `ms.basmeih` with 6,236 rows) — NOT the full rebuild pipeline (unzip MySQL dump → convert → add malay).
- **D-15:** Use **`actions/setup-python`** with a pinned stable version (recommend 3.12; the generator is stdlib-only and verified on 3.13.5). Do not rely on the runner's default Python.

### OpenCode's Discretion (locked scope for planning)
- Workflow file name (e.g. `.github/workflows/deploy-pages.yml`), job names, step-level details
- Exact Pages artifact upload path/name for `upload-pages-artifact`
- Whether to include a `pages` config block vs. relying on Settings; exact environment name (`github-pages`)
- README section placement within the file and exact example formatting
- Whether `--validate` is run as a shell step or via a small script step (shell step expected)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Phase 4 (Search UI) adds `index.html` at the site root.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-04 | JSON files built by a GitHub Actions workflow and deployed to GitHub Pages | Two-job workflow (build → validate → upload artifact → deploy) verified against official actions docs + current starter workflow (fetched 2026-07-31). `upload-pages-artifact@v3` default `path: _site/` exactly matches D-06's staging dir. See Summary. |
| API-05 | Consumers can retrieve verses by curling static URLs (e.g. `curl https://<owner>.github.io/<repo>/api/surah/2.json`) and filter locally with `jq` | URL resolution confirmed: project-site Pages path prefix `<owner>.github.io/<repo>/` + `api/` layout from Phase 2 D-07 yields `/api/surah/2.json`. jq 1.7 verified available in env. README documents the 3 endpoints (D-12). |

## Project Constraints (from AGENTS.md)

1. **Hosting is GitHub Pages — static only, no server-side logic at request time** (Constraints: Hosting). The workflow publishes pre-built JSON only; no request-time code. [VERIFIED: AGENTS.md]
2. **Build happens in GitHub Actions at deploy time** (Constraints: Build). The workflow builds `api/` fresh each run from committed `quran.db.gz` (D-14) — generated output is never committed. [VERIFIED: AGENTS.md + .gitignore has `api/`]
3. **Python 3 stdlib only for the data pipeline** (Constraints: Tech stack). The workflow's build job needs nothing beyond Python itself; `actions/setup-python` with 3.12 (D-15). [VERIFIED: generate_json_api.py imports only stdlib]
4. **Data: Arabic alongside Malay in responses** — already satisfied by Phase 2's generator output; the workflow deploys it verbatim. [VERIFIED: generate_json_api.py output shape]
5. **GSD workflow enforcement:** all Phase 3 changes flow through `/gsd-plan-phase` → `/gsd-execute-phase`; planning artifacts committed per `commit_docs: true`. [VERIFIED: AGENTS.md]
6. **No new dependencies:** the workflow adds no pip/npm installs; runner tools (`gunzip`, `python3`) are pre-installed on `ubuntu-latest`. [VERIFIED: gunzip 1.11 present in env; GitHub-hosted runners include gzip]
7. **Git branch invariant:** Phase 3 commits to `main` (current branch); do not create branches. [VERIFIED: `git branch --show-current` = main]

## Summary

Phase 3 deploys the Phase 2 `api/` output (per-surah files + `search.json` + `surahs.json`) to GitHub Pages via a two-job GitHub Actions workflow, then documents the endpoints in README.

**Deployment architecture (verified against official sources):** GitHub's current Pages starter workflow (`actions/starter-workflows/pages/static.yml`, fetched 2026-07-31) pins: `actions/checkout@v4` → `actions/configure-pages@v5` → `actions/upload-pages-artifact@v3` → `actions/deploy-pages@v5`, with `permissions: {contents: read, pages: write, id-token: write}` at workflow level, `environment: github-pages` + `url: ${{ steps.deployment.outputs.page_url }}` on the deploy job, and a `concurrency` group. The `deploy-pages` action's own README documents the **dedicated two-job split** (build job uploads the artifact; deploy job `needs: build` and runs `actions/deploy-pages`) — exactly the D-03 shape this phase requires. Key verified facts:

1. **`actions/upload-pages-artifact@v3` default `path` is `_site/`** — the action's own README lists `path` default as `_site/`, which is precisely the D-05/D-06 staging dir. Passing `path: _site` explicitly (or relying on the default) both work; explicit is clearer. Artifact name defaults to `github-pages`, which `deploy-pages` expects.
2. **The published site is bounded:** `upload-pages-artifact` accepts the directory; Pages officially supports up to 1GB sites with a 10-minute deployment timeout. Our `api/` is 3.5MB locally (verified: `du -sh api/` = 3.5M, `search.json` = 3.2MB, 114 surah files) — trivially within limits.
3. **`actions/configure-pages@v5`** is part of the canonical flow (sets up Pages config/environment). It's cheap and future-proofs the site root for Phase 4. Include it in the build job per the starter workflow shape (D-02's "pages config block" reference).
4. **Environment auto-creation:** GitHub creates the `github-pages` environment automatically on first deploy if it doesn't exist (deploy-pages README, "Security Considerations" §3). No manual environment setup needed.
5. **Settings change is human-required (D-02):** the repo's Pages source must be set to "GitHub Actions" in Settings → Pages → Build and deployment → Source (verified against docs.github.com "Configuring a publishing source for your GitHub Pages site" — the "Publishing with a custom GitHub Actions workflow" section confirms the Settings → Pages → Source → "GitHub Actions" path). This is the phase's one true human step; `gh` CLI is NOT installed in the env (verified), so it cannot be automated via API. The deploy job will fail until this is set — the plan must sequence this before the live-URL verification.
6. **Workflow run monitoring:** without `gh` CLI, the executor cannot query the Actions API for run status. Verification of deployment is done by polling the **live URLs** with `curl` (which works regardless of repo visibility once Pages is live). Timeout-aware polling (e.g. up to ~5 min, retry every 15-20s) accommodates runner spin-up + 208MB gunzip + generation.
7. **`gunzip -k` behavior:** `-k` keeps the source `quran.db.gz` on the runner (D-14) — verified `gunzip -k` present in env (gzip 1.11). On GitHub's `ubuntu-latest` runners gzip is pre-installed. Note: locally `quran.db` already exists (219MB untracked) — the local CI simulation must run in a temp dir (copy `quran.db.gz` + `generate_json_api.py` there) so `gunzip -k` has no pre-existing target conflict, exactly mirroring the fresh runner checkout.

**Workflow file design (derived):** `.github/workflows/deploy-pages.yml` (name + job names are OpenCode discretion; the following honors every locked decision):

```yaml
name: Deploy static content to Pages

on:
  push:
    branches: [main]          # D-08
  workflow_dispatch:          # D-08 manual re-deploy

permissions:                  # D-04
  contents: read
  pages: write
  id-token: write

concurrency:                  # D-10
  group: pages
  cancel-in-progress: true

jobs:
  build:                      # D-03 build job
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5   # D-15
        with:
          python-version: '3.12'
      - uses: actions/configure-pages@v5
      - run: gunzip -k quran.db.gz      # D-14
      - run: python3 generate_json_api.py --generate   # D-09
      - run: python3 generate_json_api.py --validate   # D-09 (exit ≠ 0 blocks deploy)
      - run: mkdir -p _site && cp -r api _site/        # D-06
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site                    # D-05/D-06

  deploy:                     # D-03 deploy job
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

Note on the D-09 gate: `--validate` returning non-zero fails the `build` job; `deploy` has `needs: build` so it never runs — the validation genuinely gates the deploy (matches Phase 2 D-18's exit-code contract and the deploy-pages README's "dedicated job" recommendation).

**README documentation (derived from D-11/D-12/D-13):** add an `## API` section documenting the 3 endpoints against the live base URL `https://C-Fu.github.io/quran-database-malay`, with:
- fetch a surah: `curl https://C-Fu.github.io/quran-database-malay/api/surah/2.json`
- Malay keyword search (jq filter matching API-05's `.[] | select(.malay | contains(...))` shape):
  `curl https://C-Fu.github.io/quran-database-malay/api/search.json | jq '.[] | select(.malay | contains("<keyword>"))'`
- list surahs: `curl https://C-Fu.github.io/quran-database-malay/api/surahs.json`
- one-sentence note: `api/` is gitignored and built/deployed by GitHub Actions on every push to `main` (D-13).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Build `api/` at deploy time | CI/CD (GitHub Actions) | — | The `build` job: checkout → setup-python → gunzip → generate → validate (D-09/D-14/D-15) |
| Artifact staging (`_site/`) | CI/CD (GitHub Actions) | — | `mkdir -p _site && cp -r api _site/` then `upload-pages-artifact` with `path: _site` (D-05/D-06) |
| Static file serving (`/api/surah/2.json`) | CDN / Static (GitHub Pages) | — | `deploy-pages` publishes the artifact; project-site path prefix `/quran-database-malay/` (verified URL contract from Phase 2 D-07) |
| Usage documentation | Docs (README) | — | `## API` section with curl + jq examples (D-11/D-12/D-13) |

**Note:** No browser/UI tier in this phase (D-07 — Phase 4 adds `index.html`). The site root will 404 until then; the documented API endpoints are the deliverable.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `actions/checkout` | v4 | Check out the repo on the runner | Current major in the official starter workflow (fetched 2026-07-31) |
| `actions/setup-python` | v5 | Pin Python 3.12 for the build job | D-15 mandates pinned stable; starter-pattern compatible; generator verified on 3.13.5 but 3.12 is the current stable recommendation [CITED: starter workflow] |
| `actions/configure-pages` | v5 | Set up Pages config in the build job | Part of the official three-action deployment trio (D-01) + D-02's "pages config block" reference |
| `actions/upload-pages-artifact` | v3 | Package + upload `_site/` as the Pages artifact | Official action (D-01); default `path: _site/` matches D-06 exactly [VERIFIED: action README] |
| `actions/deploy-pages` | v5 | Publish the uploaded artifact to Pages | Official action (D-01); requires `pages: write` + `id-token: write` (D-04) and the `github-pages` environment [VERIFIED: action README] |
| `gunzip` (runner tool) | gzip 1.x | Decompress committed `quran.db.gz` (D-14) | Pre-installed on ubuntu-latest runners; verified present in env |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jq` (CLI) | 1.7 [VERIFIED: env] | Consumer-side filtering in README examples + deployed-URL verification | Plan 03-02 verification and README docs (API-05) |
| `curl` (CLI) | system | Polling live Pages URLs for deployment verification | Plan 03-02; works without gh CLI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Official actions trio (D-01) | `peaceiris/actions-gh-pages` (third-party) | **Locked decision D-01** — peaceiris pushes a `gh-pages` branch (branch-serving, not Actions artifact deploy); official actions are the current GitHub-recommended path and require no branch |
| Branch/folder serving (Settings → Deploy from a branch) | Actions workflow | **Locked decision D-01/D-02** — branch serving cannot run the build step (`gunzip` + `generate_json_api.py`) at publish time; the workflow builds fresh from `quran.db.gz` each push |
| `actions/deploy-pages@v4` | `@v5` | v5 is the current tag in the official starter workflow (fetched 2026-07-31); both require identical permissions/env. Pin `@v5`. |
| Local PyYAML/actionlint check of workflow YAML | grep-based structural verification | PyYAML NOT installed (verified) and adding deps violates the stdlib-only convention; the workflow is a fixed 2-job shape — structural grep gates + local build-job simulation cover it. Real validation = the actual Actions run. |

**Installation:** None. The workflow adds no pip/npm installs; all runner tools pre-installed. No repo metadata changes (no package manager files).

**Version verification:** All action majors pinned per the official starter workflow fetched 2026-07-31 (checkout@v4, setup-python@v5, configure-pages@v5, upload-pages-artifact@v3, deploy-pages@v5). Python 3.12 for setup-python (D-15 recommendation); generator stdlib-only. jq 1.7, gzip 1.11, python3 3.13.5 verified in env.

## Architecture Patterns

### System Architecture Diagram

```
                      ┌─────────────────────────────────────────────────────┐
                      │          .github/workflows/deploy-pages.yml        │
                      │                                                     │
  push to main ─────► │  on: push main + workflow_dispatch        (D-08)   │
  (workflow_dispatch) │  concurrency: group=pages, cancel-in-progress=true │
                      │  permissions: contents:read pages:write id-token:write (D-04)
                      │                                                     │
                      │  job: build (ubuntu-latest)                         │
                      │    checkout@v4                                      │
                      │    setup-python@v5 (3.12)                  (D-15)   │
                      │    configure-pages@v5                      (D-02)   │
                      │    gunzip -k quran.db.gz                   (D-14)   │
                      │    python3 generate_json_api.py --generate (D-09)   │
                      │    python3 generate_json_api.py --validate (D-09)   │  ← exit≠0 fails job → deploy skipped
                      │    mkdir -p _site && cp -r api _site/      (D-06)   │
                      │    upload-pages-artifact@v3 path:_site     (D-05)   │
                      │        └── artifact: github-pages                  │
                      │                                                     │
                      │  job: deploy (needs: build)                (D-03)   │
                      │    environment: github-pages                        │
                      │    deploy-pages@v5 → page_url                       │
                      └──────────────┬──────────────────────────────────────┘
                                     │ publishes artifact
                                     ▼
                 https://C-Fu.github.io/quran-database-malay/
                 ├── api/surah/1.json … 114.json   (D-12 curl contract)
                 ├── api/search.json               (6,236 verses, jq filter)
                 └── api/surahs.json               (114 surahs)
                 (no index.html — 404 at root until Phase 4, D-07)
```

### Pattern 1: Official Two-Job Pages Deployment (build → deploy)
**What:** The canonical GitHub Pages Actions pattern from the `deploy-pages` README: a `build` job that produces + uploads the artifact via `upload-pages-artifact`, and a `deploy` job with `needs: build`, `environment: github-pages`, `url: ${{ steps.deployment.outputs.page_url }}`, running `deploy-pages`. [VERIFIED: deploy-pages README + starter workflow, 2026-07-31]
**When to use:** Mandated by D-03 (two jobs, deploy only after build/validate succeed).
**Example:** The derived workflow in Summary above.

### Pattern 2: Validation-Gated Deploy
**What:** The build job runs `--generate` then `--validate`; `deploy` has `needs: build`, so a non-zero `--validate` exit fails the build job and the deploy job never starts. This honors Phase 2 D-18's exit-code contract and D-09's "validation gates the deploy". [VERIFIED: generate_json_api.py:194 `return 0 if not errors else 1`; needs: build semantics]
**When to use:** Always in this phase — it is the literal reading of D-09.

### Pattern 3: Staging-Dir Artifact Upload
**What:** Create a `_site/` staging dir, copy only the generated `api/` into it, upload `_site/` via `upload-pages-artifact` (default `path: _site/`). The published site contains only `api/` — no scripts, README, or `quran.db.gz` (D-05). Project-site path prefix `/quran-database-malay/` makes `/api/surah/2.json` resolve at the site root. [VERIFIED: upload-pages-artifact README default path; Phase 2 D-07 layout]

### Anti-Patterns to Avoid
- **Third-party Pages actions** (`peaceiris/actions-gh-pages`): D-01 locks the official trio.
- **Branch/folder serving:** can't build at publish time; D-01/D-02 lock the Actions workflow.
- **Deploying the whole repo as the artifact** (`path: '.'`): would publish README, scripts, and the 62MB `quran.db.gz` — D-05 locks `_site/` containing only `api/`.
- **`gunzip` without `-k`**: would delete `quran.db.gz` on the runner; D-14 locks `-k`.
- **No concurrency group:** rapid pushes would enqueue stale deploys; D-10 locks `cancel-in-progress: true`.
- **Failing to set Pages source to "GitHub Actions" (D-02):** deploy job errors "Failed to create deployment" until the Settings change is made. The human step must precede live-URL verification.
- **Trusting the default runner Python:** D-15 locks `setup-python` with a pinned version.
- **Committing `quran.db`:** it's untracked and 219MB; only `quran.db.gz` is committed. The executor must not `git add` `quran.db` or `api/`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pages deployment | Custom scripts pushing to a `gh-pages` branch / API calls | Official `actions/deploy-pages` | Official action is the GitHub-recommended artifact deploy; handles OIDC validation, deployment status reporting, environment targeting [VERIFIED: action README] |
| Artifact packaging | Manual `actions/upload-artifact` + tar/gzip | `actions/upload-pages-artifact` | Produces the exact `github-pages` artifact format `deploy-pages` expects; default path `_site/` matches D-06 [VERIFIED: action README] |
| Pages setup/config | Manual environment + config API calls | `actions/configure-pages` | Part of the official trio (D-01); sets up the Pages config block |
| Python provisioning | `apt-get install python3` / rely on runner default | `actions/setup-python` | D-15 pins 3.12; setup-python caches and is the standard action |

**Key insight:** Every deployment primitive in this phase is an official GitHub action. The workflow is a composition of five pinned actions with two `run:` steps (gunzip, generate) between them. The novelty is all in the *ordering* (validate gates deploy) and *staging* (only `api/` published) — both locked decisions, both verified against official docs.

## Common Pitfalls

### Pitfall 1: Deploy job fails with "Failed to create deployment" — Pages source not set
**What goes wrong:** The workflow runs green through build, then the deploy job errors because the repo's Pages source is still "Deploy from a branch" (or None).
**Why it happens:** `deploy-pages` can only create deployments when Settings → Pages → Source = "GitHub Actions" (D-02).
**How to avoid:** Sequence the human Settings change BEFORE live-URL verification. Make it an explicit checkpoint in plan 03-02 with exact instructions. [VERIFIED: docs.github.com publishing-source docs]
**Warning signs:** deploy job log contains `Failed to create deployment` or `must be triggered from the source branch`.

### Pitfall 2: URL 404s — wrong path prefix or stale deploy
**What goes wrong:** `curl https://C-Fu.github.io/quran-database-malay/api/surah/2.json` returns 404 while `https://C-Fu.github.io/api/surah/2.json` works (or vice versa).
**Why it happens:** Project-site Pages URLs are `<owner>.github.io/<repo>/` — the `/quran-database-malay/` prefix is mandatory (D-12 locks the full URL). Also, Pages deploys take 1-3 minutes to propagate after the workflow completes.
**How to avoid:** Use the exact D-12 URLs in both README and verification; poll with retries + timeout (up to ~5 min).
**Warning signs:** curl 404 on the prefixed URL; curl 200 on the unprefixed URL.

### Pitfall 3: `gunzip -k` fails locally because `quran.db` already exists
**What goes wrong:** Running `gunzip -k quran.db.gz` in the repo root where `quran.db` (219MB, untracked) already exists prompts "already exists; do you wish to overwrite (y or n)?" and fails non-interactively.
**Why it happens:** `gunzip` refuses to overwrite existing files without `-f`; locally the DB already exists from Phase 2.
**How to avoid:** Local CI simulation must run in a temp dir: copy `quran.db.gz` + `generate_json_api.py` to `/tmp/opencode/ci-sim/`, then run the exact CI steps there. On the GitHub runner, checkout is fresh so no conflict. [VERIFIED: gunzip 1.11 behavior; env has quran.db]
**Warning signs:** `gunzip: quran.db already exists` in local sim; CI unaffected.

### Pitfall 4: Committing build artifacts (quran.db / api/)
**What goes wrong:** `git add -A` picks up the 219MB untracked `quran.db` or the regenerated `api/` (gitignored but present on disk).
**Why it happens:** Loose staging during execution.
**How to avoid:** Explicit staged-file lists in commits; `api/` already gitignored (verified `.gitignore:3`); never `git add` `quran.db`. Plan's verify steps use exact paths.
**Warning signs:** A commit containing `quran.db` or `api/`.

### Pitfall 5: Deploying the whole repo (`path: '.'`)
**What goes wrong:** The published site exposes `quran.db.gz` (62MB), README, scripts — violating D-05's "only api/" and bloating the site.
**Why it happens:** Copying the starter workflow's `path: '.'` example verbatim.
**How to avoid:** Always stage via `_site/` (D-06): `mkdir -p _site && cp -r api _site/`, upload `path: _site`. [VERIFIED: upload-pages-artifact default `_site/`]

### Pitfall 6: Polling Actions API without gh CLI
**What goes wrong:** Executor tries `gh run watch` / `gh api` to monitor the workflow — `gh` is NOT installed (verified).
**Why it happens:** gh-based monitoring is the default mental model for Actions.
**How to avoid:** Verify deployment by polling the live URLs with `curl` (works regardless of auth): `curl -fsS -o /dev/null -w '%{http_code}' <url>` in a retry loop. If repo visibility permits (public), `curl api.github.com/repos/C-Fu/quran-database-malay/actions/runs` works unauthenticated but is rate-limited — prefer URL polling.

## Code Examples

### Verified: The workflow file (full, honors all D-01..D-15)
```yaml
# .github/workflows/deploy-pages.yml
name: Deploy static content to Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Configure Pages
        uses: actions/configure-pages@v5
      - name: Unpack database
        run: gunzip -k quran.db.gz
      - name: Generate API
        run: python3 generate_json_api.py --generate
      - name: Validate API
        run: python3 generate_json_api.py --validate
      - name: Stage site
        run: mkdir -p _site && cp -r api _site/
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```
[Source: derived from actions/starter-workflows/pages/static.yml + deploy-pages README, both fetched 2026-07-31; all input values map to D-01..D-15]

### Verified: Local CI build-job simulation (temp dir, fresh-checkout parity)
```bash
mkdir -p /tmp/opencode/ci-sim && cd /tmp/opencode/ci-sim
cp /root/quran-database-malay/quran.db.gz /root/quran-database-malay/generate_json_api.py .
gunzip -k quran.db.gz
python3 generate_json_api.py --generate
python3 generate_json_api.py --validate
mkdir -p _site && cp -r api _site/
test -f _site/api/search.json && test -f _site/api/surahs.json && test "$(ls _site/api/surah/ | wc -l)" = "114"
# assert _site contains ONLY api/:
ls _site/   # must print exactly: api
```
[Source: VERIFIED command sequence — mirrors generate_json_api.py's contracts; `gunzip -k` requires a dir without pre-existing quran.db]

### Verified: Deployed-URL verification (plan 03-02)
```bash
# surah 2 → 286 verses (surah 2 has 286 ayahs)
curl -fsS https://C-Fu.github.io/quran-database-malay/api/surah/2.json | jq 'length'   # 286
# search index → 6,236 verses
curl -fsS https://C-Fu.github.io/quran-database-malay/api/search.json | jq 'length'   # 6236
# jq keyword search (API-05 shape)
curl -fsS https://C-Fu.github.io/quran-database-malay/api/search.json | jq -c '.[] | select(.malay | contains("pembalasan")) | {surah, ayah, malay}' | head -3
# surah list → 114
curl -fsS https://C-Fu.github.io/quran-database-malay/api/surahs.json | jq 'length'   # 114
```
[Source: VERIFIED local equivalents in Phase 2 research (`jq -c '.[] | select(.malay | contains("pembalasan"))' api/search.json` executed successfully on prototype output); surah 2 count 286 is a static Quran fact]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Branch/folder serving (Settings → Deploy from branch) | Actions workflow publishing an artifact | This phase (D-01/D-02) | Build-at-deploy-time becomes possible; no `gh-pages` branch pollution |
| `peaceiris/actions-gh-pages` (third-party) | Official `configure-pages` + `upload-pages-artifact` + `deploy-pages` trio | This phase (D-01) | Official, maintained by GitHub; OIDC-verified deployments; artifact-based (no branch) |
| `deploy-pages@v4` | `deploy-pages@v5` | 2026 (starter workflow updated) | Same permissions/env contract; v5 is the current canonical tag |
| Committed generated output | `api/` gitignored, built fresh each push | Phase 2 D-10 (already in effect) | Workflow rebuilds deterministically from `quran.db.gz` (D-14) |

**Deprecated/outdated:**
- `actions/upload-pages-artifact@v2` and earlier: v3 is current (README example pins v3).
- `actions/configure-pages@v4` and earlier: v5 current.
- `actions/deploy-pages@v4`: superseded by v5 in the canonical starter (still functional; identical contract).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `actions/deploy-pages@v5` is the correct current major (per starter workflow fetched 2026-07-31; the action README still shows v4 in one example) | Standard Stack | If v5 tag is unavailable, workflow fails at "uses" resolution → fallback to @v4 (identical contract, verified in action README). Low risk — starter workflow is the canonical source. |
| A2 | The `github-pages` environment is auto-created on first deploy (deploy-pages README §Security Considerations 3) | Summary | If not auto-created, deploy fails with environment error → manual environment creation needed. GitHub docs state it's automatic. Low risk. |
| A3 | Repo `C-Fu/quran-database-malay` will be public or the user has the Settings access to set Pages source (D-02); repo visibility couldn't be confirmed (GitHub API rate-limited 2026-07-31) | Pitfall 1 | If the repo is private and stays private, the user still needs admin access for Settings → Pages — same human step either way. The human checkpoint covers both. |
| A4 | Deployed-URL polling (curl, no gh) is sufficient to verify deployment | Pitfall 6 | If the workflow fails before deploying, curl polling never succeeds → the executor must fall back to having the user check the Actions tab (checkpoint covers: "paste workflow run URL"). |
| A5 | `gunzip` and `python3` are pre-installed on `ubuntu-latest` runners | Standard Stack | Both are standard pre-installed runner tools; setup-python covers Python regardless. gzip verified in env. Very low risk. |

## Open Questions (RESOLVED)

1. **`upload-pages-artifact` path: explicit `path: _site` vs relying on the default?**
   - What we know: the action's default is `_site/` (README-verified); D-06 says "uploads `_site/` as the Pages artifact".
   - Recommendation: pass `path: _site` explicitly — self-documenting, immune to default changes. Either satisfies D-06.
   - **RESOLVED:** explicit `path: _site` (plan 03-01 task 1).

2. **`--validate` as a shell step vs. script step?**
   - What we know: OpenCode's discretion says "shell step expected". One `run: python3 generate_json_api.py --validate` step; a non-zero exit fails the job automatically.
   - **RESOLVED:** two separate `run:` steps (`--generate`, then `--validate`) — mirrors D-09's wording exactly and makes the gate visible in the Actions log.

3. **Should `configure-pages@v5` be included?**
   - What we know: D-02 says "a `pages` config block in the workflow is also part of the official pattern"; the starter workflow includes it.
   - **RESOLVED:** yes — include it in the build job per the canonical starter shape; it also future-proofs the site for Phase 4's index.html.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `python3` | Local CI simulation (build-job parity) | ✓ | 3.13.5 | setup-python 3.12 on runner |
| `gunzip` | Local CI simulation (D-14 parity) | ✓ | gzip 1.11 | — (pre-installed on runners) |
| `jq` | README examples + deployed-URL verification | ✓ | 1.7 | Python one-liners |
| `curl` | Deployed-URL polling | ✓ | system | — |
| `quran.db.gz` (committed) | Workflow input (D-14) | ✓ | 62MB committed | — |
| `generate_json_api.py` | Workflow runtime (D-09) | ✓ | committed | — |
| `gh` CLI | Actions API monitoring | ✗ | — | curl-based URL polling (Pitfall 6) |
| PyYAML / actionlint | Workflow YAML validation | ✗ | — | grep-based structural verification (stdlib-only convention) |
| GitHub Actions | Actual deployment | ✗ (remote) | — | Human verifies via Actions tab (A4) |

**Missing dependencies with no fallback:** None for the automated path — the only human-required external setup is the Settings → Pages → Source = "GitHub Actions" change (D-02), sequenced as a checkpoint before live-URL verification.

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section included. Repo convention continues: **zero test infrastructure**, stdlib-only. This phase's automated verification surface is: (1) grep-based structural gates on the workflow YAML, (2) a local build-job simulation in a temp dir that mirrors the runner's fresh-checkout conditions, and (3) deployed-URL curl + jq checks against the live Pages site. The ultimate validator is the real Actions run — the workflow either deploys or fails loudly with a visible log.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (stdlib-only convention; grep structural gates + local CI simulation + live-URL checks) |
| Config file | none — no pytest.ini/pyproject.toml; do NOT add one |
| Quick run command | `python3 -c "import yaml" 2>/dev/null; grep -c 'uses: actions/deploy-pages@v5' .github/workflows/deploy-pages.yml` (structural gate) |
| Full suite command | Local CI sim (temp dir) + `curl -fsS https://C-Fu.github.io/quran-database-malay/api/surah/2.json | jq -e 'length == 286'` |
| Estimated runtime | Local sim < 60s (Phase 2 prototype: generate 0.27s; gunzip 62MB ~10s); live-URL checks bounded by deploy propagation (poll ~5 min max) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-04 | Workflow exists with two jobs, official actions, correct permissions/triggers | structural grep | `grep -c 'uses: actions/deploy-pages@v5' .github/workflows/deploy-pages.yml` + `grep -c '^  deploy:' ...` + `grep -c 'needs: build' ...` etc. (plan 03-01 task 1) | ✅ created in plan 03-01 |
| API-04 | CI build steps work on a fresh checkout | integration (local sim) | temp-dir gunzip → generate → validate → stage → `test -f _site/api/search.json` (plan 03-01 task 2) | ✅ script exists |
| API-05 | Deployed surah URL returns data | live smoke | `curl -fsS .../api/surah/2.json \| jq -e 'length == 286'` (plan 03-02) | ✅ post-deploy |
| API-05 | Deployed search index + jq filter work | live smoke | `curl -fsS .../api/search.json \| jq -e 'length == 6236'` + jq keyword filter (plan 03-02) | ✅ post-deploy |
| API-05 | README documents endpoints + curl examples | doc grep | `grep -c 'https://C-Fu.github.io/quran-database-malay/api/' README.md` + jq filter line (plan 03-02) | ✅ README exists |

### Sampling Rate
- **Per task commit:** plan 03-01 task 1: workflow structural grep gates; plan 03-02: README grep gates
- **Per plan wave:** local CI simulation (03-01); live URL checks (03-02)
- **Phase gate:** live `curl` of all 3 endpoints + README grep + user-verified Actions run (checkpoint)
- **Max feedback latency:** < 60s automated; live-URL checks ≤ 5 min polling

### Wave 0 Gaps
- [ ] Workflow YAML structural verification — grep gates on the exact pinned action versions + job structure (plan 03-01 task 1 verify). No test framework needed; PyYAML absent (verified) and stdlib-only convention forbids adding it.
- [ ] Local CI simulation — exact mirror of the runner's steps in a temp dir (plan 03-01 task 2). Covers the "fresh checkout" condition that grep cannot.
- [ ] Live-URL verification — requires the human D-02 Settings step + a completed workflow run; sequenced in plan 03-02 with a checkpoint.

## Security Domain

> `security_enforcement` absent from `.planning/config.json` — treated as enabled (ASVS L1, block on high). Honest assessment: the security surface of this phase is the **deployment pipeline itself** — the trust boundary moved from "local file generation" (Phase 2) to "a public GitHub Actions workflow publishing to a public CDN". Controls focus on least-privilege tokens, artifact minimalism, and deployment integrity.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | No user auth; but the deploy job authenticates to Pages via `GITHUB_TOKEN` + OIDC `id-token` — scoped to `pages: write` (D-04), which is the minimum required by `deploy-pages` [VERIFIED: action README Security Considerations] |
| V3 Session Management | no | — no sessions |
| V4 Access Control | yes | Least-privilege workflow permissions: `contents: read`, `pages: write`, `id-token: write` (D-04). No `contents: write`, no secrets, no admin scopes. Deploy job additionally gated by `needs: build` (D-03). |
| V5 Input Validation | partial | Published artifact is fixed-structure JSON validated by `--validate` (D-09 gate); the workflow accepts no untrusted input at runtime (triggers: push to main + workflow_dispatch only — D-08) |
| V6 Cryptography | no | Public data, no secrets; OIDC `id-token` is the only cryptographic token, required by `deploy-pages` |

### Known Threat Patterns for {GitHub Actions Pages deployment}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious/unexpected content published (bad artifact deployed) | Tampering | D-09: `--validate` gate runs before `needs: build` allows deploy; only `main` branch pushes trigger (D-08), so unreviewed PR content never deploys; artifact contains only validated `api/` (D-05/D-06) |
| Token misuse / privilege escalation from a compromised step | Elevation of Privilege | D-04 least-privilege scopes: `contents: read` (can't write repo), `pages: write` (can only create Pages deployments), `id-token: write` (OIDC for deploy-pages). No secrets in workflow. |
| Sensitive repo files leaked to the public site | Information Disclosure | D-05/D-06: only `_site/` (containing just `api/`) is uploaded; `quran.db.gz` (62MB), README, and scripts never enter the artifact. |
| Deploy queue pileup / stale deploys racing | Denial of Service | D-10 concurrency group with `cancel-in-progress: true` — rapid pushes only deploy the latest state; site size 3.5MB trivially under the 1GB Pages limit |
| Non-main-branch or unauthenticated workflow_dispatch abuse | Spoofing | D-08: `workflow_dispatch` requires write permission to the repo by definition; pushes only on `main`. OIDC claims validated by Pages (deploy-pages README §OIDC) |

## Sources

### Primary (HIGH confidence) — verified 2026-07-31
- **`actions/starter-workflows/pages/static.yml`** (raw.githubusercontent.com, fetched 2026-07-31) — current canonical single-job Pages workflow: `checkout@v4` → `configure-pages@v5` → `upload-pages-artifact@v3` (path `.`) → `deploy-pages@v5`, permissions `contents: read / pages: write / id-token: write`, `github-pages` environment + page_url, concurrency group. [VERIFIED — fetched]
- **`actions/deploy-pages` README** (github.com/actions/deploy-pages, fetched 2026-07-31) — dedicated two-job pattern (`needs: build`, permissions, environment), inputs/outputs (`page_url`), artifact name `github-pages`, Security Considerations (minimum permissions, environment auto-creation, OIDC). [VERIFIED — fetched]
- **`actions/upload-pages-artifact` README** (raw.githubusercontent.com, fetched 2026-07-31) — `path` default `_site/`, artifact name default `github-pages`, Pages size limits (1GB official max, 10-min deploy timeout). [VERIFIED — fetched]
- **docs.github.com "Configuring a publishing source for your GitHub Pages site"** (fetched 2026-07-31) — Settings → Pages → Source → "GitHub Actions" path (D-02), custom workflow flow (checkout → build → upload-pages-artifact → deploy-pages on default branch). [VERIFIED — fetched]
- **Local env** — `jq` 1.7, `gunzip` (gzip 1.11), `python3` 3.13.5 present; `gh` and PyYAML absent (drives verification strategy). [VERIFIED]
- **Repo state** — `.gitignore:3` has `api/`; `quran.db.gz` committed (62MB); `generate_json_api.py` committed with `--generate`/`--validate` (`:194` returns 0/1); `api/` locally generated (3.5M, 114 surah files); `quran.db` untracked; branch `main`. [VERIFIED]

### Secondary (MEDIUM confidence)
- [CITED: actions/starter-workflows repo state] — deploy-pages@v5 vs @v4 discrepancy (starter shows v5; action README example shows v4): resolved to v5 per the starter, with @v4 documented as fallback (A1).

### Tertiary (LOW confidence)
- None — no websearch-dependent claims; all behavioral claims verified from fetched official sources or local environment.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — action majors verified from the canonical starter workflow + both action READMEs fetched today
- Architecture: HIGH — two-job pattern is the documented official shape; D-03/D-06 map 1:1 to action semantics
- Pitfalls: HIGH — Pitfalls 1/2/3/6 verified from official docs or local environment observation; 4/5 are repo-state facts
- Validation approach: HIGH — grep gates + temp-dir CI simulation + live-URL polling all verified feasible in env

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 — action majors could bump (mitigation: pinned @vN tags; starter workflow re-check if deploy fails at "uses" resolution)
