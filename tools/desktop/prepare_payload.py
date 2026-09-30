#!/usr/bin/env python3
"""Stage application code using an allowlist; never copy local user data."""
import argparse
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def stage(destination):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    for name in ("main.py", "VERSION", "LICENSE", "requirements.txt"):
        shutil.copy2(ROOT / name, destination / name)
    for name in ("static", "knowledge_base", "workflows", "CLI"):
        shutil.copytree(ROOT / name, destination / name, dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store", ".*"))
    # Source-side integration tools are required by some optional app actions.
    (destination / "tools").mkdir()
    for name in ("jimeng_cli_install.ps1", "jimeng_cli_login.ps1"):
        shutil.copy2(ROOT / "tools" / name, destination / "tools" / name)
    # Freeze static cache versions before signing. Runtime must not mutate the bundle.
    pattern = re.compile(r'(?P<url>/static/[^"\'`\s<>?#]+\.(?:js|css|html))\?v=[^"\'`\s<>)]*')
    version = (ROOT / "VERSION").read_text().strip()
    for page in (destination / "static").glob("*.html"):
        page.write_text(pattern.sub(lambda m: f'{m["url"]}?v={version}', page.read_text(encoding="utf-8")), encoding="utf-8")
    (destination / "data").mkdir(exist_ok=True)
    (destination / "assets").mkdir(exist_ok=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("destination")
    stage(parser.parse_args().destination)
