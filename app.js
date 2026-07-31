/* ==========================================================================
   app.js — Quran Search Engine (client-side, vanilla JS)
   Phase 4: Search UI (04-01)
   Implements D-01..D-26 per CONTEXT.md. Safe DOM only (no raw HTML). No dependencies.
   ========================================================================== */

// ── Arabic fold constants (Pattern 1 — Lucene ArabicNormalizer + wasla + Quranic signs) ──
var DIAC = /[\u0640\u064B-\u0654\u0670\u06D6-\u06ED]/g;
var FOLD = {
  '\u0622': '\u0627',  // آ → ا (alef with madda)
  '\u0623': '\u0627',  // أ → ا (alef with hamza above)
  '\u0625': '\u0627',  // إ → ا (alef with hamza below)
  '\u0671': '\u0627',  // ٱ → ا (wasla — D-06 critical)
  '\u0629': '\u0647',  // ة → ه (taa marbuta → haa)
  '\u0649': '\u064A',   // ى → ي (alef maksura → yaa)
};
var AR_FOLD_RE = /[\u0622\u0623\u0625\u0671\u0629\u0649]/g;

// ── Fold functions ───────────────────────────────────────────────────────────
function foldAr(s) {
  return s.replace(AR_FOLD_RE, function (c) { return FOLD[c]; }).replace(DIAC, '');
}

function foldMs(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
}

// ── Regex helper (escape metacharacters) ─────────────────────────────────────
function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Fold-aware Arabic regex for highlighting (Pattern 2) ─────────────────────
function arRegex(term) {
  var folded = foldAr(term);
  if (!folded) return null;
  var classes = [];
  for (var i = 0; i < folded.length; i++) {
    var ch = folded[i];
    if (ch === '\u0627') { classes.push('[\\u0627\\u0622\\u0623\\u0625\\u0671]'); }
    else if (ch === '\u0647') { classes.push('[\\u0647\\u0629]'); }
    else if (ch === '\u064A') { classes.push('[\\u064A\\u0649]'); }
    else { classes.push(esc(ch)); }
  }
  return new RegExp(classes.join('[\\u0640\\u064B-\\u0654\\u0670\\u06D6-\\u06ED]*'), 'gu');
}

// ── Internal: search on pre-built mirror ─────────────────────────────────────
// Each mirror entry: { v: verse, ar: folded-arabic, ms: folded-malay }
function _search(terms, mirror) {
  var qs = terms.filter(Boolean).map(function (t) {
    return { ar: foldAr(t), ms: foldMs(t) };
  }).filter(function (t) { return t.ar || t.ms; });
  if (!qs.length) return [];

  var out = [];
  for (var i = 0; i < mirror.length; i++) {
    var m = mirror[i];
    var ok = true;
    for (var j = 0; j < qs.length; j++) {
      var q = qs[j];
      if (!((q.ar && m.ar.indexOf(q.ar) !== -1) || (q.ms && m.ms.indexOf(q.ms) !== -1))) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(m.v);
  }
  return out;
}

// ── Public search (for tests: builds mirror from verses array) ───────────────
function search(terms, verses) {
  var mirror = verses.map(function (v) {
    return { v: v, ar: foldAr(v.arabic), ms: foldMs(v.malay) };
  });
  return _search(terms, mirror);
}

// ── XSS-safe highlighting (Pattern 2 — createElement + textContent, no raw HTML) ──
// CR-01: highlight ALL terms in a SINGLE pass so the verse text is emitted
// exactly once regardless of how many terms match. The pure range/segment
// helpers below are exported for unit testing (no DOM required).
var AR_TRAIL_DIAC = /[\u0640\u064B-\u0654\u0670\u06D6-\u06ED]/;

// Pure: merged, non-overlapping highlight ranges for an Arabic string given an
// array of terms. Fold-aware (Pattern 2): each term is folded, then matched
// against the raw text with per-char alef/taa-marbuta/alef-maksura variant
// classes, inter-char diacritic allowance, and trailing-diacritic span
// extension (Pitfall 3). Returns [[start, end], ...].
function arabicHighlightRanges(text, terms) {
  var ranges = [];
  for (var t = 0; t < terms.length; t++) {
    var re = arRegex(terms[t]);
    if (!re) continue;
    var m;
    while ((m = re.exec(text)) !== null) {
      var end = m.index + m[0].length;
      // Extend over trailing diacritics (Pitfall 3)
      while (AR_TRAIL_DIAC.test(text[end] || '')) end++;
      ranges.push([m.index, end]);
      re.lastIndex = end;
    }
  }
  if (!ranges.length) return [];
  ranges.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  var merged = [ranges[0]];
  for (var i = 1; i < ranges.length; i++) {
    var last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) {
      if (ranges[i][1] > last[1]) last[1] = ranges[i][1];
    } else {
      merged.push(ranges[i]);
    }
  }
  return merged;
}

