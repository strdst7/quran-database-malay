---
phase: 04-search-ui
plan: 02
subsystem: deploy
tags: [ci, github-actions, deployment, verification, responsive-fix]
requires: [04-01]
provides: "Live QuestUI search page deployed on GitHub Pages (site root)"
affects: [.github/workflows/deploy-pages.yml, style.css]
tech-stack:
  added: []
  patterns: [one-line-workflow-edit, staging-simulation, local-http-smoke, post-deploy-cdn-polling, box-sizing-reset]
key-files:
  modified:
    - .github/workflows/deploy-pages.yml
    - style.css
decisions:
  - "D-21: Stage site step copies index.html + style.css + app.js alongside api/ into _site/ — one-line edit, no new workflow file"
  - "Post-QA fix: global box-sizing: border-box reset — .search/.container used width:100% + padding without border-box, causing the search input to clip on the right in mobile view"
metrics:
  duration: 45min (includes push checkpoint + live CDN poll + browser QA + fix cycle)
  completed_date: 2026-07-31
---

# Phase 4 Plan 2: Wire UI into GitHub Pages Deployment — Summary

**One-liner:** Extended the deploy workflow's "Stage site" step to publish the QuestUI search page alongside the static JSON API, verified the full stack locally and live, then fixed a mobile search-box clipping bug caught during browser QA.

## Completed Tasks

| task | Name                     | Status    | Commit   | Files                          |
|------|--------------------------|-----------|----------|--------------------------------|
| 1    | Extend Stage site step   | COMPLETED | `4f0e020` | `.github/workflows/deploy-pages.yml` |
| 2    | Local HTTP smoke test    | COMPLETED | n/a (verification only) | — |
| 3    | Push + live verify + browser QA | COMPLETED | `72e2eb6` (fix) | `style.css` (box-sizing reset) |

## Task Details

### Task 1: Workflow edit (D-21)

Changed `.github/workflows/deploy-pages.yml` "Stage site" step from:
```yaml
run: mkdir -p _site && cp -r api _site/
```
to:
```yaml
run: mkdir -p _site && cp -r api _site/ && cp index.html style.css app.js _site/
```

**Verification:** grep gates pass (`cp index.html style.css app.js _site/` = 1, `Stage site` = 1); git diff = exactly one changed line; staging simulation (`/tmp/opencode/stage-sim/_site/`) = 4 top-level entries (`api`, `index.html`, `style.css`, `app.js`) + 114 surah files, no `app.test.mjs`/`quran.db`/`README.md`; no `_site/` in repo root.

### Task 2: Local HTTP smoke

All checks passed over `python3 -m http.server`: root 200 + `lang="ms"`; `style.css` 200; `app.js` 200; `api/search.json` = 6,236; `api/surahs.json` = 114; `node --test app.test.mjs` 6/6. Independently re-verified by the orchestrator.

### Task 3: Push + live verification + browser QA

**Push:** The execution environment has no GitHub credentials (`could not read Username for 'https://github.com'`), so the push was performed by the user (`git push origin main`) — 9 commits shipped (Phase 3 completion docs + all of Phase 4). The Actions deploy ran successfully.

**Live verification (orchestrator):**
| Check | Result |
|-------|--------|
| root serves `<html lang="ms">` | ✓ 200 |
| references `app.js` + `style.css` | ✓ both |
| `style.css` HTTP 200 | ✓ |
| `app.js` HTTP 200 | ✓ |
| `api/search.json` parses to 6,236 verses | ✓ (3,213,062 bytes) |
| `rahmat` matches | ✓ 176 |

**Browser QA (human):** User confirmed QuestUI look, live search, RTL Arabic + LTR Malay cards. **One defect found:** the search box clipped on the right side in mobile view.

**Fix (commit `72e2eb6`):** Root cause — `.search` and `.container` used `width: 100%` + horizontal `padding` with default `content-box` (no global `box-sizing` reset), overflowing the viewport by 32px on mobile. Applied the canonical global reset:
```css
*, *::before, *::after { box-sizing: border-box; }
```
User re-pushed; orchestrator polled the live `style.css` (detected via `*::after` marker — `box-sizing: border-box` count went 1→2). User hard-refreshed and **approved** the fix.

## Deviations from Plan

1. **Push delegated to user (task 3):** The plan assumed the executor pushes. The environment lacks GitHub credentials, so the user pushed. Non-functional deviation — same net result.
2. **Post-QA CSS fix (`72e2eb6`):** Browser QA uncovered a mobile clipping bug not caught by the plan's automated gates (they checked CSS *content* via grep, not computed layout). Added a global `box-sizing: border-box` reset — the standard root-cause fix. This is a legitimate plan-scope fix (style.css is this phase's deliverable; UI-03 "QuestUI styling" includes correct responsive rendering).

## Self-Check: PASSED

- [x] `.github/workflows/deploy-pages.yml` modified with D-21 edit (commit `4f0e020`)
- [x] Staging simulation verified (4 entries + 114 surah files)
- [x] All 6 local HTTP smoke checks pass
- [x] Node test suite 6/6 green (still green after fix)
- [x] Pushed to main (by user); Actions deploy succeeded
- [x] Live URLs verified: root `lang=ms`, style.css/app.js 200, search.json 6,236
- [x] Browser QA: user approved (after box-sizing fix for mobile clipping)
- [x] Mobile clipping fix committed (`72e2eb6`) and re-verified live

## Issues Encountered

- **Search-box right-side clipping on mobile** — caught by human browser QA; fixed via global box-sizing reset. Documented above.
- **CDN cache 404:** immediately after the first push, the live root briefly 404'd (stale Phase 3 cache, `max-age=600`); it resolved on the first poll attempt. Expected per RESEARCH Pitfall 2.

## Next Phase Readiness

Phase 4 is the final phase. With it complete, the v1.0 milestone is delivered: the Quran Database Malay site is live at https://C-Fu.github.io/quran-database-malay/ with a working QuestUI-styled search over the full 6,236-verse Arabic + Basmeih Malay index.
