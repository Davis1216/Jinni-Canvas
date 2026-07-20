from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CANVAS_JS = (ROOT / "static" / "js" / "canvas.js").read_text(encoding="utf-8")
CANVAS_CSS = (ROOT / "static" / "css" / "canvas.css").read_text(encoding="utf-8")
CANVAS_HTML = (ROOT / "static" / "canvas.html").read_text(encoding="utf-8")
CANVAS_LIST_JS = (ROOT / "static" / "js" / "canvas-list.js").read_text(encoding="utf-8")
CANVAS_LIST_HTML = (ROOT / "static" / "canvas-list.html").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
ASSET_MANAGER_JS = (ROOT / "static" / "js" / "asset-manager.js").read_text(encoding="utf-8")
SMART_CANVAS_JS = (ROOT / "static" / "js" / "smart-canvas.js").read_text(encoding="utf-8")
SMART_CANVAS_HTML = (ROOT / "static" / "smart-canvas.html").read_text(encoding="utf-8")
TOOL_API_MODE_JS = (ROOT / "static" / "js" / "tool-api-mode.js").read_text(encoding="utf-8")
ONLINE_HTML = (ROOT / "static" / "online.html").read_text(encoding="utf-8")
MAIN_PY = (ROOT / "main.py").read_text(encoding="utf-8")


def test_unconfigured_modelscope_and_runninghub_are_filtered_from_canvas():
    assert "if(id === 'modelscope') return provider.has_key === true" in CANVAS_JS
    assert "provider.has_wallet_key === true" in CANVAS_JS
    assert 'data-provider-required="modelscope"' in CANVAS_HTML
    assert 'data-provider-required="runninghub"' in CANVAS_HTML
    assert ".filter(p => providerReadyForCanvasSelection(p)" in CANVAS_JS


def test_unconfigured_builtin_providers_are_filtered_from_other_model_pickers():
    assert "providerReadyForSelection(p)" in ONLINE_HTML
    assert "providerReadyForSmartCanvasSelection(p)" in SMART_CANVAS_JS
    assert 'value="modelscope" data-i18n="smart.engineMs" hidden' in SMART_CANVAS_HTML
    assert 'value="runninghub" data-i18n="smart.engineRh" hidden' in SMART_CANVAS_HTML
    assert "refreshSmartEngineProviderVisibility()" in SMART_CANVAS_JS
    assert "providerReadyForSelection(provider)" in TOOL_API_MODE_JS
    assert "providerReadyForAssetSelection(p)" in ASSET_MANAGER_JS
    for source in (ONLINE_HTML, SMART_CANVAS_JS, TOOL_API_MODE_JS, ASSET_MANAGER_JS):
        assert "has_key === true" in source
        assert "has_wallet_key === true" in source


def test_canvas_ratio_options_include_readable_chinese_labels():
    for label in ("方图", "竖图", "横图", "手机竖屏", "宽屏", "超宽屏"):
        assert label in CANVAS_JS
    assert "${canvasRatioLabel('1:1')}" in CANVAS_JS
    assert "${canvasRatioLabel('16:9')}" in CANVAS_JS


def test_llm_can_write_versioned_text_into_unified_output():
    assert "texts:[], activeTextVersions:{}, textViewModes:{}" in CANVAS_JS
    assert "function appendOutputText(" in CANVAS_JS
    assert "function syncLLMTextOutputs(" in CANVAS_JS
    assert "syncLLMTextOutputs(node, node.outputText, 'node')" in CANVAS_JS
    assert "syncLLMTextOutputs(node, text, 'chat')" in CANVAS_JS
    assert "to.type === 'output' || CANVAS_GENERATOR_TYPES.includes(to.type)" in CANVAS_JS


def test_output_text_has_preview_source_and_actions():
    for action in ("toggle", "copy", "download", "prompt", "delete", "prev", "next"):
        assert f'data-output-text-action="{action}"' in CANVAS_JS
    assert "canvasMarkdownHtml" in CANVAS_JS
    assert "latestOutputTexts(n)" in CANVAS_JS


