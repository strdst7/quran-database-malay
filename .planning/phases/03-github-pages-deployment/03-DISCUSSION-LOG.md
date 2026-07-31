# Phase 3: GitHub Pages Deployment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 3-github-pages-deployment
**Areas discussed:** Deployment mechanism, Deployed scope & URL mapping, Trigger & validation strategy, README API documentation, CI build inputs

---

## Deployment mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Official deploy-pages action | GitHub's standard: configure-pages/upload-pages-artifact/deploy-pages; requires Pages Source = "GitHub Actions" | ✓ |
| peaceiris/actions-gh-pages | Third-party, force-pushes to a gh-pages branch | |
| Branch/folder serving | Commit api/ and serve from branch — violates Phase 2 D-10 | |

**User's choice:** Official deploy-pages action
**Notes:** Chose official Actions; no third-party dependency, no gh-pages branch, artifact-based.

| Option | Description | Selected |
|--------|-------------|----------|
| Build job + deploy job | Two-job structure; deploy needs build success | ✓ |
| Single combined job | Build then deploy in one job | |
| Split validate into own job | Separate validate job/workflow | |

**User's choice:** Build job + deploy job
**Notes:** Deploy only after build succeeds — standard two-job pattern.

## Deployed scope & URL mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Stage only api/ in a site dir | _site/ staging dir, ~3.5MB published site, no scripts/DB exposed | ✓ |
| Upload whole repo root | Publishes scripts, README, 62MB quran.db.gz | |
| Upload api/ contents directly | Would break the /api/ URL prefix | |

**User's choice:** Stage only api/ in a site dir
**Notes:** Published site stays minimal; only api/ exposed.

| Option | Description | Selected |
|--------|-------------|----------|
| No root page yet | Root 404s until Phase 4 adds index.html | ✓ |
| Minimal placeholder index.html | Root won't 404 but crosses into Phase 4 territory | |
| Redirect root to docs | Redirect file without a UI | |

**User's choice:** No root page yet
**Notes:** Strictly scoped to deployment; Phase 4 owns the root page.

| Option | Description | Selected |
|--------|-------------|----------|
| _site/ | Conventional static-site name; Phase 4's index.html lands there | ✓ |
| public/ or site/ | Equally common | |
| Leave naming to you (OpenCode) | | |

**User's choice:** _site/
**Notes:** Matches Jekyll/static-site convention; anticipates Phase 4.

## Trigger & validation strategy

| Option | Description | Selected |
|--------|-------------|----------|
| push to main + workflow_dispatch | Deploys on push, manual escape hatch | ✓ |
| push to main only | No re-deploy without a commit | |
| push to main + tags | Adds tag-based deploys not needed now | |

**User's choice:** push to main + workflow_dispatch

| Option | Description | Selected |
|--------|-------------|----------|
| Validate gates deploy | deploy job needs build job; non-zero exit blocks deploy | ✓ |
| Validate but don't gate | Log only | |
| PR validation workflow too | Extra file, catches issues pre-merge | |

**User's choice:** Validate gates deploy
**Notes:** Honors Phase 2 D-18's CI-friendly exit-code contract.

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel in-progress runs | concurrency + cancel-in-progress on main | ✓ |
| Queue runs sequentially | Every run finishes in order | |

**User's choice:** Cancel in-progress runs
**Notes:** Avoids wasted builds and deploy queue pile-up.

## README API documentation

| Option | Description | Selected |
|--------|-------------|----------|
| Section in README | "API" section in existing README.md | ✓ |
| Separate docs/api.md | New file + link | |
| Both | README section + fuller docs file | |

**User's choice:** Section in README

| Option | Description | Selected |
|--------|-------------|----------|
| Actual URL | https://C-Fu.github.io/quran-database-malay/... | ✓ |
| Placeholders | <owner>.github.io/<repo> style | |
| Actual + fork note | Actual URL plus one-line fork note | |

**User's choice:** Actual URL
**Notes:** Copy-paste runnable examples; matches success criteria 2/3.

| Option | Description | Selected |
|--------|-------------|----------|
| 3 endpoints incl. jq search | surah fetch, Malay jq search, surahs.json list | ✓ |
| Just the 2 required | Only success-criteria examples | |
| Extended examples | Arabic search, counts, pipes | |

**User's choice:** 3 endpoints incl. jq search
**Notes:** Mirrors success criteria 2/3 exactly.

## CI build inputs

| Option | Description | Selected |
|--------|-------------|----------|
| gunzip committed quran.db.gz | Fast, deterministic, uses verified artifact | ✓ |
| Full rebuild pipeline | unzip dump → convert → add malay; heavy per deploy | |
| Commit api/ instead | Violates Phase 2 D-10 | |

**User's choice:** gunzip committed quran.db.gz
**Notes:** The workflow's DB source; `-k` keeps the decompressed file for debugging.

| Option | Description | Selected |
|--------|-------------|----------|
| setup-python pinned | actions/setup-python with stable version (3.12) | ✓ |
| Runner default python | Fewer steps, environment drift | |
| Pin 3.13.5 | Most deterministic, tight coupling | |

**User's choice:** setup-python pinned
**Notes:** Generator is stdlib-only, verified on 3.13.5.

## OpenCode's Discretion

- Workflow file name, job names, step-level details
- Pages artifact upload path/name, environment name
- README section placement and exact formatting
- Validate step shape (shell step expected)

## Deferred Ideas

None — discussion stayed within phase scope.
