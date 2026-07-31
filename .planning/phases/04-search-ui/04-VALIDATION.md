---
phase: 4
slug: search-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` + `node:assert` (no install, no package.json — matches the repo's no-deps ethos); optional Playwright headless-Chromium DOM checks |
| **Config file** | none — `node --test` discovers `app.test.mjs` by convention |
| **Quick run command** | `node --test app.test.mjs` (reads the real `api/search.json` — runs in < 1s) |
| **Full suite command** | `node --test app.test.mjs` + browser smoke: `python3 -m http.server` → manual/Playwright check → post-deploy `curl` checks |
| **Estimated runtime** | ~1 second (unit) + manual browser session |

---

## Sampling Rate

- **After every task commit:** Run `node --test app.test.mjs` (once `app.js` guard + test file exist)
- **After every plan wave:** Run the same + structural greps on the workflow
- **Before `/gsd-verify-work`:** Full suite green + post-deploy curl checks pass
- **Max feedback latency:** ~1 second

---

## Per-task Verification Map

| task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | UI-01 | T-04-01 / — | DOM building with `textContent` only; no `innerHTML` | unit | `node --test app.test.mjs` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | UI-02 | T-04-01 | query terms regex-escaped; empty-folded-term guard | unit | `node --test app.test.mjs` — `بسم` matches 1:1, `BERIMAN` > 0, AND(`pemurah`,`langit`) == 3 | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | UI-03 | — | label test asserts `Al-Baqarah (Lembu Betina / The Cow) • 2:255` | unit | `node --test app.test.mjs` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | UI-01 | — | workflow stages 3 UI files into `_site/` | unit + deploy-check | `grep -q 'cp index.html style.css app.js' .github/workflows/deploy-pages.yml` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | UI-02 | — | local server smoke + post-deploy curl | manual + deploy | `python3 -m http.server` → search; post-deploy `curl -s .../ \| grep -q '<html lang="ms">'` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | UI-03 | — | DOM check: `.verse-arabic` has `dir=rtl` + non-empty, `.verse-malay` non-empty | unit/DOM + manual | Playwright optional; manual browser verification via `python3 -m http.server` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app.test.mjs` — node:test smoke tests (must be created before/with `app.js` in plan 04-01 task 1)
- [ ] `app.js` module-export guard (`if (typeof module !== 'undefined')`) — Wave 0 of 04-01, required by the test harness
- [ ] (Optional) Playwright DOM check script — only if 04-02 wants automated DOM assertions; manual browser verification via `python3 -m http.server` is the fallback

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QuestUI visual styling (palette, Cinzel/Spectral, card look) | UI-01, UI-03 | Subjective visual QA — colors and typography must be judged by eye | `python3 -m http.server`, open localhost, confirm gold #CA8A04 / deep red #991B1B / royal purple #581C87 / dark bg #1A0F0A, Cinzel headings, Spectral body |
| Live as-you-type responsiveness | UI-02 | Timing/feel judgment | Search `rahmat` and observe no perceptible lag; results update while typing |
| Post-deploy live behavior | UI-01, UI-02, UI-03 | Requires deployed site + CDN cache window (~12–15 min) | After deploy settles: `curl -s https://C-Fu.github.io/quran-database-malay/` and verify `<html lang="ms">`; open in browser and search |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 1s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
