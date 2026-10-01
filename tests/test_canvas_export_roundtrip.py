"""Exercise both canvas-list exports and legacy workflow imports in disposable storage."""
import os
from pathlib import Path
import shutil
import subprocess
import sys


def test_canvas_and_workflow_roundtrip(tmp_path):
    root = Path(__file__).resolve().parents[1]
    for name in ('main.py', 'jinni_storage.py', 'jinni_preferences.py'):
        shutil.copy2(root / name, tmp_path / name)
    shutil.copytree(root / 'knowledge_base', tmp_path / 'knowledge_base', ignore=shutil.ignore_patterns('__pycache__'))
    script = r'''
import io, json, zipfile
from pathlib import Path
from fastapi.testclient import TestClient
import main
client=TestClient(main.app)
original='/assets/input/测试图片.png'
canvas={'id':'roundtrip','title':'中文画布','nodes':[{'id':'ref','type':'image','url':original},{'id':'mixed','type':'output','outputKind':'general','images':[original],'texts':[{'text':'历史文本'}]}],'connections':[{'id':'edge','from':'ref','to':'mixed'}]}
for name in ('canvas.json','workflow.json'):
    archive=io.BytesIO()
    payload=dict(canvas)
    resources=[{'url':original,'archive':'resources/测试图片.png'}]
    if name=='workflow.json':payload['resources']=resources
    with zipfile.ZipFile(archive,'w') as z:
        z.writestr(name,json.dumps(payload))
        z.writestr('resources/测试图片.png',b'synthetic-image-bytes')
        if name=='canvas.json':
            z.writestr('resources-manifest.json',json.dumps({'resources':[{'url':original,'file':'resources/测试图片.png'},{'url':'/assets/missing.png','skipped':True}]}))
    response=client.post('/api/canvas-workflows/import',files={'file':('中文.zip',archive.getvalue(),'application/zip')})
    assert response.status_code==200,response.text
    result=response.json()
    url=result['nodes'][0]['url']
    assert url!=original and url.startswith('/assets/input/workflow_import_')
    assert Path(main.ASSETS_DIR,url.removeprefix('/assets/')).read_bytes()==b'synthetic-image-bytes'
    assert result['nodes'][1]['images']==[url] and result['nodes'][1]['texts'][0]['text']=='历史文本'
    assert result['connections']==canvas['connections']
response=client.post('/api/canvas-workflows/import',files={'file':('中文.json',json.dumps(canvas).encode(),'application/json')})
assert response.status_code==200 and response.json()['nodes']==canvas['nodes']
print('JSON, canvas ZIP + manifest, legacy workflow ZIP and mixed outputs round-trip passed')
'''
    env = {'PATH':os.environ['PATH'],'HOME':str(tmp_path),'JINNI_DATA_DIR':str(tmp_path/'data'),'JINNI_ASSETS_DIR':str(tmp_path/'assets')}
    result=subprocess.run([sys.executable,'-c',script],cwd=tmp_path,env=env,capture_output=True,text=True,timeout=45)
    assert result.returncode==0,result.stdout+result.stderr