function appendHighlighted(container, text, terms) {
  var merged = arabicHighlightRanges(text, terms);
  if (!merged.length) {
    container.appendChild(document.createTextNode(text));
    return;
  }
  var cursor = 0;
  for (var i = 0; i < merged.length; i++) {
    if (merged[i][0] > cursor) {
      container.appendChild(document.createTextNode(text.slice(cursor, merged[i][0])));
    }
    var mark = document.createElement('mark');
    mark.appendChild(document.createTextNode(text.slice(merged[i][0], merged[i][1])));
    container.appendChild(mark);
    cursor = merged[i][1];
  }
  if (cursor < text.length) {
    container.appendChild(document.createTextNode(text.slice(cursor)));
  }
}

// Pure: split a Latin/Malay string into highlight segments given an array of
// terms. Case-insensitive, metacharacter-escaped alternation regex; a single
// split yields one traversal and no duplication. Returns [{ text, mark }, ...].
function latinSegments(text, terms) {
  var parts = [];
  for (var i = 0; i < terms.length; i++) {
    var safe = esc(terms[i]);
    if (safe) parts.push(safe);
  }
  if (!parts.length) return [{ text: text, mark: false }];
  var re = new RegExp('(' + parts.join('|') + ')', 'gi');
  var out = [];
  text.split(re).forEach(function (chunk, i) {
    if (!chunk) return;
    out.push({ text: chunk, mark: i % 2 === 1 });
  });
  return out;
}

// Latin/Malay highlighting: case-insensitive escaped alternation regex, single pass.
function appendLatinHighlighted(container, text, terms) {
  var segs = latinSegments(text, terms);
  for (var i = 0; i < segs.length; i++) {
    if (segs[i].mark) {
      var mark = document.createElement('mark');
      mark.appendChild(document.createTextNode(segs[i].text));
      container.appendChild(mark);
    } else {
      container.appendChild(document.createTextNode(segs[i].text));
    }
  }
}

