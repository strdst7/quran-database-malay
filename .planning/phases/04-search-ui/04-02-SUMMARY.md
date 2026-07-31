---
phase: 04-search-ui
plan: 02
subsystem: deploy
tags: [ci, github-actions, deployment, verification]
requires: [04-01]
provides: "Workflow wiring for QuestUI page deployment"
affects: [.github/workflows/deploy-pages.yml]
tech-stack:
  added: []
  patterns: [one-line-workflow-edit, staging-simulation, local-http-smoke]
key-files:
  modified:
    - .github/workflows/deploy-pages.yml
decisions:
  - "D-21: Stage site step copies index.html + style.css + app.js alongside api/ into _site/ — one-line edit, no new workflow file"
metrics:
  duration: partial
  completed_date: 2026-07-31
---

# Phase 4 Plan 2: Wire UI into GitHub Pages Deployment — Summary

**One-liner:** Extended the deploy workflow's "Stage site" step to publish the QuestUI search page alongside the static JSON API.

## Completed Tasks

| task | Name                     | Status    | Commit   | Files                          |
|------|--------------------------|-----------|----------|--------------------------------|
| 1    | Extend Stage site step   | COMPLETED | `4f0e020` | `.github/workflows/deploy-pages.yml` |
| 2    | Local HTTP smoke test    | COMPLETED | n/a (verification only) | — |
| 3    | Push to main + live poll | BLOCKED   | — | — |

## Task Details

### Task 1: Workflow edit (D-21)

Changed `.github/workflows/deploy-pages.yml` line 36 from:
```yaml
run: mkdir -p _site && cp -r api _site/
```
to:
```yaml
run: mkdir -p _site && cp -r api _site/ && cp index.html style.css app.js _site/
```

**Verification:**
- `grep -c 'cp index.html style.css app.js _site/'` = 1 ✓
- `grep -c 'Stage site'` = 1 ✓
- `git diff` shows exactly one changed line ✓
- `grep -c 'python3 generate_json_api.py --validate'` = 1 (untouched) ✓
- Staging simulation (`/tmp/opencode/stage-sim/_site/`): 4 top-level entries (`api`, `index.html`, `style.css`, `app.js`), 114 surah files, no `app.test.mjs`, `quran.db`, or `README.md` ✓
- No `_site/` directory in repo root ✓

### Task 2: Local HTTP smoke

All checks passed over `python3 -m http.server 8712`:

| Check | Result |
|-------|--------|
| Root URL HTTP 200 | ✅ |
| Root body contains `lang="ms"` | ✅ |
| `style.css` HTTP 200 | ✅ |
| `app.js` HTTP 200 | ✅ |
| `api/search.json` parses to 6,236 objects | ✅ |
| `api/surahs.json` parses to 114 objects | ✅ |
| `node --test app.test.mjs` 6/6 | ✅ |
| Server killed after test | ✅ |

### Task 3: Push — BLOCKED by authentication

**Error:** `fatal: could not read Username for 'https://github.com': No such device or address`

Seven commits are ahead of `origin/main` (all of Phase 4 wave 1 + this plan's workflow edit), ready to push. The execution environment lacks GitHub credentials. **The push must be performed by a human user** with access to `C-Fu/quran-database-malay`.

**What needs human action:**
```bash
git push origin main
```
Then wait for the GitHub Actions deploy to complete (~1–3 min), then verify:
```bash
curl -s https://C-Fu.github.io/quran-database-malay/ | grep -q '<html lang="ms">' && echo LIVE_OK
curl -s -o /dev/null -w '%{http_code}' https://C-Fu.github.io/quran-database-malay/style.css
curl -s https://C-Fu.github.io/quran-database-malay/api/search.json | python3 -c "import json,sys; assert len(json.load(sys.stdin))==6236; print('INDEX_LIVE_OK')"
```
(Allow up to ~15 min for CDN cache propagation — `max-age=600` per RESEARCH Pitfall 2.)

## Deviations from Plan

None — tasks 1 and 2 executed exactly as written.

### Auth Gates

**1. GitHub push authentication**
- **Task:** 3
- **Error:** No HTTPS credentials configured (`could not read Username for 'https://github.com'`)
- **Resolution:** Push requires human intervention with valid GitHub credentials

## Threat Flags

None — the one-line D-21 edit introduces no new security surface beyond what Phase 3's workflow already established (permissions unchanged, no new triggers, no new artifacts).

## Self-Check: PASSED

- [x] `.github/workflows/deploy-pages.yml` modified with D-21 edit (commit `4f0e020`)
- [x] Staging simulation verified at `/tmp/opencode/stage-sim/_site/`
- [x] All 6 local HTTP smoke checks pass
- [x] Node test suite 6/6 green
- [x] Server killed after verification
- [x] Push blocked by auth → documented as human action required
