# Phase 3: GitHub Pages Deployment - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

A GitHub Actions workflow builds the JSON API artifacts (from `quran.db.gz`, which already contains the `ms.basmeih` Malay translation from Phase 1) and deploys them to GitHub Pages, exposing the public URLs `https://C-Fu.github.io/quran-database-malay/api/surah/{n}.json`, `/api/search.json`, and `/api/surahs.json`. The README documents the endpoints and curl + jq usage. The browser search UI (Phase 4) builds on the deployed site root. This phase delivers API-04 and API-05 only — no UI work.

</domain>

<decisions>
## Implementation Decisions

### Deployment mechanism
- **D-01:** Use the **official GitHub Pages deployment actions** (`actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`) — NOT third-party (`peaceiris/actions-gh-pages`) and NOT branch/folder serving.
- **D-02:** Pages deployment source must be set to **"GitHub Actions"** in repo Settings → Pages (one-time setup; a `pages` config block in the workflow is also part of the official pattern).
- **D-03:** Workflow is structured as **two jobs**: a `build` job (checkout → setup Python → generate → validate → upload artifact) and a `deploy` job (`needs: build`, runs `actions/deploy-pages`). Deploy only starts after build/validate succeed.
- **D-04:** Workflow permissions: `contents: read`, `pages: write`, `id-token: write`.

### Deployed scope & URL mapping
- **D-05:** The Pages artifact is a staging dir **`_site/`** that contains **only the generated `api/` directory** — the published site is ~3.5MB and exposes no scripts, README, or `quran.db.gz`.
- **D-06:** The workflow creates `_site/` (e.g. `mkdir -p _site`), copies the generated `api/` into it (`cp -r api _site/`), and uploads `_site/` as the Pages artifact. This keeps `/api/surah/2.json` resolving at the site root under the project path prefix `/quran-database-malay/`.
- **D-07:** **No root page (index.html) in Phase 3** — `https://C-Fu.github.io/quran-database-malay/` may 404 until Phase 4 adds the search UI. Strictly scoped to deployment.

### Trigger & validation strategy
- **D-08:** Workflow triggers on **push to `main`** plus **`workflow_dispatch`** (manual re-deploy). No tag triggers.
- **D-09:** The build job runs `python3 generate_json_api.py --generate` then `python3 generate_json_api.py --validate`; **validation gates the deploy** — a non-zero exit (or failed generation) blocks the deploy job from running. This honors Phase 2 D-18's CI-friendly exit-code contract.
- **D-10:** Add `concurrency` group on the main branch with `cancel-in-progress: true` so rapid successive pushes only deploy the latest state.

### README API documentation
- **D-11:** Add an **"API" section to the existing `README.md`** (no separate `docs/api.md`).
- **D-12:** Document the **3 endpoints** with the **actual live base URL** `https://C-Fu.github.io/quran-database-malay`:
  - fetch a surah: `curl https://C-Fu.github.io/quran-database-malay/api/surah/2.json`
  - Malay keyword search: `curl .../api/search.json | jq '.[] | select(.malay | contains("<keyword>"))'`
  - list surahs: `curl .../api/surahs.json`
- **D-13:** Include a note that `api/` is gitignored and built/deployed by GitHub Actions (one sentence; the README also documents the curl + jq pattern from API-05).

### CI build inputs
- **D-14:** The workflow obtains `quran.db` by running **`gunzip -k quran.db.gz`** (the committed 62MB artifact, verified to contain `ms.basmeih` with 6,236 rows) — NOT the full rebuild pipeline (unzip MySQL dump → convert → add malay).
- **D-15:** Use **`actions/setup-python`** with a pinned stable version (recommend 3.12; the generator is stdlib-only and verified on 3.13.5). Do not rely on the runner's default Python.

### OpenCode's Discretion
- Workflow file name (e.g. `.github/workflows/deploy-pages.yml`), job names, and step-level details
- Exact Pages artifact upload path/name for `upload-pages-artifact`
- Whether to include a `pages` config block vs. relying on Settings; exact environment name (`github-pages`)
- README section placement within the file and exact example formatting
- Whether `--validate` is run as a shell step or via a small script step (shell step expected)

