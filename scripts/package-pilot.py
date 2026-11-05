"""Create a reproducible pilot source archive without local state or design prototypes."""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
if subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=root):
    raise SystemExit('Commit tracked changes before packaging the pilot.')
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
source = subprocess.check_output(['git', 'archive', '--format=zip', 'HEAD'], cwd=root)
target = root / 'work' / 'offline-pilot-deployment' / f'cryopm-pilot-offline-{sha[:7]}.zip'
target.parent.mkdir(parents=True, exist_ok=True)
excluded = []
with zipfile.ZipFile(io.BytesIO(source)) as original, zipfile.ZipFile(target, 'w') as output:
    for item in original.infolist():
        name = item.filename
        if name.startswith('public/design-study/'):
            excluded.append(name)
            continue
        if name.startswith(('work/', '.next/', 'node_modules/', '.git/')) or ('..' in PurePosixPath(name).parts):
            raise SystemExit('Unexpected generated or unsafe path in tracked source archive.')
        if any(part.startswith('.env') and part != '.env.example' for part in PurePosixPath(name).parts):
            raise SystemExit('Environment file found in tracked source archive.')
        output.writestr(item, original.read(name))
with zipfile.ZipFile(target) as package:
    names = package.namelist()
    assert 'public/sw.js' in names and 'app/api/pm-sync/route.ts' in names
    assert 'drizzle/0006_offline_sync.sql' in names
    assert json.loads(package.read('package.json'))['scripts']['build'] == 'next build --webpack'
digest = hashlib.sha256(target.read_bytes()).hexdigest()
Path(str(target) + '.sha256').write_text(digest + '\n')
print(json.dumps({'commit': sha, 'archive': str(target), 'bytes': target.stat().st_size,
                  'files': len(names), 'sha256': digest, 'excluded_design_paths': len(excluded)}))
