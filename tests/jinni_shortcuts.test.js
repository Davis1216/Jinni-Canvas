const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('static/js/jinni-shortcuts.js','utf8');
function context(platform){const window={dispatchEvent(){}};vm.runInNewContext(source,{window,navigator:{platform},fetch:()=>new Promise(()=>{}),CustomEvent:class{},console});return window.JinniShortcuts;}
for(const [platform,modifier,label] of [['MacIntel','metaKey','Cmd'],['Win32','ctrlKey','Ctrl']]){
 test(`${platform} normalizes platform modifiers and validates conflicts`,()=>{
  const api=context(platform);
  assert.equal(api.normalize({key:'a',[modifier]:true}), 'Mod+A');
  assert.equal(api.label('Mod+A'),`${label}+A`);
  assert.equal(api.defaults.delete,platform==='MacIntel'?'Backspace':'Delete');
  assert.doesNotThrow(()=>api.validate({bindings:api.defaults}));
  assert.throws(()=>api.validate({bindings:{...api.defaults,image:'P'}}),/冲突/);
  assert.throws(()=>api.validate({bindings:{...api.defaults,image:'Alt+F4'}}),/保留/);
  for (const key of ['Mod+B','Mod+O','Mod+M','Mod+F','Mod+H']) assert.throws(()=>api.validate({bindings:{...api.defaults,image:key}}),/保留/);
  assert.doesNotThrow(()=>api.validate({bindings:{...api.defaults,image:''}}));
  assert.equal(api.normalize({key:'!',code:'Digit1',shiftKey:true}), 'Shift+1');
 });
}
