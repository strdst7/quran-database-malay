#!/usr/bin/env python3
"""
Add the Basmeih Malay translation (ms.basmeih) to quran.db.

Two modes:
  --fetch   Fetch whole-Quran Basmeih translation from alquran.cloud,
            validate, and write data/ms.basmeih.json (one-shot, offline
            artifact).
  --insert  Read the staged data/ms.basmeih.json and insert into quran.db.
            Idempotent — skips if ms.basmeih already present; --force
            deletes and re-inserts.

Python 3 stdlib only — no third-party dependencies.
"""

import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request

# -- Module constants --------------------------------------------------------

API_URL = 'https://api.alquran.cloud/v1/quran/ms.basmeih'
STAGED_FILE = 'data/ms.basmeih.json'
DB_FILE = 'quran.db'
EXPECTED_AYAHS = 6236
EDITION_IDENTIFIER = 'ms.basmeih'
EDITION_META = (
    'ms.basmeih', 'ms', 'Basmeih', 'Abdullah Muhammad Basmeih', 'text',
    'translation'
)
FETCH_TIMEOUT = 60
FETCH_RETRIES = 3
FETCH_RETRY_DELAY = 2


# -- Network helpers ---------------------------------------------------------

def fetch_basmeih():
    """Fetch the whole-Quran Basmeih translation from alquran.cloud."""
    last_error = None
    for attempt in range(1, FETCH_RETRIES + 1):
        try:
            req = urllib.request.Request(API_URL)
            with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
                raw = resp.read()
            payload = json.loads(raw)
            if payload.get('code') != 200 or payload.get('status') != 'OK':
                raise RuntimeError(
                    f"API returned code={payload.get('code')} "
                    f"status={payload.get('status')}"
                )
            return payload
        except (urllib.error.URLError, urllib.error.HTTPError,
                TimeoutError, RuntimeError, json.JSONDecodeError) as e:
            last_error = e
            if attempt < FETCH_RETRIES:
                print(f"  Attempt {attempt}/{FETCH_RETRIES} failed: {e} — "
                      f"retrying in {FETCH_RETRY_DELAY}s...")
                time.sleep(FETCH_RETRY_DELAY)
    raise RuntimeError(
        f"All {FETCH_RETRIES} fetch attempts failed. Last error: {last_error}"
    )


# -- Data extraction / validation --------------------------------------------

def extract_records(payload):
    """Flatten surahs array into a sorted list of {number, text} dicts."""
    surahs = payload['data']['surahs']
    records = []
    for surah in surahs:
        for ayah in surah['ayahs']:
            records.append({
                'number': ayah['number'],
                'text': ayah['text'],
            })
    records.sort(key=lambda r: r['number'])
    return records


def validate_records(records):
    """Raise ValueError if records don't meet the expected shape."""
    if len(records) != EXPECTED_AYAHS:
        raise ValueError(
            f"Expected {EXPECTED_AYAHS} records, got {len(records)}"
        )
    numbers = [r['number'] for r in records]
    expected_numbers = list(range(1, EXPECTED_AYAHS + 1))
    if numbers != expected_numbers:
        raise ValueError(
            f"Numbers are not the contiguous range 1..{EXPECTED_AYAHS}"
        )
    for r in records:
        if not isinstance(r.get('text'), str) or r['text'].strip() == '':
            raise ValueError(f"Ayah {r.get('number', '?')} has empty text")


def load_staged():
    """Load and validate the staged ms.basmeih.json file."""
    if not os.path.exists(STAGED_FILE):
        raise FileNotFoundError(
            f"{STAGED_FILE} not found. Run --fetch first to create it."
        )
    with open(STAGED_FILE, 'r', encoding='utf-8') as f:
        records = json.load(f)
    validate_records(records)
    return records


# -- Command implementations -------------------------------------------------

