import json
from pathlib import Path
import sys
import pytest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import jinni_storage as storage
from jinni_preferences import validate_preferences

@pytest.fixture
def config(tmp_path, monkeypatch):
    path = tmp_path / 'settings/storage.json'
    monkeypatch.setenv('JINNI_STORAGE_CONFIG', str(path))
    monkeypatch.delenv('JINNI_DESKTOP_HOME', raising=False)
    return path

def test_initialize_and_reload(tmp_path, config):
    root = storage.initialize(str(tmp_path / '中文 data'))
    assert storage.valid_root(root)
    assert storage.configured_root() == root
    assert all((root / part).is_dir() for part in storage.REQUIRED)
    assert not (root / 'data/api_providers.json').exists()

def test_copy_originals_and_remap_media(tmp_path, config):
    source = tmp_path / 'old'
    (source / 'data').mkdir(parents=True)
    (source / 'assets/input').mkdir(parents=True)
    image = source / 'assets/input/image.png'
    image.write_bytes(b'image bytes')
    document = source / 'data/project.json'
    document.write_text(json.dumps({'image': str(image)}))
    original = document.read_bytes()
    root = storage.initialize(str(tmp_path / 'new'), source)
    assert (root / 'assets/input/image.png').read_bytes() == image.read_bytes()
    assert json.loads((root / 'data/project.json').read_text())['image'] == '/assets/input/image.png'
    assert document.read_bytes() == original
    assert json.loads(config.read_text())['legacy_root'] == str(source)

def test_collision_preserves_both(tmp_path, config):
    source, target = tmp_path / 'old', tmp_path / 'new'
    for root, text in [(source, '{"v":1}'), (target, '{"v":2}')]:
        (root / 'data').mkdir(parents=True)
        (root / 'data/project.json').write_text(text)
    with pytest.raises(ValueError, match='不同内容'):
        storage.initialize(str(target), source)
    assert json.loads((target / 'data/project.json').read_text()) == {'v': 2}
    assert not config.exists()

def test_incomplete_directory_repairs_without_replacing_data(tmp_path, config):
    root = storage.initialize(str(tmp_path / 'new'))
    item = root / 'data/project.json'
    item.write_text('{"title":"kept"}')
    (root / 'assets/library').rmdir()
    assert not storage.valid_root(root)
    storage.initialize(str(root))
    assert storage.valid_root(root)
    assert json.loads(item.read_text()) == {'title': 'kept'}

def test_invalid_json_stops_initialization(tmp_path, config):
    root = tmp_path / 'new'
    (root / 'data').mkdir(parents=True)
    (root / 'data/project.json').write_text('{broken')
    with pytest.raises(ValueError, match='损坏'):
        storage.initialize(str(root))
    assert not config.exists()
    assert not storage.valid_root(root)

@pytest.mark.parametrize('value', ['', 'relative/folder', '/'])
def test_invalid_locations(value, config):
    with pytest.raises(ValueError):
        storage.validate_path(value)

def test_interrupted_copy_retries_without_overwrite(tmp_path, config):
    source = tmp_path / 'old'
    (source / 'data').mkdir(parents=True)
    for i in range(3):
        (source / f'data/{i}.json').write_text(json.dumps({'id': i}))
    def interrupted(_):
        raise OSError('interrupted')
    with pytest.raises(OSError):
        storage.initialize(str(tmp_path / 'new'), source, interrupted)
    assert not config.exists()
    root = storage.initialize(str(tmp_path / 'new'), source)
    assert storage.valid_root(root)
    assert len(list((root / 'data').glob('*.json'))) == 3

def test_explicit_environment_bypass(tmp_path, monkeypatch):
    monkeypatch.setenv('JINNI_DATA_DIR', str(tmp_path / 'test-data'))
    monkeypatch.setenv('JINNI_ASSETS_DIR', str(tmp_path / 'test-assets'))
    storage.ensure_storage(tmp_path)
    assert not (tmp_path / 'test-data').exists()

