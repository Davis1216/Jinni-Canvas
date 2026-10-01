"""Retired canvas UI/routes stay unavailable without destroying legacy files."""
import os
from pathlib import Path
import shutil
import subprocess
import sys


def test_classic_only_and_legacy_data_preserved(tmp_path):
    root = Path(__file__).resolve().parents[1]
    for name in ('main.py', 'jinni_storage.py', 'jinni_preferences.py'):
        shutil.copy2(root / name, tmp_path / name)
    shutil.copytree(root / 'knowledge_base', tmp_path / 'knowledge_base', ignore=shutil.ignore_patterns('__pycache__'))
    script = '''
import json
from pathlib import Path
from fastapi.testclient import TestClient
import main
client = TestClient(main.app)
response = client.post('/api/canvases', json={'title':'传统测试'})
assert response.status_code == 200, response.text
classic = response.json()['canvas']
assert classic['kind'] == 'classic'
assert client.post('/api/canvases', json={'title':'retired','kind':'smart'}).status_code == 400
legacy = {'id':'legacy-smart','kind':'smart','title':'保留数据','nodes':[{'id':'image','type':'image','url':'/assets/example.png'}]}
files = []
for deleted in (False, True):
    record = {**legacy, 'id':legacy['id']+('-trash' if deleted else '')}
    if deleted: record['deleted_at'] = 1
    path = Path(main.CANVAS_DIR, record['id']+'.json')
    data = json.dumps(record).encode()
    path.write_bytes(data)
    files.append((path,data))
assert [c['id'] for c in client.get('/api/canvases').json()['canvases']] == [classic['id']]
assert client.get('/api/canvases/trash').json()['canvases'] == []
assets = client.get('/api/canvas-assets').json()
assert all(c['id'] == classic['id'] for c in assets['canvases'])
assert all(c['id'] != 'smart' for c in assets['categories'])
assert client.get('/api/canvases/legacy-smart').status_code == 410
assert not any('/smart-canvas/' in getattr(r,'path','') for r in main.app.routes)
for path,data in files: assert path.read_bytes() == data
'''
    env = {'PATH': os.environ['PATH'], 'HOME': str(tmp_path), 'JINNI_DATA_DIR': str(tmp_path / 'data'), 'JINNI_ASSETS_DIR': str(tmp_path / 'assets')}
    result = subprocess.run([sys.executable, '-c', script], cwd=tmp_path, env=env, capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, result.stdout + result.stderr
    for name in ('smart-canvas.html','js/smart-canvas.js','js/smart-tasks.js','css/smart-canvas.css','css/smart-tasks.css','js/i18n/smart-canvas.js'):
        assert not (root / 'static' / name).exists()
