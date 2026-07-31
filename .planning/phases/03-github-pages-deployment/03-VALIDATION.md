---
phase: 3
slug: github-pages-deployment
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-31
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (repo convention: stdlib-only, zero test infra). Verification = grep structural gates on the workflow YAML + temp-dir CI build-job simulation + live-URL curl/jq checks against the deployed Pages site |
| **Config file** | none — no pytest.ini/pyproject.toml; PyYAML absent (verified) and adding deps violates the stdlib-only constraint |
| **Quick run command** | `grep -c 'uses: actions/deploy-pages@v5' .github/workflows/deploy-pages.yml` (workflow structural gate) |
| **Full suite command** | temp-dir CI simulation (gunzip → generate → validate → stage) + `curl -fsS https://C-Fu.github.io/quran-database-malay/api/surah/2.json | jq -e 'length == 286'` |
| **Estimated runtime** | < 60s automated (local sim: gunzip 62MB ~10s + generate 0.27s per Phase 2 prototype); live-URL checks ≤ 5 min polling for deploy propagation |

---

## Sampling Rate

- **After every task commit:** plan 03-01: workflow structural grep gates (pinned action versions, two-job shape, permissions, concurrency); plan 03-02: README endpoint grep gates
- **After every plan wave:** local CI simulation (03-01); live URL checks of all 3 endpoints (03-02)
- **Before `/gsd-verify-work`:** full suite green + user-verified Actions run (checkpoint) + live `curl` of all endpoints
- **Max feedback latency:** < 60s automated; ≤ 5 min for live-URL polling

---

## Per-task Verification Map

| task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | API-04 | T-03-01, T-03-02, T-03-04 | Workflow pins official actions, least-privilege perms (D-04), two-job gate (D-03), `_site/` staging (D-05/D-06) | structural grep | `grep -c 'uses: actions/deploy-pages@v5' .github/workflows/deploy-pages.yml` + `grep -c 'permissions:'` + `grep -c 'needs: build'` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | API-04 | T-03-02 | CI build steps produce a valid, complete `_site/` on a fresh checkout (D-09/D-14) | integration (temp-dir sim) | `/tmp/opencode/ci-sim` script: gunzip → generate → validate → stage → `test -f _site/api/search.json` + 114-file count | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | API-05 | — | README documents the 3 endpoints + jq filter with the exact live base URL (D-12) | doc grep | `grep -c 'https://C-Fu.github.io/quran-database-malay/api/' README.md` + `grep -c 'select(.malay | contains' README.md` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | API-05 | T-03-01 | Deployed URLs serve correct data (surah 2 = 286 verses; search = 6,236; surahs = 114) | live smoke | `curl -fsS https://C-Fu.github.io/quran-database-malay/api/surah/2.json | jq -e 'length == 286'` etc. | ✅ | ⬜ pending |
| 03-02-03 | 02 | 2 | API-05 | — | jq keyword filter works against deployed search index (checkpoint:human-verify) | manual (deployed-URL confirmation) | user confirms `curl .../api/search.json \| jq '.[] \| select(.malay \| contains("<keyword>"))'` returns matches | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Workflow structural verification — grep gates on pinned action versions, job shape, permissions, concurrency (plan 03-01 task 1 verify). PyYAML absent (verified); stdlib-only convention forbids adding it — structural grep + the real Actions run are the test surface.
- [x] Local CI simulation — temp-dir mirror of the runner's fresh-checkout steps (plan 03-01 task 2). Covers the D-09/D-14 command chain that grep cannot.
- [x] Live-URL verification — requires human D-02 Settings step + completed workflow run; sequenced in plan 03-02 with a checkpoint (plan 03-02 task 2/3).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pages source = "GitHub Actions" (D-02) | API-04 | Requires repo Settings access (Settings → Pages → Build and deployment → Source). `gh` CLI not installed (verified) — cannot be automated via API | Open https://github.com/C-Fu/quran-database-malay/settings/pages → "Build and deployment" → Source → select "GitHub Actions" → Save. Confirm the workflow run then deploys (Actions tab shows a `pages build and deployment` run). |
| Workflow run green + deploy job URL | API-04 | GitHub Actions tab is a web UI; no gh CLI to query run status | After push to main, open Actions tab → "Deploy static content to Pages" run → confirm build + deploy jobs both green and the deploy job shows the `page_url`. |
| jq keyword search returns real Malay matches | API-05 | Consumer-facing behavior — the point of the phase (mirrors Phase 2 manual verification) | `curl https://C-Fu.github.io/quran-database-malay/api/search.json | jq '.[] | select(.malay | contains("pembalasan"))'` — expect ≥1 verse with Malay text containing "pembalasan". |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s automated; ≤ 5 min live polling
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