// ── Malay surah-name map (D-15) — 114 entries with {name, tr, en} ───────────
// Source: Malay Wikipedia surah list. Surah 2 tr is USER-CORRECTED.
var MALAY_SURAH_NAMES = {
  1:   { name: 'Al-Fatihah',      tr: 'Pembukaan',                                  en: 'The Opening' },
  2:   { name: 'Al-Baqarah',      tr: 'Lembu Betina',                              en: 'The Cow' },
  3:   { name: "Ali 'Imran",      tr: 'Keluarga Imran',                            en: 'The Family of Imraan' },
  4:   { name: "An-Nisaa'",       tr: 'Wanita',                                     en: 'The Women' },
  5:   { name: "Al-Maa'idah",     tr: 'Hidangan',                                   en: 'The Table' },
  6:   { name: "Al-An'aam",       tr: 'Binatang Ternakan',                          en: 'The Cattle' },
  7:   { name: "Al-A'raaf",       tr: 'Tempat Tinggi',                              en: 'The Heights' },
  8:   { name: 'Al-Anfaal',       tr: 'Rampasan Perang',                            en: 'The Spoils of War' },
  9:   { name: 'At-Taubah',       tr: 'Taubat',                                     en: 'The Repentance' },
  10:  { name: 'Yunus',           tr: 'Nabi Yunus a.s.',                           en: 'Jonas' },
  11:  { name: 'Hud',             tr: 'Nabi Hud a.s.',                             en: 'Hud' },
  12:  { name: 'Yusuf',           tr: 'Nabi Yusuf a.s.',                           en: 'Joseph' },
  13:  { name: "Ar-Ra'd",         tr: 'Guruh',                                      en: 'The Thunder' },
  14:  { name: 'Ibrahim',         tr: 'Nabi Ibrahim a.s.',                         en: 'Abraham' },
  15:  { name: 'Al-Hijr',         tr: 'Kawasan Berbatu',                            en: 'The Rock' },
  16:  { name: 'An-Nahl',         tr: 'Lebah',                                      en: 'The Bee' },
  17:  { name: "Al-Israa'",       tr: 'Perjalanan Malam',                           en: 'The Night Journey' },
  18:  { name: 'Al-Kahfi',        tr: 'Gua',                                        en: 'The Cave' },
  19:  { name: 'Maryam',          tr: 'Siti Maryam',                               en: 'Mary' },
  20:  { name: 'Taahaa',          tr: '',                                           en: 'Taa-Haa' },
  21:  { name: "Al-Anbiyaa'",     tr: 'Para Nabi',                                  en: 'The Prophets' },
  22:  { name: 'Al-Hajj',         tr: 'Haji',                                       en: 'The Pilgrimage' },
  23:  { name: "Al-Mu'minun",     tr: 'Golongan yang Beriman',                     en: 'The Believers' },
  24:  { name: 'An-Nuur',         tr: 'Cahaya',                                     en: 'The Light' },
  25:  { name: 'Al-Furqaan',      tr: 'Pembeza Kebenaran dan Kebatilan',           en: 'The Criterion' },
  26:  { name: "Asy-Syu'araa",    tr: 'Para Penyair',                               en: 'The Poets' },
  27:  { name: 'An-Naml',         tr: 'Semut',                                      en: 'The Ant' },
  28:  { name: 'Al-Qasas',        tr: 'Cerita-cerita',                              en: 'The Stories' },
  29:  { name: "Al-'Ankabut",     tr: 'Labah-labah',                               en: 'The Spider' },
  30:  { name: 'Ar-Rum',          tr: 'Masyarakat Rom',                            en: 'The Romans' },
  31:  { name: 'Luqman',          tr: 'Luqman',                                     en: 'Luqman' },
  32:  { name: 'As-Sajdah',       tr: 'Sujud',                                      en: 'The Prostration' },
  33:  { name: 'Al-Ahzab',        tr: 'Golongan yang Bersekutu',                   en: 'The Clans' },
  34:  { name: "Saba'",           tr: "Kaum Saba'",                                en: 'Sheba' },
  35:  { name: 'Faatir',          tr: 'Pencipta',                                   en: 'The Originator' },
  36:  { name: 'Yaasin',          tr: '',                                           en: 'Yaseen' },
  37:  { name: 'As-Saaffat',      tr: 'Yang Berbaris Dengan Teratur',              en: 'Those drawn up in Ranks' },
  38:  { name: 'Saad',            tr: '',                                           en: 'The letter Saad' },
  39:  { name: 'Az-Zumar',        tr: 'Rombongan',                                  en: 'The Groups' },
  40:  { name: "Al-Mu'min",       tr: 'Orang yang Beriman',                        en: 'The Forgiver' },
  41:  { name: 'Fussilat',        tr: 'Dijelaskan',                                 en: 'Explained in detail' },
  42:  { name: 'Asy-Syuraa',      tr: 'Permesyuaratan',                             en: 'Consultation' },
  43:  { name: 'Az-Zukhruf',      tr: 'Perhiasan Emas',                            en: 'Ornaments of gold' },
  44:  { name: 'Ad-Dukhaan',      tr: 'Kabut/Asap',                                en: 'The Smoke' },
  45:  { name: 'Al-Jatsiyah',     tr: 'Yang Berlutut',                             en: 'Crouching' },
  46:  { name: 'Al-Ahqaaf',       tr: 'Bukit-bukit Pasir',                          en: 'The Dunes' },
  47:  { name: 'Muhammad',        tr: 'Nabi Muhammad s.a.w.',                      en: 'Muhammad' },
  48:  { name: 'Al-Fath',         tr: 'Kemenangan',                                 en: 'The Victory' },
  49:  { name: 'Al-Hujurat',      tr: 'Bilik-bilik',                                en: 'The Inner Apartments' },
  50:  { name: 'Qaf',             tr: '',                                           en: 'The letter Qaaf' },
  51:  { name: 'Adz-Dzariyaat',   tr: 'Angin yang Menerbangkan',                   en: 'The Winnowing Winds' },
  52:  { name: 'At-Tur',          tr: 'Gunung',                                     en: 'The Mount' },
  53:  { name: 'An-Najm',         tr: 'Bintang',                                    en: 'The Star' },
  54:  { name: 'Al-Qamar',        tr: 'Bulan',                                      en: 'The Moon' },
  55:  { name: 'Ar-Rahman',       tr: 'Yang Maha Pemurah',                         en: 'The Beneficent' },
  56:  { name: "Al-Waqi'ah",      tr: 'Peristiwa yang Tidak Dapat Dielakkan',      en: 'The Inevitable' },
  57:  { name: 'Al-Hadid',        tr: 'Besi',                                       en: 'The Iron' },
  58:  { name: 'Al-Mujadilah',    tr: 'Perempuan yang Merayu',                     en: 'The Pleading Woman' },
  59:  { name: 'Al-Hasyr',        tr: 'Pengusiran',                                 en: 'The Exile' },
  60:  { name: 'Al-Mumtahanah',   tr: 'Perempuan yang Diuji',                      en: 'She that is to be examined' },
  61:  { name: 'As-Saff',         tr: 'Barisan',                                    en: 'The Ranks' },
  62:  { name: "Al-Jumu'ah",      tr: 'Hari Jumaat',                               en: 'Friday' },
  63:  { name: 'Al-Munafiquun',   tr: 'Golongan Munafik',                          en: 'The Hypocrites' },
  64:  { name: 'At-Taghabun',     tr: 'Saling Untung dan Rugi',                    en: 'Mutual Disillusion' },
  65:  { name: 'At-Talaq',        tr: 'Cerai',                                      en: 'Divorce' },
  66:  { name: 'At-Tahrim',       tr: 'Mengharamkan',                               en: 'The Prohibition' },
  67:  { name: 'Al-Mulk',         tr: 'Kerajaan',                                   en: 'The Sovereignty' },
  68:  { name: 'Al-Qalam',        tr: 'Pen',                                        en: 'The Pen' },
  69:  { name: 'Al-Haaqqah',      tr: 'Keadaan Sebenar',                           en: 'The Reality' },
  70:  { name: "Al-Ma'arij",      tr: 'Tempat-tempat Naik',                        en: 'The Ascending Stairways' },
  71:  { name: 'Nuh',             tr: 'Nabi Nuh a.s.',                              en: 'Noah' },
  72:  { name: 'Al-Jin',          tr: 'Jin',                                        en: 'The Jinn' },
  73:  { name: 'Al-Muzammil',     tr: 'Yang Berselimut',                           en: 'The Enshrouded One' },
  74:  { name: 'Al-Muddathir',    tr: 'Yang Berselimut',                           en: 'The Cloaked One' },
  75:  { name: 'Al-Qiamah',       tr: 'Kebangkitan',                                en: 'The Resurrection' },
  76:  { name: 'Al-Insaan',       tr: 'Manusia',                                    en: 'Man' },
  77:  { name: 'Al-Mursalat',     tr: 'Yang Diutus',                                en: 'The Emissaries' },
  78:  { name: "An-Naba'",        tr: 'Berita Besar',                              en: 'The Announcement' },
  79:  { name: "An-Naazi'aat",    tr: 'Yang Mencabut',                             en: 'Those who drag forth' },
  80:  { name: "'Abasa",          tr: 'Dia Bermasam Muka',                         en: 'He frowned' },
  81:  { name: 'At-Takwiir',      tr: 'Menggulung',                                 en: 'The Overthrowing' },
  82:  { name: 'Al-Infitar',      tr: 'Pecah Belah',                                en: 'The Cleaving' },
  83:  { name: 'Al-Mutaffifiin',  tr: 'Golongan yang Curang',                      en: 'Defrauding' },
  84:  { name: 'Al-Insyiqaaq',    tr: 'Terbelah',                                   en: 'The Splitting Open' },
  85:  { name: 'Al-Buruj',        tr: 'Gugusan Bintang',                           en: 'The Constellations' },
  86:  { name: 'At-Taariq',       tr: 'Pengunjung Malam',                          en: 'The Morning Star' },
  87:  { name: "Al-A'laa",        tr: 'Yang Tertinggi',                             en: 'The Most High' },
  88:  { name: 'Al-Ghaasyiah',    tr: 'Peristiwa yang Menggelisahkan',             en: 'The Overwhelming' },
  89:  { name: 'Al-Fajr',         tr: 'Fajar/Sinar Mentari',                       en: 'The Dawn' },
  90:  { name: 'Al-Balad',        tr: 'Negeri',                                     en: 'The City' },
  91:  { name: 'Asy-Syams',       tr: 'Matahari',                                   en: 'The Sun' },
  92:  { name: 'Al-Lail',         tr: 'Malam',                                      en: 'The Night' },
  93:  { name: 'Adh-Dhuha',       tr: 'Pagi yang Cemerlang',                       en: 'The Morning Hours' },
  94:  { name: 'Al-Insyirah',     tr: 'Kelapangan',                                 en: 'The Consolation' },
  95:  { name: 'At-Tin',          tr: 'Buah Ara',                                   en: 'The Fig' },
  96:  { name: "Al-'Alaq",        tr: 'Gumpalan Darah',                            en: 'The Clot' },
  97:  { name: 'Al-Qadr',         tr: 'Kemuliaan',                                  en: 'The Power, Fate' },
  98:  { name: 'Al-Baiyinah',     tr: 'Bukti yang Nyata',                          en: 'The Evidence' },
  99:  { name: 'Al-Zalzalah',     tr: 'Kegoncangan',                                en: 'The Earthquake' },
  100: { name: "Al-'Aadiyaat",    tr: 'Yang Berlari Kencang',                      en: 'The Chargers' },
  101: { name: "Al-Qari'ah",      tr: 'Hari Yang Hingar Bingar',                   en: 'The Calamity' },
  102: { name: 'At-Takathur',     tr: 'Bermegah-megah',                             en: 'Competition' },
  103: { name: "Al-'Asr",         tr: 'Waktu',                                      en: 'The Declining Day, Epoch' },
  104: { name: 'Al-Humazah',      tr: 'Pengumpat',                                  en: 'The Traducer' },
  105: { name: 'Al-Fiil',         tr: 'Gajah',                                      en: 'The Elephant' },
  106: { name: 'Quraisy',         tr: 'Kaum Quraisy',                              en: 'Quraysh' },
  107: { name: "Al-Ma'un",        tr: 'Barangan Berguna',                          en: 'Almsgiving' },
  108: { name: 'Al-Kauthar',      tr: 'Melimpah-ruah',                             en: 'Abundance' },
  109: { name: 'Al-Kafirun',      tr: 'Golongan Kafir',                            en: 'The Disbelievers' },
  110: { name: 'An-Nasr',         tr: 'Pertolongan',                                en: 'Divine Support' },
  111: { name: 'Al-Lahab',        tr: 'Nyalaan Api',                               en: 'The Palm Fibre' },
  112: { name: 'Al-Ikhlas',       tr: 'Tulus Ikhlas',                              en: 'Sincerity' },
  113: { name: 'Al-Falaq',        tr: 'Subuh/Dinihari',                            en: 'The Dawn' },
  114: { name: 'An-Nas',          tr: 'Manusia',                                    en: 'Mankind' },
};

