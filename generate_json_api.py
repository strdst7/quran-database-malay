#!/usr/bin/env python3
"""Generate static JSON API from quran.db.

Modes:
  --generate   Read quran.db (read-only) and write api/
  --validate   Check generated api/ output structure

Python 3 stdlib only — no third-party dependencies.
"""

import argparse
import json
import os
import shutil
import sqlite3
import sys

DB_FILE = 'quran.db'
API_DIR = 'api'
EXPECTED_AYAHS = 6236
EDITION_IDENTIFIER = 'ms.basmeih'


def cmd_generate(args):
    """Read quran.db and write api/. Return exit code."""
    if not os.path.exists(DB_FILE):
        print('quran.db not found. Run convert_to_sqlite.py first.')
        return 1

    try:
        db = sqlite3.connect(f'file:{DB_FILE}?mode=ro', uri=True)

        row = db.execute(
            'SELECT COUNT(*) FROM ayah_edition ae '
            'JOIN editions e ON e.id = ae.edition_id '
            'WHERE e.identifier = ?',
            (EDITION_IDENTIFIER,)
        ).fetchone()
        if row[0] != EXPECTED_AYAHS:
            db.close()
            print(f'ms.basmeih has {row[0]} rows, expected {EXPECTED_AYAHS}. '
                  f'Run add_malay_translation.py --insert first.')
            return 1

        edition_id = db.execute(
            'SELECT id FROM editions WHERE identifier = ?',
            (EDITION_IDENTIFIER,)
        ).fetchone()[0]

        cur = db.execute('''
            SELECT a.id, a.surah_id, a.number_in_surah, a.text, ae.data
            FROM ayahs a
            JOIN ayah_edition ae ON ae.ayah_id = a.id AND ae.edition_id = ?
            ORDER BY a.id
        ''', (edition_id,))

        surah_verses = {}
        search_verses = []
        row_count = 0

        for (aid, surah_id, ayah_no, arabic, malay) in cur:
            row_count += 1
            if not arabic or not malay:
                raise ValueError(f'ayah {aid} missing text')

            verse = {'arabic': arabic, 'malay': malay,
                     'surah': surah_id, 'ayah': ayah_no, 'id': aid}

            if surah_id not in surah_verses:
                surah_verses[surah_id] = []
            surah_verses[surah_id].append(verse)
            search_verses.append(verse)

        if row_count != EXPECTED_AYAHS:
            raise ValueError(
                f'generated {row_count} ayahs, expected {EXPECTED_AYAHS}'
            )

        surahs = db.execute('''
            SELECT s.number, s.name_ar, s.name_en, s.name_en_translation,
                   s.type, COUNT(a.id) AS ayah_count
            FROM surahs s JOIN ayahs a ON a.surah_id = s.id
            GROUP BY s.id ORDER BY s.number
        ''').fetchall()

        surah_objs = [{'number': n, 'name_ar': ar, 'name_en': en,
                       'name_en_translation': tr, 'type': t, 'ayah_count': c}
                      for (n, ar, en, tr, t, c) in surahs]

        if len(surah_objs) != 114:
            raise ValueError(f'expected 114 surahs, got {len(surah_objs)}')

        db.close()

        shutil.rmtree(API_DIR, ignore_errors=True)
        os.makedirs(os.path.join(API_DIR, 'surah'))

        for n in range(1, 115):
            verses = surah_verses.get(n, [])
            with open(os.path.join(API_DIR, 'surah', f'{n}.json'),
                      'w', encoding='utf-8') as f:
                json.dump(verses, f, ensure_ascii=False)

        with open(os.path.join(API_DIR, 'search.json'),
                  'w', encoding='utf-8') as f:
            json.dump(search_verses, f, ensure_ascii=False)

        with open(os.path.join(API_DIR, 'surahs.json'),
                  'w', encoding='utf-8') as f:
            json.dump(surah_objs, f, ensure_ascii=False)

        print(f'API generated: {API_DIR}')
        print(f'  surah files: 114')
        print(f'  search.json: {len(search_verses)} verses')
        print(f'  surahs.json: {len(surah_objs)} surahs')
        print('Done!')

        return 0
    except Exception as e:
        print(f'Generate failed: {e}')
        return 1


def cmd_validate(args):
    """Check generated api/ output. Return exit code."""
    errors = []
    total = 0
    checked_count = 0

    for n in range(1, 115):
        path = os.path.join(API_DIR, 'surah', f'{n}.json')
        if not os.path.exists(path):
            errors.append(f'missing surah/{n}.json')
            continue
        verses = json.load(open(path, encoding='utf-8'))
        for v in verses:
            if sorted(v.keys()) != ['arabic', 'ayah', 'id', 'malay', 'surah']:
                errors.append(f'{n}.json: bad keys')
                break
            if not v['arabic'] or not v['malay']:
                errors.append(f'{n}.json: empty text')
                break
        total += len(verses)
        checked_count += 1

    if total != EXPECTED_AYAHS:
        errors.append(f'total {total} != {EXPECTED_AYAHS}')

    search_path = os.path.join(API_DIR, 'search.json')
    if not os.path.exists(search_path):
        errors.append('missing search.json')
    else:
        search_data = json.load(open(search_path, encoding='utf-8'))
        ids = [v['id'] for v in search_data]
        if ids != list(range(1, EXPECTED_AYAHS + 1)):
            errors.append('search.json not complete (ids not contiguous 1..6236)')
        for v in search_data:
            if sorted(v.keys()) != ['arabic', 'ayah', 'id', 'malay', 'surah']:
                errors.append('search.json: bad keys')
                break
            if not v['arabic'] or not v['malay']:
                errors.append('search.json: empty text')
                break

    surahs_path = os.path.join(API_DIR, 'surahs.json')
    if not os.path.exists(surahs_path):
        errors.append('missing surahs.json')
    else:
        surahs_data = json.load(open(surahs_path, encoding='utf-8'))
        if len(surahs_data) != 114:
            errors.append(f'surahs.json: {len(surahs_data)} != 114 entries')
        else:
            numbers = [s['number'] for s in surahs_data]
            if numbers != list(range(1, 115)):
                errors.append('surahs.json: numbers not 1..114 in order')
            for s in surahs_data:
                expected_keys = ['number', 'name_ar', 'name_en',
                                 'name_en_translation', 'type', 'ayah_count']
                if sorted(s.keys()) != expected_keys:
                    errors.append('surahs.json: bad keys')
                    break
                if not s['name_ar'] or not s['name_en']:
                    errors.append('surahs.json: empty name')
                    break

    print(f'\nValidating API output: {API_DIR}')
    print(f'  surah files checked: {checked_count}/114')
    print(f'  total verses: {total}')
    print(f'  errors: {len(errors)}')
    for e in errors:
        print(f'  - {e}')
    if not errors:
        print('Done!')
    return 0 if not errors else 1


def main():
    """Parse arguments and dispatch to the selected mode."""
    parser = argparse.ArgumentParser(
        description='Generate static JSON API from quran.db'
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        '--generate', action='store_true',
        help='Read quran.db and write api/'
    )
    group.add_argument(
        '--validate', action='store_true',
        help='Check generated api/ output'
    )

    args = parser.parse_args()

    if args.generate:
        return cmd_generate(args)
    elif args.validate:
        return cmd_validate(args)
    else:
        parser.print_usage(sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
