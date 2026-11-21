"""Regression checks for the persistence and scope of Docker HTTP publishing."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
DOCKER_STUB = """#!/usr/bin/env bash
set -e
if [[ "$1" == info ]]; then exit 0; fi
[[ "$1" == compose ]] || exit 90
shift
if [[ "$1" == version ]]; then exit 0; fi
[[ "$1" == -f ]] || exit 91
shift 2
[[ "$1" == -p ]] || exit 92
shift 2
case "$1" in
  ps) [[ "\${ACTIVE:-1}" == 1 ]] && echo lifx || : ;;
  stop|up|build) printf '%s:%s\\n' "$1" "$LIFX_BIND_ADDR" >> "$CALLS" ;;
  *) exit 93 ;;
esac
"""
GIT_STUB = """#!/usr/bin/env bash
set -e
[[ "$1" == -C ]] || exit 94
shift 2
case "$1" in status|pull) exit 0 ;; *) exit 95 ;; esac
"""


class DockerBindTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        shutil.copy(ROOT / "manage.sh", self.root / "manage.sh")
        state = self.root / ".lifx"
        state.mkdir()
        (state / "mode").write_text("docker\n")
        (state / "port").write_text("9000\n")
        (self.root / ".git").mkdir()
        bin_dir = self.root / "bin"
        bin_dir.mkdir()
        for name, code in (("docker", DOCKER_STUB), ("git", GIT_STUB)):
            path = bin_dir / name
            path.write_text(code)
            path.chmod(0o755)
        self.calls = self.root / "calls.txt"
        self.env = os.environ.copy()
        self.env.pop("LIFX_BIND_ADDR", None)
        self.env.update(PATH=str(bin_dir) + os.pathsep + self.env.get("PATH", ""),
                        CALLS=str(self.calls), ACTIVE="1")

    def run_manager(self, *args, input=None, env=None):
        return subprocess.run(["bash", str(self.root / "manage.sh"), *args],
                              input=input, capture_output=True, text=True,
                              env=self.env if env is None else env)

    def assert_success(self, result):
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_explicit_localhost_bind_persists_through_start_restart_and_update(self):
        env = self.env.copy()
        env["LIFX_BIND_ADDR"] = "127.0.0.1"
        self.assert_success(self.run_manager("start", env=env))
        self.assertEqual((self.root / ".lifx/docker-bind").read_text().strip(),
                         "127.0.0.1")
        self.assert_success(self.run_manager("restart"))
        self.assert_success(self.run_manager("update"))
        self.assertEqual(self.calls.read_text().splitlines(),
                         ["up:127.0.0.1", "stop:127.0.0.1",
                          "up:127.0.0.1", "up:127.0.0.1"])

    def test_explicit_all_interface_bind_persists_and_can_be_restricted(self):
        env = self.env.copy()
        env["LIFX_BIND_ADDR"] = "0.0.0.0"
        self.assert_success(self.run_manager("start", env=env))
        self.assert_success(self.run_manager("restart"))
        self.assert_success(self.run_manager("bind", input="127.0.0.1\n"))
        self.assert_success(self.run_manager("restart"))
        self.assertEqual((self.root / ".lifx/docker-bind").read_text().strip(),
                         "127.0.0.1")
        self.assertEqual(self.calls.read_text().splitlines()[-2:],
                         ["stop:127.0.0.1", "up:127.0.0.1"])

    def test_missing_state_defaults_to_loopback(self):
        self.assert_success(self.run_manager("start"))
        self.assertEqual(self.calls.read_text().strip(), "up:127.0.0.1")

    def test_invalid_saved_or_explicit_addresses_fail_closed(self):
        for bad in ("", "not-an-ip", "256.1.2.3", "127.0.0.1:9999",
                    "127.0.0.01", "127.0.0.1\n0.0.0.0"):
            with self.subTest(address=bad):
                (self.root / ".lifx/docker-bind").write_text(bad)
                result = self.run_manager("start")
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Invalid Docker HTTP bind address", result.stderr)
                env = self.env.copy()
                env["LIFX_BIND_ADDR"] = bad
                result = self.run_manager("start", env=env)
                self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.calls.exists(), "Invalid addresses must never start Docker")

    def test_bind_command_repairs_invalid_saved_value(self):
        (self.root / ".lifx/docker-bind").write_text("invalid")
        self.assert_success(self.run_manager("bind", input="127.0.0.1\n"))
        self.assert_success(self.run_manager("start"))
        self.assertEqual(self.calls.read_text().strip(), "up:127.0.0.1")


if __name__ == "__main__":
    unittest.main()
