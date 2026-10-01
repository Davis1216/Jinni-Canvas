"""Preflight storage setup. Runs before importing the application or its stores."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import sys
import threading
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REQUIRED = ('data', 'data/canvases', 'data/knowledge_base', 'assets', 'assets/input', 'assets/output', 'assets/library')
MARKER = '.jinni-storage.json'


def config_path():
    if os.environ.get('JINNI_STORAGE_CONFIG'):
        return Path(os.environ['JINNI_STORAGE_CONFIG']).expanduser()
    if sys.platform == 'win32':
        base = Path(os.environ.get('APPDATA', Path.home() / 'AppData/Roaming'))
    elif sys.platform == 'darwin':
        base = Path.home() / 'Library/Application Support'
    else:
        base = Path(os.environ.get('XDG_CONFIG_HOME', Path.home() / '.config'))
    return base / 'Jinni Canvas/storage.json'


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, name = tempfile.mkstemp(prefix=path.name + '.', dir=path.parent)
    temporary = Path(name)
    with os.fdopen(handle, 'w', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


def valid_root(root):
    try:
        return json.loads((root / MARKER).read_text(encoding='utf-8'))['version'] == 1 and all((root / name).is_dir() for name in REQUIRED)
    except (OSError, ValueError, KeyError, TypeError):
        return False


def configured_root():
    if os.environ.get('JINNI_DESKTOP_HOME'):
        return Path(os.environ['JINNI_DESKTOP_HOME']).expanduser().resolve()
    path = config_path()
    if path.exists():
        try:
            value = json.loads(path.read_text(encoding='utf-8'))['root']
            if not isinstance(value, str) or not Path(value).is_absolute():
                raise ValueError('invalid path')
            return Path(value)
        except (ValueError, KeyError, TypeError) as exc:
            raise ValueError('数据位置配置损坏，请重新选择目录；原数据不会被覆盖。') from exc
    return Path.home() / '.jinni-canvas'


def legacy_roots(project):
    candidates = [project, Path.home() / 'Library/Application Support/Jinni Canvas', Path(os.environ.get('LOCALAPPDATA', Path.home() / 'AppData/Local')) / 'Jinni Canvas']
    if os.environ.get('JINNI_LEGACY_ROOT'):
        candidates.insert(0, Path(os.environ['JINNI_LEGACY_ROOT']))
    if os.environ.get('JINNI_LEGACY_PROJECT'):
        candidates.insert(0, Path(os.environ['JINNI_LEGACY_PROJECT']))
    found = []
    for root in candidates:
        root = root.resolve()
        if root not in found and (root / 'data').is_dir() and any((root / 'data').glob('*.json')):
            found.append(root)
    return found


def validate_path(value):
    root = Path(str(value).strip()).expanduser()
    if not str(value).strip() or not root.is_absolute():
        raise ValueError('请输入完整的绝对路径。')
    root = root.resolve()
    if root == Path(root.anchor) or root == Path.home():
        raise ValueError('请选择专用数据文件夹，不要直接使用磁盘或用户根目录。')
    if root.exists() and not root.is_dir():
        raise ValueError('所选位置不是文件夹。')
    ancestor = root
    while not ancestor.exists():
        ancestor = ancestor.parent
    if not os.access(ancestor, os.W_OK):
        raise ValueError('所选位置不可写，请重新选择。')
    return root


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.digest()


def migrated_json(path, source, root):
    # Only data documents can contain media paths; do not rewrite provider secrets.
    relative = path.relative_to(source)
    if relative.parts[0] != 'data' or path.suffix != '.json' or path.name in ('api_providers.json', 'ui_preferences.json'):
        return None
    value = json.loads(path.read_text(encoding='utf-8'))
    changed = False
    def visit(item):
        nonlocal changed
        if isinstance(item, str):
            normalized = item.replace('\\', '/')
            for area in ('assets', 'data'):
                prefix = (source / area).as_posix() + '/'
                if normalized.startswith(prefix):
                    changed = True
                    tail = normalized[len(prefix):]
                    return '/assets/' + tail if area == 'assets' else str(root / area / tail)
        if isinstance(item, list):
            return [visit(v) for v in item]
        if isinstance(item, dict):
            return {k: visit(v) for k, v in item.items()}
        return item
    result = visit(value)
    return json.dumps(result, ensure_ascii=False, indent=2).encode() if changed else None


def initialize(value, source=None, progress=None):
    root = validate_path(value)
    source = Path(source).expanduser().resolve() if source else None
    if any((root / area).is_symlink() or any(p.is_symlink() for p in (root / area).rglob('*')) for area in ('data', 'assets') if (root / area).exists()):
        raise ValueError('数据目录包含符号链接，请使用真实文件目录。')
    if source and source != root and (root.is_relative_to(source / 'data') or root.is_relative_to(source / 'assets') or source.is_relative_to(root)):
        raise ValueError('来源和目标不能互相嵌套。')
    if not valid_root(root):
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        if any((root / area).is_symlink() for area in REQUIRED):
            raise ValueError('数据目录不能通过符号链接指向其他位置，请选择真实目录。')
        if source and source != root:
            if not (source / 'data').is_dir():
                raise ValueError('旧数据来源不存在。')
            if any((source / area).is_symlink() or any(p.is_symlink() for p in (source / area).rglob('*')) for area in ('data', 'assets') if (source / area).is_dir()):
                raise ValueError('旧数据含符号链接，请先将链接内容复制为真实文件后重试。')
            files = [p for area in ('data', 'assets') if (source / area).is_dir() for p in (source / area).rglob('*') if p.is_file() and not p.is_symlink() and not p.name.startswith('._') and p.name != '.DS_Store']
            # Check every collision before copying. Never merge different user files.
            converted = {p: migrated_json(p, source, root) for p in files if p.suffix == '.json'}
            for p in files:
                target = root / p.relative_to(source)
                expected = hashlib.sha256(converted[p]).digest() if converted.get(p) is not None else digest(p)
                if target.exists() and (not target.is_file() or expected != digest(target)):
                    raise ValueError('目标已有不同内容的文件，请选择空目录或原有数据根目录。')
            for index, p in enumerate(files):
                target = root / p.relative_to(source)
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists():
                    temporary = target.with_name(target.name + '.jinni-copy')
                    shutil.copy2(p, temporary)
                    if digest(p) != digest(temporary):
                        raise ValueError('复制校验失败，请重试。')
                    if converted.get(p) is not None:
                        temporary.write_bytes(converted[p])
                    os.replace(temporary, target)
                if progress:
                    progress(f'复制并校验文件 {index + 1}/{len(files)}')
        for name in REQUIRED:
            (root / name).mkdir(parents=True, exist_ok=True)
    # Recheck existing roots too: a valid marker never licenses replacing damaged data.
    for path in (root / 'data').rglob('*.json'):
        if path.name.startswith('._'): continue
        try:
            json.loads(path.read_text(encoding='utf-8'))
        except (ValueError, UnicodeError) as exc:
            raise ValueError(f'数据文件格式损坏：{path.relative_to(root)}；请恢复该文件后重试。') from exc
    atomic_json(root / MARKER, {'version': 1})
    atomic_json(config_path(), {'root': str(root), 'legacy_root': str(source) if source else None})
    return root


def activate(root):
    os.environ['JINNI_DATA_DIR'] = str(root / 'data')
    os.environ['JINNI_ASSETS_DIR'] = str(root / 'assets')
    os.environ['JINNI_KB_DATA_DIR'] = str(root / 'data/knowledge_base')
    # Resolve old absolute media references without rewriting credentials or source files.
    try:
        source = json.loads(config_path().read_text(encoding='utf-8')).get('legacy_root')
        if source:
            os.environ['JINNI_LEGACY_ROOT'] = source
    except (OSError, ValueError):
        pass


def ensure_storage(project):
    if os.environ.get('JINNI_DATA_DIR') and os.environ.get('JINNI_ASSETS_DIR'):
        os.environ.setdefault('JINNI_KB_DATA_DIR', str(Path(os.environ['JINNI_DATA_DIR']) / 'knowledge_base'))
        return
    issue = ''
    try:
        root = configured_root()
        if valid_root(root):
            validate_path(str(root))
            for file in (root / 'data').rglob('*.json'):
                if file.name.startswith('._'): continue
                try:
                    json.loads(file.read_text(encoding='utf-8'))
                except (ValueError, UnicodeError) as exc:
                    raise ValueError(f'数据文件损坏：{file.relative_to(root)}，请恢复文件后重试。') from exc
            activate(root)
            return
    except (ValueError, OSError) as exc:
        root, issue = locals().get('root', Path.home() / '.jinni-canvas'), str(exc)
    sources = legacy_roots(project)
    token = secrets.token_urlsafe(32)
    state = {'root': str(root), 'hasData': (root / 'data').is_dir(), 'sources': [str(p) for p in sources], 'error': issue, 'busy': False, 'progress': '', 'complete': False}
    port = int(os.environ.get('JINNI_PORT', '3000'))
    origin = f'http://127.0.0.1:{port}'

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def reply(self, data, status=200):
            raw = json.dumps(data, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            if self.headers.get('Host') not in (f'127.0.0.1:{port}', f'localhost:{port}'):
                return self.reply({'error': 'Invalid host'}, 403)
            if self.path == '/api/setup/status':
                return self.reply(state)
            if self.path != '/':
                return self.reply({'initializing': True}, 503)
            raw = (project / 'static/setup.html').read_text(encoding='utf-8').replace('__SETUP_TOKEN__', token).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(raw)

        def do_POST(self):
            if self.headers.get('Origin') not in (origin, f'http://localhost:{port}') or self.headers.get('X-Setup-Token') != token:
                return self.reply({'error': 'Invalid origin'}, 403)
            if self.path == '/api/setup/directory-picker':
                return self.reply({'authorized': not state['busy'] and not state['complete']}, 403 if state['busy'] or state['complete'] else 200)
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length > 16384:
                    raise ValueError('请求过大')
                payload = json.loads(self.rfile.read(length))
                target = validate_path(payload.get('root', ''))
                if self.path == '/api/setup/validate':
                    return self.reply({'root': str(target), 'ready': valid_root(target)})
                if self.path != '/api/setup/initialize':
                    return self.reply({'error': 'Not found'}, 404)
                with lock:
                    if state['busy']:
                        return self.reply({'error': '初始化正在进行'}, 409)
                    source = payload.get('source')
                    if source and source not in state['sources']:
                        raise ValueError('请选择检测到的旧数据来源。')
                    state.update(busy=True, error='', progress='检查数据目录…')
                def work():
                    try:
                        selected = initialize(str(target), source, lambda text: state.update(progress=text))
                        activate(selected)
                        state.update(complete=True, progress='初始化完成，正在启动应用…')
                        threading.Timer(1.5, server.shutdown).start()
                    except Exception as exc:
                        state.update(error=str(exc), busy=False)
                threading.Thread(target=work, daemon=True).start()
                self.reply({'started': True})
            except Exception as exc:
                self.reply({'error': str(exc)}, 400)

    lock = threading.Lock()
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'数据初始化向导：{origin}', flush=True)
    try:
        server.serve_forever(poll_interval=.2)
    finally:
        server.server_close()