</decisions>

<specifics>
## Specific Ideas

- The two-job structure (build → deploy) with artifact hand-off mirrors the official Pages starter workflow — deploy only ever sees validated output.
- "Minimal published site" theme: only `api/` on Pages; everything else stays in the repo. `_site/` naming anticipates Phase 4 dropping `index.html` in the same staging dir.
- `gunzip -k` (keep the source file) so the generated `quran.db` is available on the runner for debugging without a re-decompress.
- The live URL `https://C-Fu.github.io/quran-database-malay` was confirmed from `git remote -v` (origin `C-Fu/quran-database-malay`).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scope
- `.planning/REQUIREMENTS.md` §GitHub Pages API — API-04 (Actions-built + Pages-deployed JSON) and API-05 (curl static URLs + local jq filtering), plus the exact jq filter shape `.[] | select(.malay | contains(...))`
- `.planning/ROADMAP.md` §Phase 3 — goal, success criteria (workflow deploys on push; `curl .../api/surah/2.json` returns surah 2; jq search returns matches; README documents endpoints + curl examples), plan split 03-01/03-02
- `.planning/PROJECT.md` — Constraints (static-only Pages, GitHub Actions at deploy time), Key Decisions (GitHub Pages + Actions-built JSON)

### Phase 2 locked decisions (build inputs for this phase)
- `.planning/phases/02-json-api-generation/02-CONTEXT.md` — D-07 (`api/` layout is the deploy input), D-10 (`api/` gitignored, built at deploy time — never commit generated files), D-18 (`--validate` is CI-friendly with exit code 0/non-zero for this phase's workflow). MUST NOT be re-opened.

### Build tools (the workflow's runtime)
- `generate_json_api.py` — the generator the build job invokes: `--generate` (writes `api/`, reads `quran.db` at repo root) and `--validate` (checks all artifacts, exit 0/1). Read it to align workflow steps.
- `.gitignore` — confirms `api/` is ignored (build-at-deploy-time input to this phase).

### GitHub Pages deployment pattern (external)
- Official Actions: `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages` — see GitHub's Pages "starter workflow" for the canonical two-job shape this phase follows.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generate_json_api.py` — the exact commands the workflow runs: `python3 generate_json_api.py --generate` then `python3 generate_json_api.py --validate`. `--generate` reads `quran.db` (repo root) and writes `api/`; `--validate` returns exit code 0 on success, 1 on any structural/coverage error (`generate_json_api.py:124-194`).
- `quran.db.gz` — committed 62MB gzip of the current DB; verified to contain `ms.basmeih` (6,236 rows) and 114 surahs. The only DB source the workflow needs.
- `.gitignore` — already ignores `api/`; no changes needed for this phase (the staging dir `_site/` is build-time only, never committed).

### Established Patterns
- Artifacts are committed, generated output is not: `data/ms.basmeih.json` and `quran.db.gz` are committed; `api/` is built at deploy time (Phase 2 D-10). The workflow must preserve this — it builds `api/` fresh on every run.
- Python 3 stdlib only, no runtime deps — the workflow's build job needs nothing beyond Python itself.
- Deterministic rebuild culture: `convert_to_sqlite.py` wipes `quran.db` before rebuild, the generator wipes `api/` (`generate_json_api.py:95`); the workflow's fresh checkout + gunzip + generate is the same "always rebuild from committed source" philosophy.

### Integration Points
- Output contract for this phase: `_site/api/` is uploaded to Pages, resolving to `https://C-Fu.github.io/quran-database-malay/api/...` (project-site path prefix `/quran-database-malay/` added automatically).
- `.github/workflows/` is created in this phase (does not exist yet — verified).
- Phase 4 consumes: the deployed site root (`_site/` will gain `index.html`) and the `/api/search.json` + `/api/surahs.json` endpoints this phase publishes.
- Repo Settings change required (outside code): Pages source = "GitHub Actions".

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-github-pages-deployment*
*Context gathered: 2026-07-31*