def cmd_fetch(args):
    """Fetch from API, validate, write staged file. Return exit code."""
    try:
        print(f"Fetching from {API_URL}...")
        payload = fetch_basmeih()
        records = extract_records(payload)
        validate_records(records)

        os.makedirs(os.path.dirname(STAGED_FILE) or '.', exist_ok=True)
        with open(STAGED_FILE, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
            f.write('\n')

        print(f"Wrote {len(records)} ayahs to {STAGED_FILE}")
        return 0
    except Exception as e:
        print(f"Fetch failed: {e}")
        return 1


def cmd_insert(args):
    """Insert staged translation into quran.db. Return exit code."""
    try:
        if not os.path.exists(DB_FILE):
            print("quran.db not found. Run convert_to_sqlite.py first.")
            return 1

        records = load_staged()

        db = sqlite3.connect(DB_FILE)
        db.execute("PRAGMA foreign_keys = ON")
        now = time.strftime('%Y-%m-%d %H:%M:%S')

        existing = db.execute(
            "SELECT id FROM editions WHERE identifier = ?",
            (EDITION_IDENTIFIER,)
        ).fetchone()

        if existing and not args.force:
            print(
                f"ms.basmeih already exists in editions — skipping "
                f"(use --force to re-run)"
            )
            db.close()
            return 0

        if existing and args.force:
            edition_id = existing[0]
            db.execute(
                "DELETE FROM ayah_edition WHERE edition_id = ?",
                (edition_id,)
            )
            db.execute(
                "DELETE FROM editions WHERE id = ?",
                (edition_id,)
            )
            print("Removed existing ms.basmeih rows (--force).")

        # Insert edition row
        db.execute(
            "INSERT INTO editions (identifier, language, name, "
            "english_name, format, type, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?)",
            EDITION_META + (now, now)
        )
        edition_id = db.execute(
            "SELECT last_insert_rowid()"
        ).fetchone()[0]

        # Build ayah_id map
        ayah_rows = db.execute(
            "SELECT id, number FROM ayahs"
        ).fetchall()
        ayah_map = {number: ayah_id for (ayah_id, number) in ayah_rows}

        if len(ayah_map) != EXPECTED_AYAHS:
            print(
                f"staged numbers do not match ayahs.number "
                f"(ayahs table has {len(ayah_map)} rows, expected "
                f"{EXPECTED_AYAHS})"
            )
            db.close()
            return 1

        for r in records:
            if r['number'] not in ayah_map:
                print(
                    f"staged numbers do not match ayahs.number "
                    f"(number {r['number']} not in ayahs table)"
                )
                db.close()
                return 1

        # Build and insert ayah_edition rows
        rows = [
            (ayah_map[r['number']], edition_id, r['text'], 0, now, now)
            for r in records
        ]
        db.executemany(
            "INSERT INTO ayah_edition "
            "(ayah_id, edition_id, data, is_audio, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?)",
            rows
        )
        db.commit()

        # Verification report
        print(f"\nMalay translation inserted: {EDITION_IDENTIFIER}")
        count = db.execute(
            "SELECT COUNT(*) FROM ayah_edition "
            "WHERE edition_id = ?",
            (edition_id,)
        ).fetchone()[0]
        print(f"  ayah_edition: {count} rows")

        fk_errors = db.execute("PRAGMA foreign_key_check").fetchall()
        print(f"  foreign_key_check errors: {len(fk_errors)}")

        db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        db_size = os.path.getsize(DB_FILE) / (1024 * 1024)
        print(f"  Database size: {db_size:.1f} MB")
        print("Done!")

        db.close()
        return 0
    except (FileNotFoundError, ValueError, sqlite3.Error) as e:
        print(f"Insert failed: {e}")
        return 1
    except Exception as e:
        print(f"Insert failed: {e}")
        return 1


# -- CLI entry point ---------------------------------------------------------

def main():
    """Parse arguments and dispatch to the selected mode."""
    parser = argparse.ArgumentParser(
        description='Add Basmeih Malay translation to quran.db'
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        '--fetch', action='store_true',
        help='Fetch translation from alquran.cloud and stage to JSON'
    )
    group.add_argument(
        '--insert', action='store_true',
        help='Insert staged translation into quran.db'
    )
    parser.add_argument(
        '--force', action='store_true',
        help='With --insert: delete existing ms.basmeih rows and re-insert'
    )

    args = parser.parse_args()

    if args.fetch:
        return cmd_fetch(args)
    elif args.insert:
        return cmd_insert(args)
    else:
        parser.print_usage(sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