// ── Featured verses (D-17) ────────────────────────────────────────────────────
var FEATURED_IDS = [1, 2, 3, 4, 5, 6, 7, 262, 6222, 6223, 6224, 6225];

// ── Surah label (D-15) ────────────────────────────────────────────────────────
function surahLabel(verse) {
  var m = MALAY_SURAH_NAMES[verse.surah];
  var name = m ? m.name : 'Surah ' + verse.surah;
  // WR-02: resolve the English name by the explicit `number` field instead of
  // assuming surahs is a 1-indexed-by-position array (surah N at index N-1),
  // so a reordered/keyed/sparse api/surahs.json can't silently return the
  // wrong name. Falls back to the embedded MALAY_SURAH_NAMES English name.
  var en = '';
  if (state && state.surahs) {
    for (var i = 0; i < state.surahs.length; i++) {
      if (state.surahs[i].number === verse.surah) {
        en = state.surahs[i].name_en_translation;
        break;
      }
    }
  }
  if (!en && m && m.en) en = m.en;
  var tr = (m && m.tr) ? m.tr + ' / ' : '';
  return name + ' (' + tr + en + ') \u2022 ' + verse.surah + ':' + verse.ayah;
}

// ── Banded Levenshtein (Pattern 3) ────────────────────────────────────────────
function levAtMost(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  var m = a.length, n = b.length;
  var prev = new Array(n + 1), cur = new Array(n + 1);
  for (var j = 0; j <= n; j++) prev[j] = j;
  for (var i = 1; i <= m; i++) {
    cur[0] = i;
    var lo = Math.max(1, i - max), hi = Math.min(n, i + max);
    var rowMin = cur[0];
    for (var j = 1; j <= n; j++) {
      if (j < lo || j > hi) { cur[j] = max + 1; continue; }
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    var tmp = prev; prev = cur; cur = tmp;
  }
  return prev[n];
}

// ── Fuzzy suggestions (D-18) — lazy first-char-bucketed Levenshtein ───────────
function fuzzySuggest(terms) {
  if (!state.verses || !state.verses.length) return [];

  // Lazy-build word index on first no-results
  if (!state._wordIndex) {
    var idx = new Map();
    for (var vi = 0; vi < state.verses.length; vi++) {
      var v = state.verses[vi];
      var words = {};
      var arWords = foldAr(v.arabic).split(/\s+/);
      var msWords = foldMs(v.malay).split(/\s+/);
      for (var wi = 0; wi < arWords.length; wi++) {
        var w = arWords[wi];
        if (w) words[w] = true;
      }
      for (wi = 0; wi < msWords.length; wi++) {
        w = msWords[wi];
        if (w) words[w] = true;
      }
      for (w in words) {
        var fc = w[0];
        var len = w.length;
        if (!idx.has(fc)) idx.set(fc, new Map());
        var lenMap = idx.get(fc);
        if (!lenMap.has(len)) lenMap.set(len, []);
        // Avoid duplicate entries for same verse
        var bucket = lenMap.get(len);
        if (bucket.length === 0 || bucket[bucket.length - 1].verseIndex !== vi) {
          bucket.push({ word: w, verseIndex: vi });
        }
      }
    }
    state._wordIndex = idx;
  }

  var candidates = [];
  var scoredMap = new Map(); // verseIndex → bestDistance

  for (var ti = 0; ti < terms.length; ti++) {
    var q = terms[ti];
    var qAr = foldAr(q);
    var qMs = foldMs(q);
    var qLen = qAr.length;
    var threshold = qLen <= 4 ? 1 : 2;
    var fc = qAr[0];

    var fcMap = state._wordIndex.get(fc);
    if (!fcMap) continue;

    for (var len = qLen - threshold; len <= qLen + threshold; len++) {
      var bucket = fcMap.get(len);
      if (!bucket) continue;
      for (var bi = 0; bi < bucket.length; bi++) {
        var entry = bucket[bi];
        var dist = levAtMost(qAr, entry.word, threshold);
        if (dist <= threshold) {
          var existing = scoredMap.get(entry.verseIndex);
          if (existing === undefined || dist < existing) {
            scoredMap.set(entry.verseIndex, dist);
          }
        }
        // Also try ms version
        if (qMs !== qAr) {
          dist = levAtMost(qMs, entry.word, threshold);
          if (dist <= threshold) {
            existing = scoredMap.get(entry.verseIndex);
            if (existing === undefined || dist < existing) {
              scoredMap.set(entry.verseIndex, dist);
            }
          }
        }
      }
    }
  }

  // Rank by best distance, tie-break by verse id (ascending)
  var result = [];
  scoredMap.forEach(function (dist, vi) {
    result.push({ verseIndex: vi, distance: dist });
  });
  result.sort(function (a, b) {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return state.verses[a.verseIndex].id - state.verses[b.verseIndex].id;
  });

  return result.slice(0, 5).map(function (r) { return state.verses[r.verseIndex]; });
}

// ── App state ─────────────────────────────────────────────────────────────────
var state = {
  verses: null,
  mirror: null,
  surahs: null,
  ready: false,
  _wordIndex: null,
  _lastResults: null,
  _lastTerms: null,
  _shownCount: 100,
};

// ── DOM cache (populated by init) ─────────────────────────────────────────────
var els = {};

// ── Render a verse card (D-13/D-14/D-19) — XSS-safe, no raw HTML ──────────────
function renderCard(verse, terms) {
  var card = document.createElement('article');
  card.className = 'verse-card';

  var labelEl = document.createElement('div');
  labelEl.className = 'verse-label';
  labelEl.textContent = surahLabel(verse);

  var arabicEl = document.createElement('p');
  arabicEl.className = 'verse-arabic';
  arabicEl.setAttribute('dir', 'rtl');
  arabicEl.setAttribute('lang', 'ar');

  if (terms && terms.length) {
    appendHighlighted(arabicEl, verse.arabic, terms);
  } else {
    arabicEl.textContent = verse.arabic;
  }

  var malayEl = document.createElement('p');
  malayEl.className = 'verse-malay';
  malayEl.setAttribute('dir', 'ltr');
  malayEl.setAttribute('lang', 'ms');

  if (terms && terms.length) {
    appendLatinHighlighted(malayEl, verse.malay, terms);
  } else {
    malayEl.textContent = verse.malay;
  }

  card.appendChild(labelEl);
  card.appendChild(arabicEl);
  card.appendChild(malayEl);
  return card;
}

// ── Render featured verses (D-17) ─────────────────────────────────────────────
function renderFeatured() {
  if (!state.verses) return;
  var grid = els.featuredGrid;
  grid.textContent = ''; // clear
  for (var i = 0; i < FEATURED_IDS.length; i++) {
    var id = FEATURED_IDS[i];
    var verse = state.verses[id - 1];
    if (verse) {
      grid.appendChild(renderCard(verse, null));
    }
  }
}

// ── Show error state (D-03) ───────────────────────────────────────────────────
function showErrorState() {
  els.loading.hidden = true;
  els.featured.hidden = true;
  els.hero.classList.add('is-hidden');
  els.error.hidden = false;
  els.status.textContent = 'Gagal memuatkan indeks';
  els.searchInput.disabled = true;
}

// ── Show/hide sections based on state ─────────────────────────────────────────
function showPreSearchState() {
  els.hero.classList.remove('is-hidden');
  els.featured.hidden = false;
  els.loading.hidden = true;
  els.error.hidden = true;
  els.noResults.hidden = true;
  els.resultsMeta.hidden = true;
  els.results.textContent = '';
  els.showMore.hidden = true;
  els.status.textContent = '';
}

function showResultsState(count, total) {
  els.hero.classList.add('is-hidden');
  els.featured.hidden = true;
  els.loading.hidden = true;
  els.error.hidden = true;
  els.noResults.hidden = true;
  els.resultsMeta.hidden = false;

  if (total < 100) {
    els.resultsMeta.textContent = total + ' ayat ditemui';
    els.showMore.hidden = true;
  } else {
    els.resultsMeta.textContent = 'Menunjukkan 100 daripada ' + total + ' ayat';
    els.showMore.hidden = false;
    var remaining = total - 100;
    els.showMore.textContent = 'Tunjukkan lagi (' + remaining + ' lagi)';
  }

  els.status.textContent = total + ' ayat ditemui';
}

// WR-01: self-contained — hide every other section so the no-results card is
// correct regardless of the prior UI state, and surface the searched terms in
// the body message (previously unreachable because the only caller passed no
// terms).
function showNoResultsState(terms) {
  els.hero.classList.add('is-hidden');
  els.featured.hidden = true;
  els.loading.hidden = true;
  els.error.hidden = true;
  els.resultsMeta.hidden = true;
  els.results.textContent = '';
  els.showMore.hidden = true;
  els.noResults.hidden = false;

  if (terms && terms.length) {
    els.noResultsBody.textContent = 'Tiada ayat yang mengandungi "' + terms.join(' ') + '".';
  }

  els.status.textContent = 'Tiada padanan ditemui';
}

// ── Run search (called by debounced input) ────────────────────────────────────
function runSearch() {
  if (!state.ready) return;

  var raw = els.searchInput.value.trim();
  if (!raw) {
    showPreSearchState();
    return;
  }

  var terms = raw.split(/\s+/).filter(Boolean);
  if (!terms.length) {
    showPreSearchState();
    return;
  }

  var results = _search(terms, state.mirror);
  state._lastResults = results;
  state._lastTerms = terms;
  state._shownCount = 100;

  // Render up to 100
  els.results.textContent = '';
  var showCount = Math.min(100, results.length);
  for (var i = 0; i < showCount; i++) {
    els.results.appendChild(renderCard(results[i], terms));
  }

  // WR-01: route zero-results straight to showNoResultsState(terms) so the body
  // message naming the searched terms is actually populated.
  if (results.length === 0) {
    showNoResultsState(terms);
  } else {
    showResultsState(showCount, results.length);
  }

  // Fuzzy suggestions for no-results
  if (results.length === 0) {
    var suggestions = fuzzySuggest(terms);
    var sugGrid = els.suggestionsGrid;
    sugGrid.textContent = '';
    if (suggestions.length) {
      els.noResults.querySelector('.no-results-suggestions-label').hidden = false;
      for (var i = 0; i < suggestions.length; i++) {
        sugGrid.appendChild(renderCard(suggestions[i], terms));
      }
    } else {
      els.noResults.querySelector('.no-results-suggestions-label').hidden = true;
    }
  }
}

// ── Show more (D-16) ──────────────────────────────────────────────────────────
function showMore() {
  var results = state._lastResults;
  if (!results) return;

  var prevShown = state._shownCount;
  var nextShown = prevShown + 100;
  state._shownCount = Math.min(nextShown, results.length);

  for (var i = prevShown; i < state._shownCount; i++) {
    els.results.appendChild(renderCard(results[i], state._lastTerms));
  }

  if (state._shownCount >= results.length) {
    els.showMore.hidden = true;
    els.resultsMeta.textContent = results.length + ' ayat ditemui';
  } else {
    var remaining = results.length - state._shownCount;
    els.showMore.textContent = 'Tunjukkan lagi (' + remaining + ' lagi)';
    els.resultsMeta.textContent = 'Menunjukkan ' + state._shownCount + ' daripada ' + results.length + ' ayat';
  }
}

// ── Load index (D-01/D-02) ────────────────────────────────────────────────────
function loadIndex() {
  state.ready = false;
  showPreSearchState();
  els.loading.hidden = false;
  els.status.textContent = 'Memuatkan indeks\u2026';
  els.searchInput.disabled = true;

  return Promise.all([
    fetch('api/search.json'),
    fetch('api/surahs.json'),
  ]).then(function (responses) {
    if (!responses[0].ok || !responses[1].ok) throw new Error('HTTP ' + responses[0].status);
    return Promise.all([responses[0].json(), responses[1].json()]);
  }).then(function (data) {
    state.verses = data[0];
    state.surahs = data[1];
    state.mirror = state.verses.map(function (v) {
      return { v: v, ar: foldAr(v.arabic), ms: foldMs(v.malay) };
    });
    state.ready = true;
    state._wordIndex = null;

    // Transition: hide loading, show hero + featured
    els.loading.hidden = true;
    els.searchInput.disabled = false;
    els.status.textContent = '';
    showPreSearchState();
    renderFeatured();
  }).catch(function (err) {
    // WR-03: surface the failure reason (HTTP status / network) so operators
    // with DevTools open get a signal instead of a silently swallowed error.
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('loadIndex failed:', err && err.message);
    }
    showErrorState();
  });
}

