"""Provider API contract tested in a copied app with entirely disposable state."""
from pathlib import Path
import os
import shutil
import subprocess
import sys


def test_builtin_provider_api(tmp_path):
    root = Path(__file__).resolve().parents[1]
    for name in ('main.py', 'jinni_storage.py', 'jinni_preferences.py'):
        shutil.copy2(root / name, tmp_path / name)
    shutil.copytree(root / 'knowledge_base', tmp_path / 'knowledge_base', ignore=shutil.ignore_patterns('__pycache__'))
    env = {'PATH': os.environ['PATH'], 'HOME': str(tmp_path), 'JINNI_DATA_DIR': str(tmp_path / 'data'), 'JINNI_ASSETS_DIR': str(tmp_path / 'assets')}
    script = '''
import json
from pathlib import Path
from fastapi.testclient import TestClient
import main
client = TestClient(main.app)
rows = client.get('/api/providers').json()['providers']
assert rows[0]['id'] == 'yzstudio'
assert rows[0]['base_url'] == 'https://yzstudio.vip/v1'
assert not rows[0]['has_key']
legacy = {'id':'legacy','name':'Existing','base_url':'https://example.com/v1','protocol':'openai','primary':True,'chat_models':['existing-model']}
Path(main.API_PROVIDERS_FILE).write_text(json.dumps([legacy]))
rows = client.get('/api/providers').json()['providers']
assert rows[0]['id'] == 'yzstudio' and rows[1]['chat_models'] == ['existing-model']
assert rows[1]['primary'] and not rows[0]['primary']
response = client.put('/api/providers', json=[{**rows[0], 'name':'changed','base_url':'https://other.invalid','protocol':'gemini','api_key':'synthetic-test-key','chat_models':['demo-model']},legacy])
assert response.status_code == 200
builtin = response.json()['providers'][0]
assert (builtin['name'],builtin['base_url'],builtin['protocol']) == ('yzstudio','https://yzstudio.vip/v1','openai')
assert builtin['has_key'] and builtin['chat_models'] == ['demo-model']
assert 'synthetic-test-key' not in response.text
response = client.put('/api/providers', json=[legacy])
assert response.status_code == 200
builtin = response.json()['providers'][0]
assert builtin['id'] == 'yzstudio' and builtin['has_key'] and builtin['chat_models'] == ['demo-model']
assert client.get('/api/providers').json()['providers'][0]['id'] == 'yzstudio'
response = client.put('/api/providers', json=[])
assert response.status_code == 200 and response.json()['providers'][0]['chat_models'] == ['demo-model']
assert client.put('/api/providers', json=[builtin,builtin]).status_code == 400
print('Default, migration, fixed identity, omission protection, persistence and key redaction passed.')
'''
    result = subprocess.run([sys.executable, '-c', script], cwd=tmp_path, env=env, capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, result.stdout + result.stderr
