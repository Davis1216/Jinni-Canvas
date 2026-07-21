const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../static/js/canvas-interaction-rules.js');

test('image generators require an explicit image output choice', () => {
    assert.deepEqual(rules.allowedOutputKinds('generator', 'image'), ['single-image', 'image-group']);
    assert.deepEqual(rules.requiredOutputKinds('generator', 'image'), ['single-image', 'image-group']);
});

test('video and LTX Director only accept general output', () => {
    assert.deepEqual(rules.allowedOutputKinds('video', 'general'), ['general']);
    assert.deepEqual(rules.requiredOutputKinds('ltxDirector', 'general'), ['general']);
});

test('dynamic RunningHub workflows require a lossless general output', () => {
    assert.deepEqual(rules.allowedOutputKinds('rh', 'unknown'), ['single-image', 'image-group', 'general']);
    assert.deepEqual(rules.requiredOutputKinds('rh', 'unknown'), ['general']);
    assert.deepEqual(rules.requiredOutputKinds('rh', 'video'), ['general']);
});

test('known RunningHub image workflows preserve single/group choice', () => {
    assert.deepEqual(rules.requiredOutputKinds('rh', 'image'), ['single-image', 'image-group']);
    assert.equal(rules.inferWorkflowOutputMediaKind({'1': {class_type: 'SaveImage'}}), 'image');
    assert.equal(rules.inferWorkflowOutputMediaKind({'1': {class_type: 'VHS_VideoCombine'}, '2': {class_type: 'PreviewImage'}}), 'general');
    assert.equal(rules.inferWorkflowOutputMediaKind({'1': {class_type: 'KSampler'}}), 'unknown');
});

test('viewport scale is finite and clamped', () => {
    assert.equal(rules.clampViewportScale(0), 1);
    assert.equal(rules.clampViewportScale(0.001), rules.VIEWPORT_MIN_SCALE);
    assert.equal(rules.clampViewportScale(99), rules.VIEWPORT_MAX_SCALE);
    assert.equal(rules.clampViewportScale(1.25), 1.25);
});

test('LLM accepts either text or connected media as request input', () => {
    assert.equal(rules.hasLLMRequestInput('describe this', [], []), true);
    assert.equal(rules.hasLLMRequestInput('', ['/assets/reference.png'], []), true);
    assert.equal(rules.hasLLMRequestInput('   ', [], ['/output/reference.mp4']), true);
    assert.equal(rules.hasLLMRequestInput('', [], []), false);
});
