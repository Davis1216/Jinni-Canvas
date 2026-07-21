import unittest

from main import CanvasLLMRequest, canvas_llm_has_usable_input, canvas_llm_media_inputs


class CanvasLLMInputTests(unittest.TestCase):
    def test_image_and_system_prompt_do_not_require_user_prompt(self):
        payload = CanvasLLMRequest(
            message="",
            system_prompt="请根据系统要求分析图片。",
            images=["https://example.com/reference.png"],
        )
        self.assertTrue(canvas_llm_has_usable_input(payload))
        self.assertEqual(canvas_llm_media_inputs(payload), (["https://example.com/reference.png"], []))

    def test_text_only_request_remains_valid(self):
        payload = CanvasLLMRequest(message="整理这段文字")
        self.assertTrue(canvas_llm_has_usable_input(payload))

    def test_empty_request_is_rejected_by_preflight(self):
        payload = CanvasLLMRequest(message="   ", system_prompt="仅有系统提示词")
        self.assertFalse(canvas_llm_has_usable_input(payload))


if __name__ == "__main__":
    unittest.main()
