"""Installer smoke tests; do not require Docker, npm, LIFX bulbs or a network."""
import hashlib
import os
import shutil
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lifx_db import Store
from scripts.bootstrap_user import password_hash


class InstallationTests(unittest.TestCase):
    def test_password_hash_matches_service_format(self):
        record = password_hash('a secure phrase with length')
        self.assertEqual(len(bytes.fromhex(record['salt'])), 16)
        self.assertEqual(len(bytes.fromhex(record['hash'])), 32)
        expected = hashlib.pbkdf2_hmac('sha256', b'a secure phrase with length',
                                      bytes.fromhex(record['salt']), 200_000)
        self.assertEqual(record['hash'], expected.hex())

    def test_existing_user_is_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / 'lifx.db'
            store = Store(str(db))
            record = password_hash('a long existing password')
            store.insert_user({'id': 'u1', 'username': 'existing', 'name': 'Existing',
                               'theme': 'auto', 'password': record, 'pin': None})
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/bootstrap_user.py'),
                                     '--db', str(db)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('preserved', result.stdout)
            self.assertEqual(Store(str(db)).user_by_name('existing')['password'], record)

    def test_legacy_config_is_imported_before_bootstrap(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            (path / 'config.json').write_text(json.dumps({'settings': {'broadcast': '10.0.0.255'}, 'groups': []}))
            db = path / 'lifx.db'
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/bootstrap_user.py'),
                                     '--db', str(db)], input='', capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(Store(str(db)).get_data('settings', {})['broadcast'], '10.0.0.255')
            self.assertTrue((path / 'config.json').exists())

    def test_first_user_needs_tty(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / 'lifx.db'
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/bootstrap_user.py'),
                                     '--db', str(db)], input='', capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('interactive terminal', result.stderr)
            self.assertEqual(Store(str(db)).user_count(), 0)

    def test_invalid_port_can_be_repaired_from_command_and_menu(self):
        for corrupt in ('', 'xyz', '0', '65536', '123456789012345678901234'):
            with self.subTest(corrupt=corrupt), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                shutil.copy(ROOT / 'manage.sh', root / 'manage.sh')
                state = root / '.lifx'
                state.mkdir()
                (state / 'port').write_text(corrupt)
                command = subprocess.run(['bash', str(root / 'manage.sh'), 'port'],
                                         input='9000\\n', capture_output=True, text=True)
                self.assertEqual(command.returncode, 0, command.stderr)
                self.assertEqual((state / 'port').read_text().strip(), '9000')

                (state / 'port').write_text(corrupt)
                menu = subprocess.run(['bash', str(root / 'manage.sh')],
                                      input='8\\n9001\\n0\\n', capture_output=True, text=True)
                self.assertEqual(menu.returncode, 0, menu.stderr)
                self.assertIn('invalid (choose option 8 to repair)', menu.stdout)
                self.assertEqual((state / 'port').read_text().strip(), '9001')

    def test_invalid_port_still_fails_for_operational_commands(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shutil.copy(ROOT / 'manage.sh', root / 'manage.sh')
            state = root / '.lifx'
            state.mkdir()
            (state / 'mode').write_text('native\\n')
            (state / 'port').write_text('not-a-port')
            result = subprocess.run(['bash', str(root / 'manage.sh'), 'status'],
                                    capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Invalid saved port', result.stderr)

    def test_docker_update_preserves_prior_running_state(self):
        # Stub external dependencies so this tests orchestration without Docker or Git.
        docker_stub = """#!/usr/bin/env bash
set -e
if [[ "$1" == info ]]; then exit 0; fi
[[ "$1" == compose ]] || exit 90
shift
if [[ "$1" == version ]]; then exit 0; fi
if [[ "$1" == -f ]]; then shift 2; fi
if [[ "$1" == -p ]]; then shift 2; fi
case "$1" in
  ps)
    [[ "$2" == --status && "$3" == running && "$4" == --services ]] || exit 91
    [[ "${DOCKER_ACTIVE:-0}" == 1 ]] && echo lifx
    ;;
  build) echo build >> "$DOCKER_CALLS" ;;
  up) echo up >> "$DOCKER_CALLS" ;;
  *) exit 92 ;;
esac
"""
        git_stub = """#!/usr/bin/env bash
set -e
[[ "$1" == -C ]] || exit 93
shift 2
case "$1" in
  status) exit 0 ;;
  pull) exit 0 ;;
  *) exit 94 ;;
esac
"""
        for active in ('0', '1'):
            with self.subTest(active=active), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                shutil.copy(ROOT / 'manage.sh', root / 'manage.sh')
                (root / '.git').mkdir()
                state = root / '.lifx'
                state.mkdir()
                (state / 'mode').write_text('docker\\n')
                bindir = root / 'bin'
                bindir.mkdir()
                for executable, code in (('docker', docker_stub), ('git', git_stub)):
                    file = bindir / executable
                    file.write_text(code)
                    file.chmod(0o755)
                calls = root / 'docker-calls.txt'
                env = os.environ.copy()
                env.update(PATH=str(bindir) + os.pathsep + env.get('PATH', ''),
                           DOCKER_ACTIVE=active, DOCKER_CALLS=str(calls))
                result = subprocess.run(['bash', str(root / 'manage.sh'), 'update'],
                                        capture_output=True, text=True, env=env)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(calls.read_text().strip(), 'up' if active == '1' else 'build')
                if active == '0':
                    self.assertIn('left stopped', result.stdout)

    def test_entrypoint_help(self):
        result = subprocess.run(['bash', str(ROOT / 'manage.sh'), '--help'],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('install [native|docker]', result.stdout)
        self.assertIn('backup', result.stdout)


if __name__ == '__main__':
    unittest.main()
