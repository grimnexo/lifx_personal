"""Prevent Windows line endings from breaking tracked Linux/WSL entrypoints."""
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SCRIPT_SUFFIXES = {".sh", ".bash", ".zsh", ".py", ".yaml", ".yml", ".toml"}
CONFIG_FILENAMES = {"Dockerfile", ".dockerignore", ".gitattributes", ".editorconfig"}


def tracked_linux_files(root: Path):
    """List relevant Git-tracked paths, not local environments or build outputs."""
    result = subprocess.run(
        ["git", "-C", str(root), "ls-files", "--cached", "-z"],
        check=True, capture_output=True,
    )
    for raw_path in result.stdout.split(b"\x00"):
        if not raw_path:
            continue
        path = root / os.fsdecode(raw_path)
        if path.suffix in SCRIPT_SUFFIXES or path.name in CONFIG_FILENAMES:
            yield path


class LineEndingTests(unittest.TestCase):
    def test_linux_scripts_and_configs_have_lf_newlines(self):
        if not (ROOT / ".git").exists() or not shutil.which("git"):
            self.skipTest("Git checkout unavailable")
        files = sorted(tracked_linux_files(ROOT))
        self.assertTrue(files, "No tracked Linux scripts/configurations found")
        for path in files:
            # A tracked path may be deleted locally but still exist in the index.
            if not path.is_file():
                continue
            with self.subTest(path=str(path.relative_to(ROOT))):
                self.assertNotIn(b"\r", path.read_bytes(),
                                 "Expected LF, found CR/CRLF line endings")

    def test_untracked_venv_files_are_ignored(self):
        if not shutil.which("git"):
            self.skipTest("Git unavailable")
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            (root / "tracked.py").write_bytes(b"print('ok')\n")
            venv = root / ".venv" / "lib"
            venv.mkdir(parents=True)
            (venv / "generated.py").write_bytes(b"print('generated')\r\n")
            subprocess.run(["git", "-C", str(root), "add", "--", "tracked.py"],
                           check=True)
            discovered = [path.relative_to(root) for path in tracked_linux_files(root)]
            self.assertEqual(discovered, [Path("tracked.py")])

    def test_git_enforces_lf_for_installer_and_docker_files(self):
        if not (ROOT / ".git").exists() or not shutil.which("git"):
            self.skipTest("Git checkout unavailable")
        for path in ("manage.sh", "scripts/bootstrap_user.py", "Dockerfile",
                     "compose.yaml", ".github/workflows/installer-ci.yml"):
            with self.subTest(path=path):
                result = subprocess.run(
                    ["git", "-C", str(ROOT), "check-attr", "eol", "--", path],
                    capture_output=True, text=True, check=True,
                )
                self.assertEqual(result.stdout.strip(), f"{path}: eol: lf")


if __name__ == "__main__":
    unittest.main()
