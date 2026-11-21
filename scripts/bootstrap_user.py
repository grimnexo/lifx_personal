#!/usr/bin/env python3
"""Create the first LIFX account or reset an existing password; never stores plaintext secrets."""
import argparse
import getpass
import hashlib
import json
from pathlib import Path
import re
import secrets
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from lifx_db import Store

ROUNDS = 200_000


def password_hash(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, ROUNDS)
    return {'salt': salt.hex(), 'hash': digest.hex()}


def get_password():
    if not sys.stdin.isatty():
        raise SystemExit('An interactive terminal is required to set a password.')
    while True:
        password = getpass.getpass('Password (12+ characters): ')
        if len(password) < 12:
            print('Use at least 12 characters.')
            continue
        if password != getpass.getpass('Confirm password: '):
            print('Passwords did not match.')
            continue
        return password


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', required=True, type=Path)
    parser.add_argument('--reset', action='store_true', help='Reset an existing user password')
    args = parser.parse_args()
    if not args.db.parent.is_dir():
        parser.error('Database directory does not exist')
    store = Store(str(args.db))
    if not store.has_app_data() and store.user_count() == 0:
        for legacy in (args.db.parent / 'config.json', args.db.parent / 'data.json'):
            if legacy.is_file():
                try:
                    with legacy.open(encoding='utf-8') as source:
                        data = json.load(source)
                    if not isinstance(data, dict):
                        raise ValueError('Expected a JSON object')
                except (OSError, ValueError) as exc:
                    raise SystemExit('Cannot import %s: %s' % (legacy, exc))
                store.import_legacy(data)
                print('Imported existing configuration from %s.' % legacy.name)
                break
    if args.reset:
        if not store.user_count():
            raise SystemExit('No users exist yet; use install to create one.')
        username = input('Existing username: ').strip()
        user = store.user_by_name(username)
        if not user:
            raise SystemExit('User not found.')
        user['password'] = password_hash(get_password())
        store.update_user(user)
        store.delete_other_sessions(user['id'], '')
        print('Password reset; existing sessions for this user were revoked.')
        return
    if store.user_count():
        print('Existing account(s) detected. Credentials and database preserved.')
        print('If an account still uses test/test, run ./manage.sh password to change it.')
        return
    if not sys.stdin.isatty():
        raise SystemExit('An interactive terminal is required to create the first account.')
    while True:
        username = input('Administrator username [admin]: ').strip() or 'admin'
        if re.fullmatch(r'[A-Za-z0-9_.-]{3,32}', username):
            break
        print('Username must be 3-32 letters, numbers, underscores, periods, or hyphens.')
    user = {'id': secrets.token_hex(6), 'username': username, 'name': username,
            'theme': 'auto', 'password': password_hash(get_password()), 'pin': None}
    store.insert_user(user)
    print('Administrator account created. No default test/test account was generated.')


if __name__ == '__main__':
    main()
