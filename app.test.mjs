import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { foldAr, foldMs, search, surahLabel, MALAY_SURAH_NAMES, levAtMost } = await import('./app.js');
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

test('substring-within-word matching (D-11)', () => {
  const r = search(['rahmat'], verses);
  assert.ok(r.length >= 1);
});
