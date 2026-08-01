# The Basmeih Translation - Background, Folding Rules & Accuracy

This document covers the **Basmeih Malay translation** (`ms.basmeih`, *Tafsir Pimpinan Ar-Rahman*): what it is, where it comes from, the Malay terminology it uses, and the **folding / search algorithms** this project applies to it. It also draws the important line between *translation* and *tafsir*.

> Companion docs: [API.md](API.md) (the JSON API) | [README.md](README.md) (project overview) | [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Table of contents

- [What the Basmeih translation is](#what-the-basmeih-translation-is)
- [When it was created](#when-it-was-created)
- [Malay terminology & standardisation](#malay-terminology--standardisation)
- [The data model - Arabic, Malay, English](#the-data-model--arabic-malay-english)
- [Folding rules (the normalisation algorithms)](#folding-rules-the-normalisation-algorithms)
- [All the matching rules](#all-the-matching-rules)
- [Algorithms in the search process](#algorithms-in-the-search-process)
- [Translation accuracy vs tafsir](#translation-accuracy-vs-tafsir)

---

## What the Basmeih translation is

The **Basmeih** translation is the Malay rendering of the Qur'an produced as ***Tafsir Pimpinan Ar-Rahman*** - literally *"the Exegesis of the Guidance of Ar-Rahman (The Most Merciful)"*. It is the de facto **official Malay Qur'an translation in Malaysia**, commissioned by the Malaysian government and used in mosques, schools, and official publications.

| Field | Value (as stored in this project's `editions` table) |
| --- | --- |
| identifier | `ms.basmeih` |
| language | `ms` (Malay) |
| name | `Basmeih` |
| english_name | `Abdullah Muhammad Basmeih` |
| type | `translation` |
| coverage | all **6,236** ayahs |

It is named after its lead scholar, **Dato' Haji Abdullah bin Muhammad Basmeih**, who led the translation/exegesis work under the auspices of **JAKIM** (*Jabatan Kemajuan Islam Malaysia* - the Department of Islamic Development Malaysia). In this project, the text is sourced from the public [alquran.cloud](https://alquran.cloud) API as edition `ms.basmeih`.

## When it was created

*Tafsir Pimpinan Ar-Rahman* was a multi-year, government-commissioned project; its volumes were produced and published in stages during the **late 20th century** (the work spanned the 1980s-1990s, with the complete set released across that period). It remains the standard reference Malay tafsir and has been reprinted many times.

> ⚠️ **Verify before citing.** Exact publication years and edition history should be confirmed against JAKIM and Dewan Bahasa dan Pustaka (DBP) records - this project documents the *software/dataset*, not the tafsir's publication history. If you can confirm or correct a date, please open an issue or PR (see [CONTRIBUTING.md](CONTRIBUTING.md) - we explicitly invite `ulamā` and DBP to help).

## Malay terminology & standardisation

The Basmeih text is written in **formal Bahasa Melayu** and uses **traditional Malay Islamic terminology**. The table below is computed from the actual 6,236 verses in this dataset (occurrence counts):

| Concept | Form used by Basmeih | Count | Modern / regional alternative (NOT used) |
| --- | --- | --- | --- |
| paradise | **syurga** | 188 | *surga* (Indonesian) - 0 |
| God | **Allah** | 2,288 | - |
| Lord/god (generic) | **Tuhan** | 663 | - |
| prophet | **nabi** | 606 | - |
| messenger | **rasul** | 297 | - |
| ritual prayer | **sembahyang** | 95 | *solat* (modern standard) / *shalat* (Indonesian) - 0 |
| supplication | **dua** + **doa** | 136 / 25 | both forms appear; *dua* more frequent |
| faith | **beriman** | 730 | - |

**Practical consequence for search:** because Basmeih uses *sembahyang* (not *solat*) and *syurga* (not *surga*), a user typing the modern/Indonesian form will get **zero matches**. The folding rules below handle diacritics and case, but they do **not** map between synonym spellings. This is the single most common "why didn't my search match?" cause. (Cross-dialect synonym mapping is a known gap - contributions welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).)

Standardisation of Malay Islamic terminology in Malaysia is overseen by **JAKIM** and the language body **Dewan Bahasa dan Pustaka (DBP)**. The Basmeih text predates some modern DBP standardisations, which is why older forms like *sembahyang* appear.

## The data model - Arabic, Malay, English

A common point of confusion is the role of the three scripts/languages in this project. There is **no machine translation** - the Arabic is the original scripture, the Malay is Basmeih's human translation, and English appears only as **metadata** (surah names). They sit in different fields:

```mermaid
flowchart LR
  classDef ar    fill:#2C1A10,stroke:#CA8A04,color:#F5E6D3
  classDef ms    fill:#991B1B,stroke:#CA8A04,color:#F5E6D3
  classDef en    fill:#581C87,stroke:#CA8A04,color:#F5E6D3
  classDef src   fill:#3D2618,stroke:#CA8A04,color:#F5E6D3

  S["["Arabic scripture<br/>original Quran text"]"]:::ar
  B["["Basmeih (human)<br/>Arabic -&gt; Malay, 20th c."]"):::src
  V["["verse object<br/>.arabic + .malay"]"]:::ms
  M["["surahs.json (metadata)<br/>.name_en + .name_en_translation"]"]:::en

  S --> B --> V
  M -.- V
```

Per verse (`/api/surah/{n}.json`, `/api/search.json`):
- **`arabic`** - the original Qur'an text (with full diacritics).
- **`malay`** - Basmeih's Malay translation.
- **`surah`, `ayah`, `id`** - numeric references.

Per surah (`/api/surahs.json`, metadata only):
- **`name_en`, `name_en_translation`** - English transliteration and meaning (e.g. *Al-Baqara / The Cow*). These are **not** a translation of the verse text; they help non-Arabic/non-Malay readers identify surahs.

So the "English-Arabic-Bahasa Melayu" triangle is: **Arabic** = source scripture, **Malay** = Basmeih translation of that scripture, **English** = surah-name metadata. The search algorithms operate on the Arabic and Malay fields (see below).

> 💡 The search engine **does not translate** between languages. It searches the existing Arabic text and the existing Basmeih Malay translation simultaneously, using folding rules so that diacritics, alef variants, and case don't block matches.

## Folding rules (the normalisation algorithms)

To make search forgiving, both Arabic and Malay are **folded** (normalised) before comparison. Folding is applied to the query *and* pre-computed for every verse once at page load (the "fold-once mirror"). The code lives in [`app.js`](app.js).

### Arabic folding - `foldAr()`

Three steps, modelled on Lucene's `ArabicNormalizer`:

```js
// 1. constants
const DIAC = /[\u0640\u064B-\u0654\u0670\u06D6-\u06ED]/g;          // tatweel + tashkeel + Quranic signs
const FOLD = { '\u0622':'\u0627','\u0623':'\u0627','\u0625':'\u0627','\u0671':'\u0627','\u0629':'\u0647','\u0649':'\u064A' };
const AR_FOLD_RE = /[\u0622\u0623\u0625\u0671\u0629\u0649]/g;

// 2. fold: variant letters -> base, then strip diacritics
const foldAr = (s) => s.replace(AR_FOLD_RE, (c) => FOLD[c]).replace(DIAC, '');
```

| Rule | Effect | Example |
| --- | --- | --- |
| Strip tatweel/tashkeel/Quranic signs | removes `ـ` (kashida), harakat (fatha/kasra/damma), shaddah, sukun, wasla, Quranic annotation signs | `بِسْمِ` -> `بسم` |
| Normalise alef variants -> ا | `آ أ إ ٱ` all become `ا` | `ٱللَّهِ` -> `الله` |
| Normalise tā' marbūṭah -> ه | `ة` becomes `ه` | `سورة` -> `سوره` |
| Normalise alef maqṣūra -> ي | `ى` becomes `ي` | `موسى` -> `موسي` |

**Result:** typing **الله** matches بِسْمِ ٱللَّهِ (diacritics + wasla alef ignored).

### Malay / Latin folding - `foldMs()`

```js
const foldMs = (s) => s.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
```

| Rule | Effect | Example |
| --- | --- | --- |
| NFD decomposition | splits accented letters into base + combining mark | `é` -> `e` + `´` |
| Strip combining marks (`U+0300-036F`) | removes the combining diacritics | `é` -> `e` |
| Lowercase | case-insensitive matching | `BERIMAN` -> `beriman` |

**Result:** typing **BERIMAN** matches "beriman". Pure Malay text rarely carries accents, but this also covers any Latin-script editions and loanword diacritics.

> **Known limitation:** `foldMs` does **not** handle Malay digraph normalisation (e.g. historical *ch* -> *c*, *nj*, *sy*, *kh*) or synonym mapping (*solat* <-> *sembahyang*). It normalises characters, not vocabulary - see [Malay terminology](#malay-terminology--standardisation).

## All the matching rules

Given a query, the search engine (`search(terms)` in `app.js`) applies these rules, in this order:

1. **Tokenise** - the query is split on whitespace into terms.
2. **Fold each term** - each term is folded with **both** `foldAr` and `foldMs` (so the same box handles Arabic and Malay/English).
3. **Drop empty folded terms** - a term that folds to nothing (e.g. a lone diacritic) is discarded, not matched-against-everything.
4. **AND across terms** - for multi-word queries, **every** term must match (somewhere in the combined Arabic+Malay fields). *Verified example:* `pemurah langit` -> **3** verses.
5. **OR within a term across fields** - a term matches if it appears in the folded Arabic **or** the folded Malay. One search box, both languages, no toggle.
6. **Substring-within-words** - matching is substring (`contains`), not whole-word and not prefix-only. `rahmat` matches within "pemurah" too.
7. **Global-id order** - results are returned in ascending `id` (1-6236), the natural Quranic order, never relevance-ranked.
8. **Capped display** - the UI shows the first 100 with a "Tunjukkan lagi" (show more) control; the API returns the full set, unranked.

## Algorithms in the search process

```mermaid
flowchart TB
  classDef load   fill:#2C1A10,stroke:#CA8A04,color:#F5E6D3
  classDef fold   fill:#581C87,stroke:#CA8A04,color:#F5E6D3
  classDef match  fill:#991B1B,stroke:#CA8A04,color:#F5E6D3
  classDef hl     fill:#3D2618,stroke:#CA8A04,color:#F5E6D3

  L("["loadIndex()<br/>fetch api/search.json"]"):::load
  M("["build mirror ONCE (~240ms)<br/>foldAr + foldMs per verse"]"):::fold
  Q("["user types<br/>250ms debounce"]"):::load
  F("["fold the query<br/>foldAr() + foldMs()"]"):::fold
  S("["search(terms)<br/>AND across terms, OR across fields<br/>substring, id order"]"):::match
  H("["highlight matches<br/>fold-aware regex on ORIGINAL text<br/>single pass, createElement"]"):::hl
  O("["verse cards<br/>Arabic RTL top, Malay LTR bottom"]"):::hl

  L --> M
  Q --> F --> S
  M -. "searched against" .-> S
  S --> H --> O
```

1. **Fold-once mirror.** The whole 6,236-verse index is folded **once** at page load (~240 ms, behind the loading indicator) into a parallel array of `{ar, ms}` folded strings. Each keystroke then scans the mirror, not the raw text - that is why search feels instant (~2.6 ms/keystroke).

2. **Fold-aware regex highlighting.** The **original**, fully-diacritised verse text is what gets *displayed*. To highlight matches on it, the engine builds a regex from the folded *query*: each base character is expanded into a character class (alef variants, ة/ه, ى/ي) joined by a diacritic-allowance class. The regex is run against the original text, so the highlight lands on the correct glyphs even though they carry tashkeel. Trailing diacritics after a match are absorbed into the highlighted span.

3. **Fuzzy "did you mean?" (banded Levenshtein).** When a search returns nothing, a **banded Levenshtein** distance (`levAtMost` in `app.js`) runs over a lazily-built word index bucketed by first character + length. Threshold is <=1 edit for short words, <=2 for longer ones. It suggests up to 5 *"Mungkin maksud anda:"* alternatives, so a one- or two-letter typo still finds the real word.

4. **XSS-safe rendering.** Every result card is built with `createElement` + `textContent` + `setAttribute` - **zero `innerHTML`** (`grep -c innerHTML app.js` returns 0). A crafted query can never inject HTML, because query text is never parsed as HTML.

## Translation accuracy vs tafsir

Two terms that matter for anyone assessing this dataset:

- A **translation** (*terjemahan*) renders the *meaning* of the Arabic into Malay, aiming to be faithful to the source.
- A **tafsir** (*tafsir*) is **exegesis** - it explains the meaning, often drawing on the sciences of the Qur'an (`asbāb al-nuzul`, grammar, jurisprudence, hadith, etc.) and may paraphrase or expand rather than translate word-for-word.

***Tafsir Pimpinan Ar-Rahman* is, despite the word *tafsir* in its title, widely used as a Malay translation** - it is relatively accessible and explanatory rather than a dense scholarly commentary. This is exactly why it is the standard choice for Malay readers and why this project surfaces it as the `malay` field. But because it leans explanatory:

- **Some verses read as interpretation/paraphrase, not literal translation.** This is a feature for readability, not a defect.
- **For legal/theological matters** (*aḥkām*, jurisprudence), readers should consult the source Arabic and qualified scholars, not rely on any single translation.
- **"Accuracy" is therefore layered:** linguistic fidelity to the Arabic, readability in Malay, and theological soundness are related but distinct concerns. This project treats Basmeih as a high-trust *reference* translation; it does not certify any reading as authoritative.

The folding/search algorithms are **agnostic to meaning** - they find strings. A match means the folded substring occurs in the folded text, nothing more. Whether a matched verse actually addresses the searcher's intent is a question for the reader (and their teacher), not the search engine.

If you are an `ālim`, ustaz/ustazah, academic, or DBP reviewer and spot a place where the Basmeih text as surfaced here diverges from a verified printed mushaf or a better rendering, please report it - see [CONTRIBUTING.md](CONTRIBUTING.md).
