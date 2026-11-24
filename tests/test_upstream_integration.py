import importlib
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

from lifx_db import Store, import_legacy_if_empty


class MigrationTests(unittest.TestCase):
    def test_split_import_preserves_original_and_existing_database(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config = root / '.config'
            config.mkdir()
            fixtures = {'config': {'ips': ['192.168.1.2'], 'transition': 2},
                        'devices': {'light_order': ['a'], 'groups': [{'id': 'g', 'presets': [{'id': 'p', 'hidden': True}]}]},
                        'routines': {'schedules': [{'id': 's', 'action': {'type': 'on'}, 'steps': [{'delay': 5, 'action': {'type': 'off'}}]}]}}
            for name, data in fixtures.items():
                (config / (name + '.json')).write_text(json.dumps(data))
            store = Store(str(root / 'lifx.db'))
            try:
                self.assertTrue(import_legacy_if_empty(store, root))
                self.assertEqual(store.get_data('settings', {})['light_order'], ['a'])
                self.assertEqual(store.get_data('groups', [])[0]['presets'][0]['hidden'], True)
                self.assertEqual(store.get_data('schedules', [])[0]['steps'][0]['delay'], 5)
                self.assertFalse(import_legacy_if_empty(store, root))
                self.assertEqual(json.loads((config / 'routines.json').read_text()), fixtures['routines'])
            finally:
                store.conn.close()

    def test_corrupt_split_does_not_import_partial_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.config').mkdir()
            (root / '.config' / 'config.json').write_text('{"transition": 1}')
            (root / '.config' / 'routines.json').write_text('invalid JSON')
            store = Store(str(root / 'lifx.db'))
            try:
                with self.assertRaises(ValueError):
                    import_legacy_if_empty(store, root)
                self.assertFalse(store.has_app_data())
            finally:
                store.conn.close()


class RoutineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        with patch.dict(os.environ, {'LIFX_DATA_DIR': cls.tmp.name}):
            cls.app = importlib.import_module('hl_lifx_control')

    @classmethod
    def tearDownClass(cls):
        cls.app.sock.close()
        cls.app.store.conn.close()
        sys.modules.pop('hl_lifx_control', None)
        cls.tmp.cleanup()

    def test_steps_wait_and_stop_cancels_remaining(self):
        started, finished = threading.Event(), threading.Event()
        def action(a):
            started.set()
            return 30, []
        schedule = {'id': 'test', 'action': {'type': 'on'}, 'steps': [{'delay': 0, 'action': {'type': 'off'}}]}
        original = self.app._routine_thread
        def wrapped(*args):
            try:
                original(*args)
            finally:
                finished.set()
        with patch.object(self.app, 'do_action', side_effect=action) as perform, patch.object(self.app, '_routine_thread', side_effect=wrapped):
            self.assertTrue(self.app.start_routine(schedule))
            self.assertTrue(started.wait(2))
            self.assertFalse(self.app.start_routine(schedule))
            self.assertEqual(self.app.running_view('test'), {'step': 1, 'of': 2})
            self.assertTrue(self.app.stop_routine('test'))
            self.assertTrue(finished.wait(2))
            self.assertEqual(perform.call_count, 1)
            self.assertIsNone(self.app.running_view('test'))

    def test_fade_is_passed_to_apply(self):
        with patch.object(self.app, 'apply') as apply:
            duration, _ = self.app.do_action({'type': 'on', 'target': 'all', 'fade': 4})
            self.assertEqual(duration, 4)
            self.assertEqual(apply.call_args.args[1], {'power': True, 'transition': 4})