def test_every_classic_canvas_entry_uses_current_asset_version():
    version = "2026.07.16.2"
    assert f"/static/canvas.html?id=${{enc}}&project=${{project}}&v={version}" in CANVAS_LIST_JS
    assert f"/static/canvas.html?id=${{id}}&v={version}" in ASSET_MANAGER_JS
    # HTML 中的 iframe 和静态资源会由启动时的 cache-buster 自动改写为文件时间戳，
    # 因此只校验存在版本参数，不将生成值锁死为编辑器入口版本。
    assert '/static/canvas-list.html?v=' in INDEX_HTML
    assert '/static/js/canvas-list.js?v=' in CANVAS_LIST_HTML
    assert '/static/js/canvas.js?v=' in CANVAS_HTML
    assert '/static/css/canvas.css?v=' in CANVAS_HTML


def test_canvas_input_changes_refresh_every_connected_consumer():
    assert "function notifyCanvasInputConsumers(" in CANVAS_JS
    assert "scheduleGeneratorInputSync([node.id])" in CANVAS_JS
    assert "notifyCanvasInputConsumers([node.id]);" in CANVAS_JS
    assert "else if(target.type === 'llm') liveNodes.add(target.id)" in CANVAS_JS
    assert "else if(target.type === 'loop')" in CANVAS_JS
    assert "else if(target.type === 'output')" in CANVAS_JS
    assert "refreshGeneratorInputViews([...targets.generators])" in CANVAS_JS
    assert "CANVAS_IMAGE_OUTPUT_TYPES.includes(from.type) && to.type === 'loop' && to.imageInput" in CANVAS_JS
    assert "CANVAS_MEDIA_OUTPUT_TYPES.includes(from.type) && to.type === 'llm'" in CANVAS_JS
    assert "generatedImageRefs(n).filter(ref => ref.kind === 'image')" in CANVAS_JS


def test_generated_and_output_content_invalidates_downstream_inputs():
    merge_block = CANVAS_JS.split("function mergeGeneratedOutputs(", 1)[1].split("function pendingById(", 1)[0]
    assert merge_block.count("notifyCanvasInputConsumers([node.id])") == 2
    assert "if(['delete','prev','next'].includes(action)) notifyCanvasInputConsumers([node.id]" in CANVAS_JS
    assert "node.images = (node.images || []).filter" in CANVAS_JS
    assert "notifyCanvasInputConsumers([node.id], {refreshRelays:false})" in CANVAS_JS


def test_quality_control_only_sends_supported_upstream_parameter():
    assert "function imageQualitySupported(" in CANVAS_JS
    assert "qualitySelect.disabled = !supported" in CANVAS_JS
    assert "autoOption.textContent = supported ? 'Q auto' : 'Q N/A'" in CANVAS_JS
    assert CANVAS_JS.count("imageQualitySupported(gen) ? normalizedImageQuality(gen.quality) : ''") == 2


def test_prompt_preview_keeps_prompts_that_share_a_media_source():
    assert "src.prompt && !src.refs?.length" not in CANVAS_JS
    assert "escapeHtml(src.prompt || src.label)" in CANVAS_JS


def test_connection_run_feedback_is_stateful_and_motion_safe():
    assert "function connectionRunState(" in CANVAS_JS
    for state in ("queued", "running", "success", "failed"):
        assert f"return '{state}'" in CANVAS_JS
        assert f".link-feedback.link-{state}" in CANVAS_CSS
    assert "if(runState){" in CANVAS_JS
    assert "from?.running || to?.running" in CANVAS_JS
    assert "pendingNodeIds" in CANVAS_JS
    assert "function linkPulseEl(" in CANVAS_JS
    assert "maxRunningLinkPulses" in CANVAS_JS
    assert "animation:canvasLinkFlow" not in CANVAS_CSS
    assert ".link-pulse" in CANVAS_CSS
    assert "@media (prefers-reduced-motion: reduce)" in CANVAS_CSS
    assert ".node.node-run-running .port::after" in CANVAS_CSS


def test_high_frequency_success_access_logs_are_quiet_but_errors_remain_visible():
    assert '"/api/config"' in MAIN_PY
    assert 'path.startswith("/api/canvas-image-tasks/")' in MAIN_PY
    assert 'path.startswith("/api/canvas-comfy-tasks/")' in MAIN_PY
    assert '(method == "PUT" and path.startswith("/api/canvases/"))' in MAIN_PY
    assert "and status < 400" in MAIN_PY
