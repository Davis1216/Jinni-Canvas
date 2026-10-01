(function(root, factory){
    const api = factory();
    if(typeof module === 'object' && module.exports) module.exports = api;
    if(root) root.CanvasInteractionRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
    const OUTPUT_KINDS = Object.freeze(['single-image', 'image-group', 'text', 'video', 'general']);
    const VIEWPORT_MIN_SCALE = 0.06;
    const VIEWPORT_MAX_SCALE = 3;

    function normalizeMediaKind(value){
        const kind = String(value || '').trim().toLowerCase();
        if(['image', 'images', 'picture', 'photo'].includes(kind)) return 'image';
        if(['video', 'audio', 'file', 'files', 'text', 'mixed', 'general'].includes(kind)) return 'general';
        return 'unknown';
    }

    function allowedOutputKinds(nodeType, mediaKind='unknown'){
        if(nodeType === 'llm') return ['text','general'];
        if(nodeType === 'video' || nodeType === 'ltxDirector') return ['video','general'];
        if(nodeType === 'rh') return [...OUTPUT_KINDS];
        if(['generator', 'msgen', 'comfy'].includes(nodeType)) return ['single-image', 'image-group'];
        return [];
    }

    function requiredOutputKinds(nodeType, mediaKind='unknown'){
        if(nodeType === 'rh') return normalizeMediaKind(mediaKind) === 'image'
            ? ['single-image', 'image-group']
            : ['general'];
        return allowedOutputKinds(nodeType, mediaKind);
    }

    function inferWorkflowOutputMediaKind(workflow){
        if(!workflow || typeof workflow !== 'object') return 'unknown';
        const sinkTypes = Object.values(workflow).map(item => String(item?.class_type || item?.type || item?._meta?.title || '').toLowerCase());
        const hasVideo = sinkTypes.some(type => /save.?video|video.?combine|video.?output|vhs.*video|animated.?webp/.test(type));
        const hasAudio = sinkTypes.some(type => /save.?audio|audio.?combine|audio.?output/.test(type));
        const hasFile = sinkTypes.some(type => /save.?file|file.?output/.test(type));
        const hasImage = sinkTypes.some(type => /save.?image|preview.?image|image.?output/.test(type));
        if(hasVideo || hasAudio || hasFile) return 'general';
        return hasImage ? 'image' : 'unknown';
    }

    function clampViewportScale(value, fallback=1){
        const number = Number(value);
        const safe = Number.isFinite(number) && number > 0 ? number : Number(fallback) || 1;
        return Math.max(VIEWPORT_MIN_SCALE, Math.min(VIEWPORT_MAX_SCALE, safe));
    }

    function hasLLMRequestInput(message, images=[], videos=[]){
        if(String(message || '').trim()) return true;
        const hasMedia = values => Array.isArray(values) && values.some(value => String(value || '').trim());
        return hasMedia(images) || hasMedia(videos);
    }

    return {
        OUTPUT_KINDS,
        VIEWPORT_MIN_SCALE,
        VIEWPORT_MAX_SCALE,
        normalizeMediaKind,
        allowedOutputKinds,
        requiredOutputKinds,
        inferWorkflowOutputMediaKind,
        clampViewportScale,
        hasLLMRequestInput
    };
});
