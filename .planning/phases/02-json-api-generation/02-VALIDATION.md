---
phase: 2
slug: json-api-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (built-in `--validate` mode of `generate_json_api.py`; stdlib only, exit-code contract) |
| **Config file** | none — no pytest.ini/pyproject.toml; do NOT add one without discuss sign-off |
| **Quick run command** | `python3 generate_json_api.py --validate` (precondition: `api/` generated) |
| **Full suite command** | `python3 generate_json_api.py --generate && python3 generate_json_api.py --validate && jq -e 'length == 6236' api/search.json` |
| **Estimated runtime** | < 5 seconds (prototype: full generate+validate in 0.27s) |

---

## Sampling Rate

- **After every task commit:** Run `python3 generate_json_api.py --validate` (plan 02-02 checkpoint; plan 02-01 uses `--generate` + existence spot check)
- **After every plan wave:** Run full suite command above
- **Before `/gsd-verify-work`:** Full suite must be green

---

## Per-task Verification Map

| task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | API-01, API-02, API-03 | T-02-01 / — | 6,236-ayah invariant + non-empty text assert before any write | integration | `python3 generate_json_api.py --generate` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 1 | API-01 | T-02-01 / — | 114-file existence loop | integration | `python3 generate_json_api.py --validate` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 1 | API-02 | T-02-01 / — | exact 5-key shape + types + non-empty text | integration | `python3 generate_json_api.py --validate` | ✅ | ⬜ pending |
| 02-02-03 | 02 | 1 | API-03 | T-02-01 / — | search.json 6,236 count + id contiguity 1–6236 | integration | `python3 generate_json_api.py --validate` | ✅ | ⬜ pending |
| 02-02-04 | 02 | 1 | API-01, API-02, API-03 | T-02-01 / — | surahs.json 114-entry check | integration | `python3 generate_json_api.py --validate` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `generate_json_api.py --validate` — the entire test surface for this phase; **must** include: 114-file existence, JSON-shape loop, 6,236 total, search.json id contiguity, surahs.json 114-check
- [ ] No test framework — deliberate: matches repo convention. Optional pytest unit tests require user confirmation of a dev-only dep — otherwise omit; `--validate` covers the phase

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| jq consumer spot queries | API-01, API-02, API-03 | Consumer-facing behavior — the point of the phase | `jq -e 'length == 6236' api/search.json`; `jq '.[] | select(.malay | contains("<keyword>"))' api/search.json`; `jq '.[0]' api/surah/1.json` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
