"""Run only against the isolated acceptance backend: python tests/jinni_api_smoke.py."""
import json
import urllib.request
import urllib.error
BASE = 'http://127.0.0.1:8772'

def request(path, method='GET', value=None):
    raw = json.dumps(value).encode() if value is not None else None
    req = urllib.request.Request(BASE + path, raw, {'Content-Type':'application/json'}, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)

status, data = request('/api/asset-library')
assert status == 200
library = data['library']
lib = library['libraries'][0]['id']
assert request('/api/asset-library/categories','POST',{'library_id':lib,'name':'   ','type':'image'})[0] == 400
status, data = request('/api/asset-library/categories','POST',{'library_id':lib,'name':'Acceptance category','type':'image'})
assert status == 200
category = data['category']['id']
assert request('/api/asset-library/categories','POST',{'library_id':lib,'name':'ACCEPTANCE CATEGORY','type':'image'})[0] == 409
assert request(f'/api/asset-library/categories/{category}?library_id={lib}','DELETE')[0] == 200
assert request('/api/ui-preferences','PUT',{'enabled':False,'bindings':{'image':'U'}})[0] == 200
assert request('/api/ui-preferences')[1]['enabled'] is False
assert request('/api/ui-preferences','PUT',{'bindings':{'image':'P','prompt':'P'}})[0] == 400
assert request('/api/ui-preferences','PUT',{'enabled':True,'bindings':{}})[0] == 200
print('Live isolated backend: category validation, case-insensitive collision, persistence and invalid shortcuts passed.')
