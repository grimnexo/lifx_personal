"""Prevent Windows line endings from breaking Linux/WSL entrypoints."""
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class LineEndingTests(unittest.TestCase):
    def test_linux_scripts_and_configs_have_lf_newlines(self):
        files = set()
        for glob in ("*.sh", "*.bash", "*.zsh", "*.py", "*.yaml", "*.yml", "*.toml"):
            files.update(ROOT.rglob(glob))
        files.update((ROOT / "Dockerfile", ROOT / ".dockerignore",
                      ROOT / ".gitattributes", ROOT / ".editorconfig"))
        for path in sorted(files):
            if not path.is_file() or any(part in (".git", "node_modules", "__pycache__")
                                         for part in path.relative_to(ROOT).parts):
                continue
            with self.subTest(path=str(path.relative_to(ROOT))):
                self.assertNotIn(b"\r", path.read_bytes(),
                                 "Expected LF, found CR/CRLF line endings")

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
