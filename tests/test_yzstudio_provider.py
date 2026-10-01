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
# Only synthetic keys are used throughout this copied application.
scoped = {**builtin, 'api_key':'global-test', 'llm_api_key':'llm-test', 'image_api_key':'image-test', 'video_api_key':'video-test'}
response = client.put('/api/providers', json=[scoped])
assert response.status_code == 200
assert all(value not in response.text for value in ('global-test','llm-test','image-test','video-test'))
p = main.get_api_provider_exact('yzstudio')
assert main.api_headers(provider=p)['Authorization'] == 'Bearer image-test'
assert main.resolve_chat_provider('yzstudio','demo-model','')[1]['Authorization'] == 'Bearer llm-test'
assert main.api_headers(provider={**p, '_key_purpose':'video'})['Authorization'] == 'Bearer video-test'
assert main.api_key_from_payload(main.TestConnectionPayload(provider_id='yzstudio',purpose='llm')) == 'llm-test'
assert response.json()['providers'][0]['key_scopes']['llm']['source'] == 'independent'
response = client.put('/api/providers', json=[{**p,'clear_key':True}])
assert not response.json()['providers'][0]['has_key']
assert main.provider_env_key_value('yzstudio','image') == 'image-test'
response = client.put('/api/providers', json=[{**p,'api_key':'shared-test','clear_llm_key':True,'clear_image_key':True,'clear_video_key':True}])
assert response.json()['providers'][0]['key_scopes']['llm']['source'] == 'global'
assert main.api_headers(provider=p)['Authorization'] == 'Bearer shared-test'
# Model discovery uses each functional credential, deduplicating shared ones.
import asyncio
original_fetch = main.fetch_models_from_upstream
model_keys=[]
async def model_fetch(base,key,protocol,mode):
    model_keys.append(key)
    return {'image_models':['image-'+key], 'chat_models':['chat-'+key], 'video_models':['video-'+key], 'all':[key]}
main.fetch_models_from_upstream=model_fetch
models=asyncio.run(main.fetch_upstream_models('yzstudio',purpose='all'))
assert model_keys==['shared-test'] and models['chat_models']==['chat-shared-test']
client.put('/api/providers',json=[{**p,'llm_api_key':'llm-distinct','video_api_key':'video-distinct'}])
model_keys.clear()
models=asyncio.run(main.fetch_upstream_models('yzstudio',purpose='all'))
assert model_keys==['shared-test','llm-distinct','video-distinct']
assert models['chat_models']==['chat-llm-distinct'] and models['video_models']==['video-video-distinct']
main.fetch_models_from_upstream=original_fetch
client.put('/api/providers',json=[{**p,'clear_llm_key':True,'clear_video_key':True}])

import httpx, asyncio
calls=[]
original_client = main.httpx.AsyncClient
async def handle(request):
    calls.append(str(request.url))
    assert request.headers['Authorization'] == 'Bearer shared-test'
    return httpx.Response(200,json={'mode':'quota_limited','isValid':True,'quota':{'limit':100,'used':15,'remaining':85,'unit':'USD'}})
main.httpx.AsyncClient=lambda **kwargs: original_client(transport=httpx.MockTransport(handle),**kwargs)
usage=asyncio.run(main.provider_usage('yzstudio'))
assert len(calls)==1 and calls[0]=='https://yzstudio.vip/v1/usage'
assert usage['entries'][0]['scopes']==['global','llm','image','video']
assert usage['entries'][0]['key_quota']['remaining']==85
asyncio.run(main.provider_usage('yzstudio'))
assert len(calls)==1
assert main.normalize_provider_usage({'mode':'unrestricted','balance':0})['balance']==0
assert main.normalize_provider_usage({'mode':'unrestricted'})['remaining'] is None
assert main.normalize_provider_usage({'unexpected':'shape'})['status']=='unsupported'
for code,status in [(404,'unsupported'),(401,'unauthorized'),(429,'error')]:
    async def failure(request): return httpx.Response(code,json={'secret':'never expose'})
    main.httpx.AsyncClient=lambda **kwargs: original_client(transport=httpx.MockTransport(failure),**kwargs)
    result=asyncio.run(main.provider_usage('yzstudio',refresh=True))
    assert result['entries'][0]['status']==status and 'secret' not in str(result)
async def timeout(request): raise httpx.ReadTimeout('synthetic timeout', request=request)
main.httpx.AsyncClient=lambda **kwargs: original_client(transport=httpx.MockTransport(timeout),**kwargs)
assert asyncio.run(main.provider_usage('yzstudio',refresh=True))['entries'][0]['status']=='error'
subscription=main.normalize_provider_usage({'mode':'unrestricted','isValid':False,'status':'expired','subscription':{'daily_limit_usd':10,'daily_usage_usd':2,'expires_at':'2026-10-01'}})
assert subscription['subscription']['daily_limit_usd']==10 and subscription['valid'] is False
assert 'shared-test' not in Path(main.API_PROVIDERS_FILE).read_text()
main.httpx.AsyncClient=original_client
print('Provider persistence, independent keys, inheritance, redaction and deduplicated quota queries passed.')
'''
    result = subprocess.run([sys.executable, '-c', script], cwd=tmp_path, env=env, capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, result.stdout + result.stderr
