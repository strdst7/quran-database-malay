import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { foldAr, foldMs, search, surahLabel, MALAY_SURAH_NAMES, levAtMost, arabicHighlightRanges, latinSegments, state } = await import('./app.js');
const verses = JSON.parse(readFileSync('api/search.json', 'utf8'));

test('diacritic + alef folding (D-06)', () => {
  assert.equal(foldAr('بِسْمِ ٱللَّهِ'), 'بسم الله');
  assert.ok(search(['بسم'], verses).some((v) => v.id === 1));
});

test('Malay case-insensitive matching (D-07)', () => {
  assert.ok(search(['BERIMAN'], verses).length > 0);
});

test('AND across terms (D-09)', () => {
  assert.equal(search(['pemurah', 'langit'], verses).length, 3);
});

test('id order (D-10)', () => {
  const r = search(['pemurah'], verses);
  assert.ok(r.length > 0);
  assert.ok(r.every((v, i) => i === 0 || r[i - 1].id < v.id));
});

test('surahLabel format (D-15) incl. user correction', () => {
  assert.equal(
    surahLabel({ surah: 2, ayah: 255 }),
    'Al-Baqarah (Lembu Betina / The Cow) \u2022 2:255'
  );
  assert.equal(Object.keys(MALAY_SURAH_NAMES).length, 114);
});

// WR-02: surahLabel must resolve the English name by the surah's `number`
// field, not by positional array index. A reordered/sparse surahs array would
// return the wrong name under the old state.surahs[verse.surah - 1] access.
test('WR-02: surahLabel finds English name by number, not positional index', () => {
  const saved = state.surahs;
  state.surahs = [
    { number: 114, name_en_translation: 'Mankind' },
    { number: 1, name_en_translation: 'The Opening' },
  ];
  try {
    // Old positional code would read index 0 (number 114) → wrong name.
    assert.equal(
      surahLabel({ surah: 1, ayah: 1 }),
      'Al-Fatihah (Pembukaan / The Opening) \u2022 1:1'
    );
  } finally {
    state.surahs = saved;
  }
});

test('substring-within-word matching (D-11)', () => {
  const r = search(['rahmat'], verses);
  assert.ok(r.length >= 1);
});

// CR-01 regression: highlight helpers must emit verse text exactly once
// regardless of how many terms match (old code looped per-term and appended
// the full text each time → N terms = N copies). Tested via the pure
// range/segment helpers that the DOM appenders delegate to.

test('CR-01: latinSegments single-pass — no duplication for multi-term (D-09 query)', () => {
  const text = 'Tuhan Maha Pemurah di langit yang luas';
  const segs = latinSegments(text, ['pemurah', 'langit']);
  // The whole text appears exactly once.
  assert.strictEqual(segs.map((s) => s.text).join(''), text);
  // Both terms are highlighted exactly once each.
  const marks = segs.filter((s) => s.mark).map((s) => s.text).sort();
  assert.deepEqual(marks, ['Pemurah', 'langit']);
});

test('CR-01: arabicHighlightRanges single-pass — no duplication for multi-term', () => {
  const text = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
  const ranges = arabicHighlightRanges(text, ['الرحمن', 'الرحيم']);
  // Rebuild text by walking ranges + gaps; must equal the original exactly once.
  let rebuilt = '';
  let cursor = 0;
  for (const [s, e] of ranges) {
    assert.ok(s >= cursor, 'ranges must be sorted and non-overlapping');
    rebuilt += text.slice(cursor, s);
    rebuilt += text.slice(s, e);
    cursor = e;
  }
  rebuilt += text.slice(cursor);
  assert.strictEqual(rebuilt, text);
  // At least the two distinct terms produced two separate match spans.
  assert.ok(ranges.length >= 2, 'both terms should match');
});

test('CR-01: single-term path still highlights correctly (no regression)', () => {
  assert.strictEqual(
    latinSegments('pemurah di langit', ['pemurah']).map((s) => s.text).join(''),
    'pemurah di langit'
  );
  assert.notDeepEqual(arabicHighlightRanges('بِسْمِ ٱللَّهِ', ['بسم']), []);
});
