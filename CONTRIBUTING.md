# Contributing to Quran Database Malay

> 🇲🇾 *Kami amat mengalu-alukan sumbangan daripada sesiapa sahaja - terutamanya para hafiz, pakar bahasa Melayu, ilmuan Islam, dan ahli linguistik. Sila lihat bahagian "Kami memerlukan kepakaran anda" di bawah.*
>
> 🇬🇧 Contributions are welcome from everyone. Because this project sits at the intersection of **Quranic sciences, the Malay language, and software**, we especially invite subject-matter experts - see *We need your expertise* below.

This is a Malay-focused fork of [`AbdullahGhanem/quran-database`](https://github.com/AbdullahGhanem/quran-database). It publishes the **Basmeih Malay translation** (`ms.basmeih`, *Tafsir Pimpinan Ar-Rahman*) as a static JSON API on GitHub Pages, alongside a browser search page. Before contributing, please read the [README](README.md) for the architecture, data pipeline, and search algorithms.

---

## We need your expertise

This dataset and search engine touch several specialised fields. If any of the following describe you, your help would be invaluable.

### 📖 Ḥāfiẓ / Ḥāfiẓah (those who have memorised the Qur'an)

You can vouch for the integrity of the Arabic text and its structure. Concrete things we'd love checked:

- **Ayah boundaries & the 6,236 count** - the database follows the **Ḥafṣ `an `Āṣim** recitation (the most widely transmitted narration). If you follow a different qirā'a, please flag where counts or boundaries diverge.
- **Sajdah markers** - there are 15 marked prostration ayahs. Please confirm they fall on the correct verses.
- **Juz & Hizb divisions** - the `juzs` (30) and `hizbs` (60) tables carry start/end ayah ids. Spot-check that the divisions match your mushaf.
- **Basmala handling** - in the source data the basmala is sometimes merged into the first ayah of a surah (e.g. surah 2 / ayah 1 carries `بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ` as one string). We want to know whether and how this should be separated for your tradition.
- **Arabic text accuracy** - report any transcription/encoding error in the `arabic` field (a single wrong diacritic matters).

### 🇲🇾 Dewan Bahasa dan Pustaka (DBP) & Malay language experts

The headline feature is the **Basmeih** translation, and the project serves Malaysian users first. We'd value guidance from DBP and Malay language professionals on:

- **Translation review** - read sample surahs (e.g. `api/surah/2.json`) and flag phrasings that are archaic, unclear, or inconsistent with contemporary standard Malay.
- **Islamic terminology** - advise on standardised Malay spelling for Quranic terms (e.g. *Allah*, *rahmat*, *nabi*, *syurga* vs *surga*) so the search folding rules match what users actually type.
- **Malay folding rules** - the search engine normalises Malay via NFD + stripping combining marks + lowercasing (see `foldMs()` in `app.js`). Tell us if any Malay-specific normalisation is missing (e.g. old spelling *ch* vs *c*, *nj*, *sy*, *kh*).

### 🕌 Islamic scholars & academics (`ulamā`, ustaz, ustazah, university researchers)

- **Translation accuracy** - cross-check the Basmeih text against established *tafsir* (Ibn Kathīr, Al-Ṭabarī, Al-Sa'dī, etc.) and flag any rendering that could alter meaning.
- **Asbāb al-nuzul & cross-references** - the roadmap lists reasons-of-revelation and hadith references; help us source these accurately.
- **Sensitivity review** - the Qur'an is sacred scripture. Help us ensure the project presents it with appropriate structure, ordering, and labelling.

### 🔤 Linguists & Unicode/text experts (Arabic + Malay)

The search quality depends on folding algorithms you can help perfect. Review [`app.js`](app.js):

- **`foldAr()`** - normalises alef variants (`آ أ إ ٱ → ا`), tā' marbūṭah (`ة → ه`), alef maqṣūra (`ى → ي`), then strips diacritics in `[\u0640\u064B-\u0654\u0670\u06D6-\u06ED]`. Are there Quranic signs or letter forms this misses (superscript alef, hamza below, etc.)?
- **`foldMs()`** - `NFD` + strip `U+0300-036F` + lowercase. Correct for Malay? For other Latin-script editions?
- **RTL / bidi rendering** - the verse cards display Arabic `dir=rtl` above Malay `dir=ltr`. Report any reordering or shaping bugs.

### 💻 Developers

- **`app.js`** - the search engine is vanilla JS with zero dependencies. We welcome help on performance, accessibility (keyboard navigation, screen-reader announcements, the `#status` live region), and tests - the code review flagged a gap in DOM-render-path test coverage (see `.planning/phases/04-search-ui/04-REVIEW.md`).
- **Python pipeline** - `convert_to_sqlite.py`, `add_malay_translation.py`, `generate_json_api.py` are stdlib-only. Improvements to the streaming parser's memory/speed, or to the `--validate` strictness, are welcome.
- **CI / deployment** - the `.github/workflows/deploy-pages.yml` build chain.
- **Other editions** - help add and validate more translations (Indonesian, Urdu, English, etc.) following the existing `editions` / `ayah_edition` schema.

### ✍️ Native Malay speakers & proofreaders

- Review the **UI copy** in `index.html` (all in Bahasa Melayu) for clarity and naturalness.
- Try the [live search page](https://C-Fu.github.io/quran-database-malay/) and report any Malay text that reads oddly, or queries that should match but don't.

---

## How to contribute (the mechanics)

1. **Fork** the repository and create a feature branch: `git checkout -b feature/your-feature`.
2. **Set up locally** - follow the [regenerate instructions](README.md#regenerate-everything-locally) in the README:
   ```bash
   unzip data/quran.sql.zip
   python3 convert_to_sqlite.py
   python3 add_malay_translation.py
   python3 generate_json_api.py --generate
   python3 generate_json_api.py --validate   # must pass: 114/114 files, 6236 verses, 0 errors
   ```
3. **Run the tests** (for UI/search changes):
   ```bash
   node --test app.test.mjs
   ```
4. **Commit** with a clear message (we follow [Conventional Commits](https://www.conventionalcommits.org/)-ish prefixes: `feat:`, `fix:`, `docs:`, `test:`, `ci:`).
5. **Open a Pull Request** describing what changed and why. For translation-data changes, include the source/reference you relied on.

> You don't have to write code to contribute. **Opening an issue** with a verified correction (a wrong diacritic, a mis-spelled Malay word, a misaligned juz boundary) is just as valuable as a PR.

---

## What you can work on

| Area | Where | Example |
| --- | --- | --- |
| Arabic text accuracy | `ayahs.text` in `quran.db` | fix a mis-encoded diacritic |
| Malay translation quality | `ayah_edition.data` for `ms.basmeih` | modernise an archaic phrase |
| Search folding rules | `foldAr()` / `foldMs()` in `app.js` | handle a missing Arabic letter form |
| UI / accessibility | `index.html`, `style.css`, `app.js` | keyboard nav, screen-reader labels |
| Tests | `app.test.mjs` | add a render-path regression test |
| Data pipeline | `*.py` | stricter validation, more editions |
| Docs | `README.md`, `README.ms-MY.md` | clarify, correct, translate |

---

## Conventions

- **Python**: stdlib only (no third-party deps). Follow the existing style - 4-space indent, single-quoted strings, `snake_case`.
- **JavaScript**: vanilla, no framework, no build step, no `package.json`. Zero `innerHTML` (XSS gate, enforced by tests).
- **Data**: never alter the source `data/quran.sql.zip`; corrections go into the SQLite/JSON layer with a clear reference.
- **Translations**: always cite the scholarly source. Accuracy outranks style.
- **Commits**: small, atomic, with a descriptive message.

---

## A note on reverence

The Qur'an is sacred scripture for nearly two billion people. Please handle the text, its divisions, and its translations with care:

- Don't reorder or renumber ayahs/surahs on aesthetic grounds.
- Don't "auto-fix" Arabic spelling without reference to a verified mushaf.
- Flag rather than silently change anything that could alter meaning.

If you're unsure whether a change is appropriate, open an issue first - discussion is always welcome.

---

## Contact & discussion

- **Issues**: [github.com/C-Fu/quran-database-malay/issues](https://github.com/C-Fu/quran-database-malay/issues) - the best place for corrections, questions, and proposals.
- **Pull requests**: [github.com/C-Fu/quran-database-malay/pulls](https://github.com/C-Fu/quran-database-malay/pulls).

Thank you for helping make the Qur'an - and its Basmeih Malay translation - freely and accurately searchable.
