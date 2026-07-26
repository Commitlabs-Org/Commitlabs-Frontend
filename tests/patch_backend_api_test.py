import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


class PatchBackendApiScriptTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory(prefix='patch-backend-api-', dir='/tmp')
        self.addCleanup(self.temp_dir.cleanup)
        self.repo_root = Path(self.temp_dir.name)
        (self.repo_root / 'scripts').mkdir(parents=True, exist_ok=True)
        (self.repo_root / 'src' / 'app' / 'api' / 'marketplace' / 'listings').mkdir(parents=True, exist_ok=True)

        shutil.copyfile(
            Path('/workspaces/Commitlabs-Frontend/scripts/patch_backend_api.py'),
            self.repo_root / 'scripts' / 'patch_backend_api.py',
        )

        target_path = self.repo_root / 'src' / 'app' / 'api' / 'marketplace' / 'listings' / 'route.ts'
        target_path.write_text('export const placeholder = true;\n', encoding='utf-8')

    def run_script(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(self.repo_root / 'scripts' / 'patch_backend_api.py'), *args],
            capture_output=True,
            text=True,
            cwd=self.repo_root,
            check=False,
        )

    def test_dry_run_does_not_overwrite_existing_files(self) -> None:
        result = self.run_script()

        target_path = self.repo_root / 'src' / 'app' / 'api' / 'marketplace' / 'listings' / 'route.ts'
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn('Dry run', result.stdout)
        self.assertEqual(target_path.read_text(encoding='utf-8'), 'export const placeholder = true;\n')

    def test_force_flag_writes_the_embedded_content(self) -> None:
        result = self.run_script('--force')

        target_path = self.repo_root / 'src' / 'app' / 'api' / 'marketplace' / 'listings' / 'route.ts'
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn('Updated', result.stdout)
        self.assertIn('export async function GET', target_path.read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
