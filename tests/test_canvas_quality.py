import main


def provider(protocol="openai", mode="openai", provider_id="custom"):
    return {
        "id": provider_id,
        "name": provider_id,
        "protocol": protocol,
        "image_request_mode": mode,
        "base_url": "https://example.test/v1",
    }


def test_image_quality_support_matches_actual_request_transports():
    assert main.image_quality_parameter_supported(provider(), "gpt-image-2")
    assert main.image_quality_parameter_supported(provider(mode="openai-responses"), "gpt-image-2")
    for mode in ("openai-chat", "openai-json", "openai-video-proxy"):
        assert not main.image_quality_parameter_supported(provider(mode=mode), "image-model")
    for protocol in ("gemini", "gemini-cli", "jimeng", "runninghub", "volcengine", "apimart", "codex"):
        assert not main.image_quality_parameter_supported(provider(protocol=protocol), "image-model")
    assert not main.image_quality_parameter_supported(provider(provider_id="modelscope"), "image-model")


def test_public_provider_exposes_per_model_quality_capability():
    item = provider()
    item.update({"image_models": ["gpt-image-2"], "chat_models": [], "video_models": [], "enabled": True})
    public = main.public_provider(item)
    assert public["image_quality_support"] == {"gpt-image-2": True}


def test_online_image_request_preserves_reference_source_and_display_prompt():
    request = main.OnlineImageRequest(
        prompt="参考图映射：\n图1：图片1\n\n用户要求：\n让图1作为主体",
        display_prompt="让@图片1作为主体",
        reference_images=[{"url": "/assets/input/ref.png", "name": "图片1", "source_id": "online-ref-1"}],
    )
    assert request.display_prompt == "让@图片1作为主体"
    assert request.reference_images[0].source_id == "online-ref-1"