def test_shortcuts_validation():
    assert validate_preferences({'enabled': False, 'bindings': {'image': ''}})['enabled'] is False
    with pytest.raises(ValueError, match='冲突'):
        validate_preferences({'bindings': {'image': 'I', 'prompt': 'I'}})
    with pytest.raises(ValueError, match='保留'):
        validate_preferences({'bindings': {'image': 'Mod+Q'}})


def test_initialized_but_corrupted_data_is_not_accepted(tmp_path, config):
    root = storage.initialize(str(tmp_path / 'new'))
    broken = root / 'data/project.json'
    broken.write_text('{invalid')
    with pytest.raises(ValueError, match='损坏'):
        storage.initialize(str(root))
    assert broken.read_text() == '{invalid'


def test_permission_failure_keeps_config_unwritten(tmp_path, config, monkeypatch):
    monkeypatch.setattr(storage.os, 'access', lambda *args: False)
    with pytest.raises(ValueError, match='不可写'):
        storage.initialize(str(tmp_path / 'new'))
    assert not config.exists()


def test_preference_api_roundtrip_and_corruption(tmp_path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from jinni_preferences import install_preferences_api
    app = FastAPI()
    install_preferences_api(app, tmp_path)
    client = TestClient(app)
    assert client.get('/api/canvas-appearance').json() == {}
    value = {'mode':'floatingLines', 'intensity':.65, 'motion':False}
    assert client.put('/api/canvas-appearance', json=value).status_code == 200
    assert client.get('/api/canvas-appearance').json() == value
    assert client.put('/api/canvas-appearance', json={**value, 'intensity':2}).status_code == 400
    assert client.put('/api/canvas-appearance', json={**value, 'mode':'unknown'}).status_code == 400
    assert client.get('/api/canvas-appearance').json() == value
    value = {'enabled':False,'bindings':{'image':'U'}}
    assert client.put('/api/ui-preferences', json=value).status_code == 200
    assert client.get('/api/ui-preferences').json()['bindings']['image'] == 'U'
    (tmp_path / 'ui_preferences.json').write_text('{bad')
    assert client.get('/api/ui-preferences').status_code == 500
    assert client.put('/api/ui-preferences', json=value).status_code == 200


def test_setup_picker_requires_local_nonce_and_expires(tmp_path):
    import os
    import re
    import socket
    import subprocess
    import time
    import requests
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    root = tmp_path / 'data-root'
    env = {key: value for key, value in os.environ.items() if not key.startswith('JINNI_')}
    env.update(JINNI_DESKTOP_HOME=str(root), JINNI_STORAGE_CONFIG=str(tmp_path / 'storage.json'), JINNI_PORT=str(port))
    process = subprocess.Popen([sys.executable, '-c', 'from pathlib import Path; import jinni_storage as s; s.legacy_roots=lambda project: []; s.ensure_storage(Path.cwd())'], cwd=Path(__file__).resolve().parents[1], env=env, stdout=subprocess.DEVNULL)
    url = f'http://127.0.0.1:{port}'
    try:
        for _ in range(100):
            try:
                page = requests.get(url, timeout=.2)
                break
            except requests.ConnectionError:
                time.sleep(.05)
        else:
            pytest.fail('setup service did not start')
        token = re.search(r"const token='([^']+)'", page.text).group(1)
        endpoint = url + '/api/setup/directory-picker'
        assert requests.post(endpoint).status_code == 403
        assert requests.post(endpoint, headers={'Origin':'https://example.com', 'X-Setup-Token':token}).status_code == 403
        headers = {'Origin':url, 'X-Setup-Token':token}
        assert requests.post(endpoint, headers=headers).status_code == 200
        assert requests.post(url + '/api/setup/initialize', headers=headers, json={'root':str(root)}).status_code == 200
        assert requests.post(endpoint, headers=headers).status_code == 403
        assert process.wait(timeout=8) == 0
        assert storage.valid_root(root)
    finally:
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=5)
