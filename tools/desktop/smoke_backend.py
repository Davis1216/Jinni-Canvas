#!/usr/bin/env python3
"""Boot a packaged backend with isolated state and verify local endpoints."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.request


def fingerprints(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in root.rglob("*") if p.is_file()}


def smoke(python, app):
    app = Path(app).resolve()
    before = fingerprints(app)
    with tempfile.TemporaryDirectory(prefix="jinni-smoke-") as temp:
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        env = dict(os.environ, JINNI_DESKTOP_BUNDLE="1", JINNI_HOST="127.0.0.1",
                   JINNI_PORT=str(port), PYTHONDONTWRITEBYTECODE="1",
                   JINNI_DATA_DIR=str(Path(temp) / "data"),
                   JINNI_ASSETS_DIR=str(Path(temp) / "assets"),
                   JINNI_KB_DATA_DIR=str(Path(temp) / "knowledge"))
        with open(Path(temp) / "server.log", "w+") as log:
            process = subprocess.Popen([str(Path(python).resolve()), str(app / "main.py")],
                                       cwd=app, env=env, stdout=log, stderr=log)
            try:
                root = f"http://127.0.0.1:{port}"
                for _ in range(300):
                    if process.poll() is not None:
                        raise RuntimeError("Packaged backend exited early")
                    try:
                        with urllib.request.urlopen(root, timeout=1) as response:
                            assert response.status == 200
                        break
                    except OSError:
                        time.sleep(0.2)
                else:
                    raise RuntimeError("Packaged backend startup timed out")
                for path in ("/api/projects", "/api/canvases", "/api/inspiration-space"):
                    with urllib.request.urlopen(root + path, timeout=5) as response:
                        json.load(response)
                for path in ("/static/canvas.html", "/static/js/canvas.js", "/static/canvas-list.html"):
                    with urllib.request.urlopen(root + path, timeout=5) as response:
                        assert response.status == 200
                print("Packaged backend: startup, APIs, and static assets passed")
            except Exception:
                log.flush()
                log.seek(0)
                print(log.read())
                raise
            finally:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
        assert before == fingerprints(app), "Backend modified bundled application files"
        print("Packaged application files remained unchanged")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--python", required=True)
    parser.add_argument("--app", required=True)
    args = parser.parse_args()
    smoke(args.python, args.app)
