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
