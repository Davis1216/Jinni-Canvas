#!/usr/bin/env python3
"""Boot a packaged backend with isolated state and verify local endpoints."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import tempfile
import time
import urllib.request


def fingerprints(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in root.rglob("*") if p.is_file()}


def smoke(python, app, first_run=False):
    app = Path(app).resolve()
    before = fingerprints(app)
    with tempfile.TemporaryDirectory(prefix="jinni-smoke-") as temp:
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        env = {key: value for key, value in os.environ.items() if not key.startswith('JINNI_')}
        env.update(JINNI_DESKTOP_BUNDLE="1", JINNI_HOST="127.0.0.1",
                   JINNI_PORT=str(port), PYTHONDONTWRITEBYTECODE="1", PYTHONIOENCODING="utf-8")
        data_root = Path(temp) / "中文数据"
        if first_run:
            env.update(JINNI_DESKTOP_HOME=str(data_root),
                       JINNI_STORAGE_CONFIG=str(Path(temp) / "storage.json"))
        else:
            env.update(JINNI_DATA_DIR=str(Path(temp) / "data"),
                       JINNI_ASSETS_DIR=str(Path(temp) / "assets"),
                       JINNI_KB_DATA_DIR=str(Path(temp) / "knowledge"))
        # Match the desktop launcher's interpreter mode, including first launch.
        options = ["-X", "utf8"]
        with open(Path(temp) / "server.log", "w+", encoding="utf-8") as log:
            process = subprocess.Popen([str(Path(python).resolve()), *options, str(app / "main.py")],
                                       cwd=app, env=env, stdout=log, stderr=log)
            try:
                root = f"http://127.0.0.1:{port}"
                for _ in range(300):
                    if process.poll() is not None:
                        raise RuntimeError("Packaged backend exited early")
                    try:
                        with urllib.request.urlopen(root, timeout=1) as response:
                            assert response.status == 200
                            page = response.read().decode('utf-8')
                        break
                    except OSError:
                        time.sleep(0.2)
                else:
                    raise RuntimeError("Packaged backend startup timed out")
                if first_run:
                    assert "欢迎使用 Jinni Canvas" in page, "First launch must serve the setup page"
                    token = re.search(r"const token='([^']+)'", page).group(1)
                    request = urllib.request.Request(root + '/api/setup/initialize',
                        data=json.dumps({'root': str(data_root)}).encode('utf-8'),
                        headers={'Content-Type': 'application/json', 'Origin': root, 'X-Setup-Token': token})
                    with urllib.request.urlopen(request, timeout=5) as response:
                        assert json.load(response)['started']
                    for _ in range(300):
                        if process.poll() is not None:
                            raise RuntimeError("Backend exited after first-run setup")
                        try:
                            with urllib.request.urlopen(root + '/api/projects', timeout=1) as response:
                                assert 'projects' in json.load(response)
                            break
                        except OSError:
                            time.sleep(.2)
                    else:
                        raise RuntimeError("First-run setup did not hand off to the application")
                    config = json.loads((Path(temp) / 'storage.json').read_text(encoding='utf-8'))
                    assert Path(config['root']).resolve() == data_root.resolve()
                    print("First-run setup: UTF-8 page, Chinese data path, and backend handoff passed")
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
    parser.add_argument("--first-run", action="store_true")
    args = parser.parse_args()
    smoke(args.python, args.app, first_run=args.first_run)
