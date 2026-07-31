# Phase 2: JSON API Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 2-json-api-generation
**Areas discussed:** Per-surah JSON schema, search.json index shape, Output layout & naming, Verse enrichment level, Script interface & CLI, Built-in validation, DB prerequisites & pipeline order

---

## Per-surah JSON schema

| Option | Description | Selected |
|--------|-------------|----------|
| 5 fields (required only) | arabic, malay, surah, ayah, id | ✓ |
| Core fields + surah meta | Adds surah name/page/juz to each verse | |
| DB-verbatim column names | Mirrors text/data/number_in_surah | |

**User's choice:** 5 fields (required only)
**Notes:** Matches the curl example from API-05 (.malay) and stays minimal.

| Option | Description | Selected |
|--------|-------------|----------|
| Flat array of verses | Plain JSON array, one per ayah | ✓ |
| Object with surah header + ayahs | Wrapped object with surah metadata | |
| Object keyed by ayah number | Direct lookup by ayah number | |

**User's choice:** Flat array of verses

| Option | Description | Selected |
|--------|-------------|----------|
| arabic/malay/surah/ayah/id | Short, curl/jq friendly | ✓ |
| Verbose explicit names | arabic_text/malay_text/surah_number/... | |

**User's choice:** arabic/malay/surah/ayah/id

| Option | Description | Selected |
|--------|-------------|----------|
| Minified/compact | Smallest files | ✓ |
| Pretty-printed | Human-readable, ~2x size | |

**User's choice:** Minified/compact

| Option | Description | Selected |
|--------|-------------|----------|
| Fail hard on missing | Guard against incomplete data | ✓ |
| Skip/fill and continue | Write null/empty for gaps | |

**User's choice:** Fail hard on missing

---

## search.json index shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat array of all verses | 6,236 objects, jq-filterable | ✓ |
| Object keyed by id | Direct lookup, to_entries needed | |
| Nested per-surah groups | Redundant with surah files | |

**User's choice:** Flat array of all verses

| Option | Description | Selected |
|--------|-------------|----------|
| Same 5 fields | Uniform schema across API | ✓ |
| Drop id from index | Slimmer but diverges | |
| Add combined search field | Pre-joined text | |

**User's choice:** Same 5 fields

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from per-surah output | One generation path, no drift | ✓ |
| Separate generation path | Two code paths to sync | |

**User's choice:** Derive from per-surah output

| Option | Description | Selected |
|--------|-------------|----------|
| Global id order | 1-6236, Quran order | ✓ |
| Surah/ayah order | Same result, explicit keys | |

**User's choice:** Global id order

---

## Output layout & naming

| Option | Description | Selected |
|--------|-------------|----------|
| api/ directory | Deploys as-is to /api/surah/2.json | ✓ |
| surah/ + search.json at root | Needs mapping at deploy | |
| Committed artifact dir | Mirrors data/ convention | |

**User's choice:** api/ directory

| Option | Description | Selected |
|--------|-------------|----------|
| surah/<number>.json | Matches roadmap example | ✓ |
| Zero-padded names | Uniform width, diverges | |

**User's choice:** surah/<number>.json

| Option | Description | Selected |
|--------|-------------|----------|
| Wipe api/ then regenerate | Prevents stale files | ✓ |
| Overwrite in place | Faster, accumulates stale | |

**User's choice:** Wipe api/ then regenerate

| Option | Description | Selected |
|--------|-------------|----------|
| Generated at deploy, gitignored | Actions builds at deploy | ✓ |
| Commit api/ artifacts | Offline-consumable, bloats repo | |

**User's choice:** Generated at deploy, gitignored

---

## Verse enrichment level

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — 5 fields only | Smallest files | ✓ |
| Add surah name metadata | Richer but diverges | |

**User's choice:** Minimal — 5 fields only

| Option | Description | Selected |
|--------|-------------|----------|
| Leave metadata in DB only | Queryable via DB | |
| Add a surahs metadata file | Consumers get names without DB | ✓ |

**User's choice:** Add a surahs metadata file

| Option | Description | Selected |
|--------|-------------|----------|
| api/surahs.json flat array | One file, jq by number | ✓ |
| Per-surah meta files | More files, more curls | |
| Inline in each surah file | Diverges from flat array | |

**User's choice:** api/surahs.json flat array

| Option | Description | Selected |
|--------|-------------|----------|
| Full surahs table fields | number, names, type, ayah_count | ✓ |
| English-only subset | Smaller, loses Arabic/type | |

**User's choice:** Full surahs table fields

| Option | Description | Selected |
|--------|-------------|----------|
| Surah number order | 1-114 | ✓ |
| Unspecified order | Consumers sort | |

**User's choice:** Surah number order

---

## Script interface & CLI

| Option | Description | Selected |
|--------|-------------|----------|
| argparse subcommand | Mirrors add_malay_translation.py | ✓ |
| No args, hardcoded paths | Simplest, no overrides | |
| Configurable flags | Flexible, diverges from style | |

**User's choice:** argparse subcommand

| Option | Description | Selected |
|--------|-------------|----------|
| generate_json_api.py | Verb + object convention | ✓ |
| generate_api.py | Shorter, less specific | |
| export_json.py | Emphasizes export | |

**User's choice:** generate_json_api.py

| Option | Description | Selected |
|--------|-------------|----------|
| Single generate mode | One thing, no modes | |
| Generate + validate modes | Mirrors Phase 1 two-mode | ✓ |

**User's choice:** Generate + validate modes

---

## Built-in validation

| Option | Description | Selected |
|--------|-------------|----------|
| Validate generated files | Reads api/ back, checks shape/count | ✓ |
| Re-generate and compare | Stronger, duplicates work | |
| Validate DB inputs only | Checks DB, not output | |

**User's choice:** Validate generated files

| Option | Description | Selected |
|--------|-------------|----------|
| Assert 6,236 during generate | Generation guards input | ✓ |
| Validate-only, generate lenient | Validate is sole gate | |

**User's choice:** Assert 6,236 during generate

| Option | Description | Selected |
|--------|-------------|----------|
| Exit code + report | CI-friendly | ✓ |
| Raise on failure | No structured exit | |

**User's choice:** Exit code + report

---

## DB prerequisites & pipeline order

| Option | Description | Selected |
|--------|-------------|----------|
| Read existing quran.db | Standalone, no chaining | ✓ |
| Chain the whole pipeline | One command, coupled | |

**User's choice:** Read existing quran.db

| Option | Description | Selected |
|--------|-------------|----------|
| Check ms.basmeih present | Clear prerequisite error | ✓ |
| File-exists check only | Fail naturally | |

**User's choice:** Check ms.basmeih present

| Option | Description | Selected |
|--------|-------------|----------|
| Query DB directly | DB is source at gen time | ✓ |
| Cross-check staged file | Redundant | |

**User's choice:** Query DB directly

---

## OpenCode's Discretion

- Exact verification report formatting and message text in `--validate`
- Error message wording for prerequisite failures
- Whether `--validate` also checks `api/surahs.json` (recommended: yes)
- Exact function structure and internal helpers within `generate_json_api.py`

## Deferred Ideas

None — discussion stayed within phase scope.
