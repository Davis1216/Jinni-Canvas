from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CANVAS_JS = (ROOT / "static" / "js" / "canvas.js").read_text(encoding="utf-8")
CANVAS_CSS = (ROOT / "static" / "css" / "canvas.css").read_text(encoding="utf-8")
CANVAS_HTML = (ROOT / "static" / "canvas.html").read_text(encoding="utf-8")
CANVAS_LIST_JS = (ROOT / "static" / "js" / "canvas-list.js").read_text(encoding="utf-8")
CANVAS_LIST_HTML = (ROOT / "static" / "canvas-list.html").read_text(encoding="utf-8")
INDEX_HTML = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
IMAGE_MENTIONS_JS = (ROOT / "static" / "js" / "image-mentions.js").read_text(encoding="utf-8")
IMAGE_MENTIONS_CSS = (ROOT / "static" / "css" / "image-mentions.css").read_text(encoding="utf-8")
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


def test_reference_mentions_are_scoped_to_prompt_or_shared_generation_flow():
    assert "function promptReferenceCandidates(" in CANVAS_JS
    assert "connection.to === promptNode.id" in CANVAS_JS
    assert "canvasInputPropagationTargets([promptNode.id]).generators" in CANVAS_JS
    assert "relatedGeneratorIds.has(connection.to)" in CANVAS_JS
    assert "promptReferenceCandidates(n, gen)" in CANVAS_JS
    assert "if(!targetGenerator?.id) promptNode.referenceOrder = orderedKeys" in CANVAS_JS
    assert "['image','group','output'].includes(source.type)" in CANVAS_JS
    assert "if(to.type === 'prompt') return ['image','group','output'].includes(from.type)" in CANVAS_JS
    assert "CANVAS_MENTION_TARGET_TYPES = ['generator','msgen','comfy','rh']" in CANVAS_JS
    assert "function generationMentionContext(" in CANVAS_JS
    assert "参考图映射" in CANVAS_JS
    assert "`${source.id}:output:${ref?.outputIndex ?? index}`" in CANVAS_JS


def test_related_prompt_refreshes_when_a_shared_flow_image_changes():
    assert "if(peerNode?.type === 'prompt') liveNodes.add(peerNode.id)" in CANVAS_JS
    assert "source && ['image','group','output'].includes(source.type)" in CANVAS_JS


def test_generator_image_preview_matches_deduplicated_request_references():
    assert "function actualReferenceInputSources(" in CANVAS_JS
    assert "generationMentionContext(node, sources).refs" in CANVAS_JS
    assert "sources.filter(source => !source.promptNodeId)" in CANVAS_JS
    assert "type:'promptReference'" in CANVAS_JS
    assert "reorderable:false" in CANVAS_JS
    assert "actualReferenceInputSources(node, ordered, ['image'])" in CANVAS_JS


def test_prompt_previews_render_structured_mentions_as_thumbnail_chips():
    assert "function promptPreviewHtml(" in CANVAS_JS
    assert "parts?.some(part => part?.type === 'image')" in CANVAS_JS
    assert 'class="prompt-preview-mention ${invalid ? \'invalid\' : \'\'}"' in CANVAS_JS
    assert "mentionCandidatesScoped" in CANVAS_JS
    assert ".prompt-preview-mention img" in CANVAS_CSS


def test_only_editable_prompt_mentions_have_clickable_remove_controls():
    assert "remove.className = 'image-mention-remove'" in IMAGE_MENTIONS_JS
    assert "removeToken(token);" in IMAGE_MENTIONS_JS
    assert "editor.dispatchEvent(new Event('input', {bubbles:true}))" in IMAGE_MENTIONS_JS
    assert ".image-mention-remove" in IMAGE_MENTIONS_CSS
    assert "image-mention-remove" not in CANVAS_JS


def test_canvas_cursor_semantics_match_each_interaction():
    assert '[contenteditable="true"] { cursor:text; }' in CANVAS_CSS
    assert '.prompt-rich-input {' in CANVAS_CSS and 'cursor:text; user-select:text;' in CANVAS_CSS
    assert '.prompt-preview-content {' in CANVAS_CSS and 'user-select:text; cursor:text;' in CANVAS_CSS
    assert 'button { cursor:pointer; }' in CANVAS_CSS
    assert 'select:not(:disabled) { cursor:pointer; }' in CANVAS_CSS
    assert 'input[type="range"]' in CANVAS_CSS
    assert '.node-head:active { cursor:grabbing; }' in CANVAS_CSS
    assert 'body.canvas-node-drag * { cursor:grabbing !important; }' in CANVAS_CSS
    assert '[contenteditable="true"]' in CANVAS_JS.split('function isNodeControl(', 1)[1].split('function destroyLTXEditor(', 1)[0]


def test_online_and_canvas_load_inline_reference_mention_ui():
    assert '/static/js/image-mentions.js?v=' in ONLINE_HTML
    assert '/static/css/image-mentions.css?v=' in ONLINE_HTML
    assert '/static/js/image-mentions.js?v=' in CANVAS_HTML
    assert '/static/css/image-mentions.css?v=' in CANVAS_HTML
    assert 'contenteditable="true"' in ONLINE_HTML
    assert 'onlineMentionCandidates' in ONLINE_HTML
    assert 'display_prompt:compiled.displayPrompt' in ONLINE_HTML
    assert 'source_id:`online-ref-${id}`' in ONLINE_HTML


def test_canvas_modelscope_shortcut_and_local_generator_visibility():
    toolbar = CANVAS_HTML.split('<div class="toolbar-items">', 1)[1].split('</div>', 1)[0]
    assert 'onclick="addMsGenNode()"' not in toolbar
    assert 'data-provider-required="modelscope"' in CANVAS_HTML
    assert CANVAS_HTML.count('data-local-tools-required="comfy"') == 2
    assert CANVAS_HTML.count('data-local-tools-required="ltxDirector"') == 2
    assert "const STUDIO_LOCAL_TOOLS_VISIBLE_KEY = 'studio_local_tools_visible'" in CANVAS_JS
    assert "function refreshCanvasLocalToolsVisibility(" in CANVAS_JS
    assert CANVAS_JS.count("if(!canvasLocalToolsVisible()) return null;") == 2
    assert CANVAS_JS.count("...(canvasLocalToolsVisible() ? [{type:'comfy'") == 2
    assert CANVAS_JS.count("...(canvasLocalToolsVisible() ? [{type:'ltxDirector'") == 2
    assert '[data-link-create="comfy"], [data-link-create="ltxDirector"]' in CANVAS_JS
    assert "event.data?.type === 'studio-local-tools-visibility'" in CANVAS_JS
    assert "type:'studio-local-tools-visibility'" in INDEX_HTML


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
    assert "promptPreviewHtml(src)" in CANVAS_JS
    assert "source?.prompt || source?.label" in CANVAS_JS


def test_connection_run_feedback_is_stateful_and_motion_safe():
    assert "function connectionRunState(" in CANVAS_JS
    assert "function beginNodeRunState(" in CANVAS_JS
    assert "node.runStatus = 'running'" in CANVAS_JS.split("function beginNodeRunState(", 1)[1].split("function", 1)[0]
    assert "node.runError = ''" in CANVAS_JS.split("function beginNodeRunState(", 1)[1].split("function", 1)[0]
    assert "beginNodeRunState(gen, !opts.cascade)" in CANVAS_JS
    assert "beginNodeRunState(node, !opts.cascade)" in CANVAS_JS
    assert "filter(item => !item?.failed || item?.querying)" in CANVAS_JS
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
