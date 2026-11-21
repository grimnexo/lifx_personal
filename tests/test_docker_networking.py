"""Exercise switching the manager between Docker bridge and host networking."""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class DockerNetworkingTests(unittest.TestCase):
    def test_network_switch_preserves_running_state_and_database(self):
        stub = r'''#!/usr/bin/env bash
set -e
if [[ "$1" == info ]]; then exit 0; fi
[[ "$1" == compose ]] || exit 91
shift
if [[ "$1" == version ]]; then exit 0; fi
if [[ "$1" == -f ]]; then path="$2"; shift 2; fi
if [[ "$1" == -p ]]; then shift 2; fi
case "$1" in
  ps)
    [[ "$2" == --status && "$3" == running && "$4" == --services ]] || exit 92
    if [[ "${ACTIVE:-0}" == 1 ]]; then printf 'lifx\n'; fi
    ;;
  down) printf 'down:%s\n' "$path" >> "$CALLS" ;;
  up) printf 'up:%s\n' "$path" >> "$CALLS" ;;
  *) exit 93 ;;
esac
'''
        for active in ("0", "1"):
            with self.subTest(active=active), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                shutil.copy(ROOT / "manage.sh", root / "manage.sh")
                state = root / ".lifx"
                state.mkdir()
                (state / "mode").write_text("docker\n")
                (state / "port").write_text("9000\n")
                (root / "lifx.db").write_bytes(b"existing database unchanged")
                bindir = root / "bin"
                bindir.mkdir()
                binary = bindir / "docker"
                binary.write_text(stub)
                binary.chmod(0o755)
                calls = root / "calls.txt"
                env = os.environ.copy()
                env.update(PATH=str(bindir) + os.pathsep + env.get("PATH", ""),
                           ACTIVE=active, CALLS=str(calls))
                result = subprocess.run(["bash", str(root / "manage.sh"), "network"],
                                        input="host\n", capture_output=True, text=True, env=env)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual((state / "docker-network").read_text().strip(), "host")
                self.assertEqual((root / "lifx.db").read_bytes(), b"existing database unchanged")
                lines = calls.read_text().splitlines()
                self.assertEqual(lines[0], f"down:{root}/compose.yaml")
                if active == "1":
                    self.assertEqual(lines[1], f"up:{root}/compose.host.yaml")
                else:
                    self.assertEqual(len(lines), 1)
                    self.assertIn("remains stopped", result.stdout)

    def test_invalid_network_selection_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shutil.copy(ROOT / "manage.sh", root / "manage.sh")
            state = root / ".lifx"
            state.mkdir()
            (state / "mode").write_text("docker\n")
            binary_dir = root / "bin"
            binary_dir.mkdir()
            binary = binary_dir / "docker"
            binary.write_text("#!/usr/bin/env bash\nexit 0\n")
            binary.chmod(0o755)
            env = os.environ.copy()
            env["PATH"] = str(binary_dir) + os.pathsep + env.get("PATH", "")
            result = subprocess.run(["bash", str(root / "manage.sh"), "network"],
                                    input="invalid\n", capture_output=True, text=True, env=env)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Choose bridge or host", result.stderr)
            self.assertFalse((state / "docker-network").exists())


if __name__ == "__main__":
    unittest.main()
