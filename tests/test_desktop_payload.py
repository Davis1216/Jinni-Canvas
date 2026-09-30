import importlib.util
from pathlib import Path

import pytest


def test_distribution_excludes_user_state_and_requires_fresh_destination(tmp_path):
    script = Path(__file__).resolve().parents[1] / "tools/desktop/prepare_payload.py"
    spec = importlib.util.spec_from_file_location("prepare_payload", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source = tmp_path / "source"
    source.mkdir()
    for name in ("main.py", "VERSION", "LICENSE", "requirements.txt"):
        (source / name).write_text("test")
    for name in ("static", "knowledge_base", "workflows", "CLI", "tools", "data", "assets", "API"):
        (source / name).mkdir()
    for name in ("jimeng_cli_install.ps1", "jimeng_cli_login.ps1"):
        (source / "tools" / name).write_text("integration")
    for name in ("data/api.env", "data/canvas.json", "assets/photo.png", "API/.env", "static/.DS_Store"):
        (source / name).write_text("private-test-value")
    (source / "static/index.html").write_text('<script src="/static/js/app.js?v=old"></script>')
    module.ROOT = source
    target = tmp_path / "payload"
    module.stage(target)
    assert list((target / "data").iterdir()) == []
    assert list((target / "assets").iterdir()) == []
    assert not (target / "API").exists()
    assert not (target / "static/.DS_Store").exists()
    assert (target / "tools/jimeng_cli_login.ps1").is_file()
    assert '?v=test"' in (target / "static/index.html").read_text()
    with pytest.raises(FileExistsError):
        module.stage(target)
