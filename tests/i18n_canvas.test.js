const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global;
global.localStorage = {
    values: new Map([['studio_lang', 'zh']]),
    getItem(key){ return this.values.get(key) || null; },
    setItem(key, value){ this.values.set(key, String(value)); }
};
global.document = {
    addEventListener(){},
    documentElement:{setAttribute(){}},
    querySelectorAll(){ return []; }
};
global.CustomEvent = class CustomEvent {
    constructor(type, init){ this.type = type; this.detail = init?.detail; }
};
global.dispatchEvent = () => {};

require('../static/js/i18n-core.js');
require('../static/js/i18n/canvas.js');

test('new output node labels are registered in both languages', () => {
    assert.equal(StudioI18n.t('canvas.output'), '输出');
    assert.equal(StudioI18n.t('canvas.outputSingle'), '单图输出');
    assert.equal(StudioI18n.t('canvas.outputGroup'), '图组输出');
    assert.equal(StudioI18n.t('canvas.outputGeneral'), '通用输出');
    StudioI18n.set('en');
    assert.equal(StudioI18n.t('canvas.outputSingle'), 'Single Image Output');
    StudioI18n.set('zh');
});

test('missing keys do not overwrite readable HTML fallback text', () => {
    const label = {dataset:{i18n:'canvas.futureLabel'}, textContent:'可读文案'};
    const root = {
        querySelectorAll(selector){ return selector === '[data-i18n]' ? [label] : []; },
        documentElement:{setAttribute(){}}
    };
    StudioI18n.apply(root);
    assert.equal(label.textContent, '可读文案');
});
