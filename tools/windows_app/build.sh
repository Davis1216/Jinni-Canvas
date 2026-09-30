#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAGE="$ROOT/build/windows_app"
rm -rf "$STAGE"
mkdir -p "$STAGE/python" "$ROOT/dist"
python3 "$ROOT/tools/desktop/prepare_payload.py" "$STAGE/app"
PYTHON_ZIP="$ROOT/build/python-3.12.10-embed-amd64.zip"
if [ ! -f "$PYTHON_ZIP" ]; then
    curl --fail --location --retry 3 https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip -o "$PYTHON_ZIP"
fi
python3 - "$PYTHON_ZIP" "$STAGE/python" <<'PY'
import sys, zipfile
from pathlib import Path
with zipfile.ZipFile(sys.argv[1]) as archive:
    archive.extractall(sys.argv[2])
Path(sys.argv[2], "python312._pth").write_text("python312.zip\n.\nLib/site-packages\nimport site\n")
PY
uv pip install --python-version 3.12 --python-platform x86_64-pc-windows-msvc --only-binary :all: --target "$STAGE/python/Lib/site-packages" -r "$ROOT/tools/desktop/requirements-windows.lock"
python3 - "$STAGE" "$ROOT/tools/windows_app/payload.zip" <<'PY'
import sys, zipfile
from pathlib import Path
root = Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(root.rglob("*")):
        if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
            archive.write(path, path.relative_to(root).as_posix())
PY
cd "$ROOT/tools/windows_app"
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-H windowsgui -s -w" -o "$ROOT/dist/Jinni Canvas-Windows-x64.exe" .
