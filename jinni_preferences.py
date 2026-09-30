"""Small persisted UI preferences API, separate from provider credentials."""
import json
from pathlib import Path
from fastapi import HTTPException, Request
from jinni_storage import atomic_json

COMMANDS = {'image','prompt','loop','output','llm','generate','video','group','effects','transfer','library','logs','selectAll','undo','redo','delete','settings','copy','paste','zoomIn','zoomOut','zoomReset','fit','preview','knife','pan','selection'}
RESERVED = {'Mod+B','Mod+O','Mod+M','Mod+F','Mod+H','Mod+Q','Mod+W','Mod+T','Mod+N','Mod+R','Mod+L','Mod+Tab','Mod+Shift+T','Mod+Shift+N','Mod+Shift+W','Alt+F4','Mod+Space','Mod+Shift+3','Mod+Shift+4','Mod+Shift+5', 'Alt+Tab', 'Mod+Alt+Delete', 'Mod+Alt+Escape', 'Mod+Alt+Q', 'Mod+Shift+Q', 'Mod+Shift+R'}

def validate_preferences(value):
    if not isinstance(value, dict) or not isinstance(value.get('enabled', True), bool):
        raise ValueError('快捷键配置格式不正确')
    bindings = value.get('bindings', {})
    if not isinstance(bindings, dict):
        raise ValueError('快捷键配置格式不正确')
    used = set()
    for command, shortcut in bindings.items():
        if command not in COMMANDS or not isinstance(shortcut, str) or len(shortcut) > 60:
            raise ValueError('未知的快捷键配置')
        if shortcut in RESERVED or shortcut in {'Escape', 'Tab', 'Enter', 'Shift', 'Control', 'Meta', 'Alt'}:
            raise ValueError('该按键由系统或基础交互保留')
        if shortcut and shortcut in used:
            raise ValueError('快捷键冲突，请使用不同按键')
        if shortcut:
            used.add(shortcut)
    return {'version': 1, 'enabled': value.get('enabled', True), 'bindings': bindings}


def install_preferences_api(app, data_dir):
    path = Path(data_dir) / 'ui_preferences.json'

    @app.get('/api/ui-preferences')
    def get_preferences():
        if not path.exists():
            return {'version': 1, 'enabled': True, 'bindings': {}}
        try:
            return validate_preferences(json.loads(path.read_text(encoding='utf-8')))
        except (ValueError, OSError) as exc:
            raise HTTPException(500, '快捷键配置无法读取，请恢复默认后保存') from exc

    @app.put('/api/ui-preferences')
    async def put_preferences(request: Request):
        try:
            value = validate_preferences(await request.json())
            atomic_json(path, value)
            return value
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        except OSError as exc:
            raise HTTPException(500, '保存失败，请检查数据目录权限') from exc

    appearance_path = Path(data_dir) / 'canvas_appearance.json'

    @app.get('/api/canvas-appearance')
    def get_appearance():
        if not appearance_path.exists():
            return {}
        try:
            return json.loads(appearance_path.read_text(encoding='utf-8'))
        except (OSError, ValueError) as exc:
            raise HTTPException(500, '背景偏好无法读取') from exc

    @app.put('/api/canvas-appearance')
    async def put_appearance(request: Request):
        value = await request.json()
        modes = {'flow','liquid','floatingLines','galaxy','silk','waves','dotField','dotGrid','shapeGrid','faultyTerminal','dots','lines','blank'}
        if not isinstance(value, dict) or value.get('mode') not in modes or not isinstance(value.get('motion'), bool):
            raise HTTPException(400, '背景偏好格式不正确')
        intensity = value.get('intensity')
        if not isinstance(intensity, (int, float)) or isinstance(intensity, bool) or not .25 <= intensity <= 1:
            raise HTTPException(400, '背景强度应在 25% 到 100% 之间')
        result = {key: value[key] for key in ('mode', 'motion', 'intensity')}
        try:
            atomic_json(appearance_path, result)
        except OSError as exc:
            raise HTTPException(500, '背景偏好保存失败，请检查目录权限') from exc
        return result
