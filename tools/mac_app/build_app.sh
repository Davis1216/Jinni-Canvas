#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MODE=development
MAKE_DMG=false
for arg in "$@"; do
    case "$arg" in
        --standalone) MODE=standalone ;;
        --dmg) MODE=standalone; MAKE_DMG=true ;;
        *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
done
PYTHON="$ROOT/.venv/bin/python"
BUILD="$ROOT/build/mac_app"
TARGET="$ROOT/Jinni Canvas.app"
if [ "$MODE" = standalone ]; then TARGET="$ROOT/dist/Jinni Canvas.app"; fi
mkdir -p "$BUILD" "$ROOT/dist"
if [ ! -f "$ROOT/assets/AppIcon.icns" ]; then "$PYTHON" "$ROOT/tools/mac_app/generate_icon.py"; fi
swiftc -O -target arm64-apple-macos11.3 "$ROOT/tools/mac_app/launcher.swift" -o "$BUILD/Jinni Canvas"
# Assemble a fresh owned staging bundle before replacing a previous build.
STAGE="$BUILD/Jinni Canvas.app"
rm -rf "$STAGE"
mkdir -p "$STAGE/Contents/MacOS" "$STAGE/Contents/Resources"
cp "$ROOT/tools/mac_app/Info.plist" "$STAGE/Contents/Info.plist"
cp "$BUILD/Jinni Canvas" "$STAGE/Contents/MacOS/"
cp "$ROOT/assets/AppIcon.icns" "$STAGE/Contents/Resources/"
if [ "$MODE" = standalone ]; then
    "$PYTHON" "$ROOT/tools/desktop/prepare_payload.py" "$STAGE/Contents/Resources/app"
    "$PYTHON" - "$STAGE/Contents/Resources/python" <<'PY'
import shutil, sys, sysconfig
from pathlib import Path
target = Path(sys.argv[1])
shutil.copytree(sys.base_prefix, target, symlinks=True,
    ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
version = f"python{sys.version_info.major}.{sys.version_info.minor}"
site = target / "lib" / version / "site-packages"
shutil.copytree(sysconfig.get_paths()["purelib"], site, dirs_exist_ok=True, symlinks=True,
    ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
for path in target.rglob("*"):
    if path.is_symlink() and not path.resolve().is_relative_to(target.resolve()):
        raise RuntimeError(f"Nonportable runtime symlink: {path}")
PY
    # Sign nested Python Mach-O files before the outer bundle.
    "$PYTHON" - "$STAGE/Contents/Resources/python" <<'PY'
import subprocess, sys
from pathlib import Path
for path in Path(sys.argv[1]).rglob("*"):
    if path.is_file() and not path.is_symlink():
        with path.open("rb") as file:
            magic = file.read(4)
        if magic in (b"\xcf\xfa\xed\xfe", b"\xca\xfe\xba\xbe", b"\xfe\xed\xfa\xcf"):
            subprocess.run(["codesign", "--force", "--sign", "-", str(path)], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
PY
fi
xattr -cr "$STAGE" 2>/dev/null || true
codesign --force --deep --sign - "$STAGE"
codesign --verify --deep --strict "$STAGE"
rm -rf "$TARGET"
ditto "$STAGE" "$TARGET"
if [ "$MODE" = standalone ]; then
    ditto -c -k --sequesterRsrc --keepParent "$TARGET" "$ROOT/dist/Jinni Canvas-macOS-arm64.zip"
fi
if [ "$MAKE_DMG" = true ]; then
    DMG_ROOT="$BUILD/dmg"
    rm -rf "$DMG_ROOT"
    mkdir -p "$DMG_ROOT"
    ditto "$TARGET" "$DMG_ROOT/Jinni Canvas.app"
    ln -s /Applications "$DMG_ROOT/Applications"
    hdiutil create -volname "Jinni Canvas" -srcfolder "$DMG_ROOT" -ov -format UDZO "$ROOT/dist/Jinni Canvas-macOS-arm64.dmg"
fi
echo "Built: $TARGET"
