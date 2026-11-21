"""Installer smoke tests; do not require Docker, npm, LIFX bulbs or a network."""
import hashlib
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

    def test_entrypoint_help(self):
        result = subprocess.run(['bash', str(ROOT / 'manage.sh'), '--help'],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('install [native|docker]', result.stdout)
        self.assertIn('backup', result.stdout)


if __name__ == '__main__':
    unittest.main()