// ── Init (DOM wiring, called when document is available) ──────────────────────
function init() {
  // Cache DOM refs
  els.hero = document.getElementById('hero');
  els.featured = document.getElementById('featured');
  els.featuredGrid = document.getElementById('featured-grid');
  els.loading = document.getElementById('loading');
  els.error = document.getElementById('error');
  els.retryButton = document.querySelector('.retry-button');
  els.noResults = document.getElementById('no-results');
  els.noResultsBody = document.querySelector('.no-results-body');
  els.suggestionsGrid = document.getElementById('suggestions-grid');
  els.resultsMeta = document.getElementById('results-meta');
  els.results = document.getElementById('results');
  els.showMore = document.getElementById('show-more');
  els.searchInput = document.getElementById('search-input');
  els.status = document.getElementById('status');

  // Wire events
  var timer;
  els.searchInput.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 250);
  });

  els.retryButton.addEventListener('click', function () {
    els.retryButton.disabled = true;
    els.error.hidden = true;
    els.loading.hidden = false;
    els.status.textContent = 'Memuatkan indeks\u2026';
    loadIndex().then(function () {
      els.retryButton.disabled = false;
    });
  });

  els.showMore.addEventListener('click', showMore);

  // Start loading
  loadIndex();
}

// ── Module guard (Pattern 4) ──────────────────────────────────────────────────
if (typeof document !== 'undefined') {
  init();
}

if (typeof module !== 'undefined') {
  module.exports = { foldAr: foldAr, foldMs: foldMs, search: search, arRegex: arRegex, surahLabel: surahLabel, MALAY_SURAH_NAMES: MALAY_SURAH_NAMES, levAtMost: levAtMost, arabicHighlightRanges: arabicHighlightRanges, latinSegments: latinSegments, state: state };
}
