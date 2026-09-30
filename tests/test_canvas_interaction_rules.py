import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CANVAS_JS = (ROOT / "static" / "js" / "canvas.js").read_text(encoding="utf-8")
CANVAS_CSS = (ROOT / "static" / "css" / "canvas.css").read_text(encoding="utf-8")
CANVAS_HTML = (ROOT / "static" / "canvas.html").read_text(encoding="utf-8")


class CanvasInteractionRuleTests(unittest.TestCase):
    def test_output_and_zoom_rules_execute_in_node(self):
        result = subprocess.run(
            ["node", "--test", "tests/canvas_interaction_rules.test.js", "tests/i18n_canvas.test.js"],
            cwd=ROOT,
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_connection_hover_uses_svg_hit_targets_not_global_geometry_sampling(self):
        self.assertNotIn("function connectionDistanceToPoint(", CANVAS_JS)
        self.assertNotIn("function updateConnectionHoverFromMouse(", CANVAS_JS)
        self.assertIn("p.addEventListener('pointerenter'", CANVAS_JS)
        self.assertIn("p.setAttribute('tabindex', '0')", CANVAS_JS)

    def test_wheel_zoom_is_clamped_and_does_not_rebuild_links(self):
        wheel = CANVAS_JS.split("function handleCanvasWheel(e){", 1)[1].split("window.addEventListener('wheel'", 1)[0]
        self.assertIn("safeViewportScale", wheel)
        self.assertIn("scheduleViewportWheelRender", wheel)
        self.assertNotIn("renderLinks()", wheel)

    def test_canvas_controls_and_dialogs_expose_keyboard_semantics(self):
        self.assertIn('type="button" class="port in"', CANVAS_JS)
        self.assertIn("activateKeyboardPort", CANVAS_JS)
        self.assertIn("resizeNodeByKeyboard", CANVAS_JS)
        self.assertIn('role="dialog" aria-modal="true"', CANVAS_HTML)
        self.assertIn("trapCanvasDialogFocus", CANVAS_JS)
        self.assertIn(".output-del:focus-visible", CANVAS_CSS)
        self.assertIn("@media (hover:none), (pointer:coarse)", CANVAS_CSS)

    def test_output_choice_is_prominent_and_runninghub_config_is_lazy(self):
        self.assertIn('id="toolbarOutputBtn"', CANVAS_HTML)
        self.assertIn("openToolbarOutputMenu", CANVAS_JS)
        for label in ("单图输出", "图组输出", "通用输出"):
            self.assertIn(label, CANVAS_HTML)
        load_config = CANVAS_JS.split("async function loadConfig(){", 1)[1].split("// 监听 API 设置页面", 1)[0]
        self.assertNotIn("rhWorkflowIds", load_config)
        self.assertIn("ensureRunningHubWorkflowConfigForNode", CANVAS_JS)


if __name__ == "__main__":
    unittest.main()
