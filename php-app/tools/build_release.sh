#!/bin/sh
# Builds the zip you upload to cPanel:  sh php-app/tools/build_release.sh
# It checks the app build (lovable-v2 → public/app) is there, lints every PHP file, refuses to continue if anything is off,
# and writes php-app/dist/femini-cpanel-<date>.zip  (the folder inside the zip is "femini/").
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)

echo "== lint"
for f in $(find app public tools config -name '*.php'); do php -l "$f" >/dev/null || { echo "syntax error in $f"; exit 1; }; done
echo "ok"

echo "== the app build (lovable-v2: npm run build:cpanel)"
[ -f public/app/cpanel.html ] || { echo "missing public/app/cpanel.html: cd ../lovable-v2 && npm run build:cpanel"; exit 1; }
echo "ok"

echo "== package"
python3 - "$ROOT" <<'PY'
import sys, zipfile, hashlib, datetime, pathlib
root = pathlib.Path(sys.argv[1])
out = root / 'dist'
out.mkdir(exist_ok=True)
name = out / f"femini-cpanel-{datetime.date.today():%Y%m%d}.zip"
INCLUDE = ['app', 'public', 'sql', 'tools', 'config', 'storage']
SKIP_NAMES = {'config.php', 'build_release.sh', '.DS_Store'}
files = []
for top in INCLUDE:
    for p in sorted((root / top).rglob('*')):
        if p.is_dir() or p.name in SKIP_NAMES or '.tmp' in p.parts or 'files' in p.parts and top == 'storage':
            continue
        files.append(p)
with zipfile.ZipFile(name, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in files:
        z.write(p, 'femini/' + str(p.relative_to(root)))
    z.write(root / 'docs' / 'DEPLOY.md', 'femini/DEPLOY.md')
    z.write(root / 'docs' / 'SECURITY.md', 'femini/SECURITY.md')
    z.write(root / 'docs' / 'REVIEW.md', 'femini/REVIEW.md')
    z.write(root / 'README.md', 'femini/README.md')
digest = hashlib.sha256(name.read_bytes()).hexdigest()
print(f"{name.relative_to(root)}  {name.stat().st_size/1024:.0f} KB  {len(files)+3} files")
print('sha256', digest)
PY
