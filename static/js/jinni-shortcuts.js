/* Shared command definitions for the settings shell and canvas iframe. */
(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    const definitions = [
        ['image','上传图片','I'],['prompt','提示词','P'],['loop','循环','L'],['output','输出节点菜单','O'],
        ['llm','LLM 节点','M'],['generate','图像生成','G'],['video','视频生成','V'],['group','组合成组','Mod+G'],
        ['effects','背景与动效','E'],['transfer','导入导出工作流','W'],['library','素材库','B'],['logs','日志','J'],
        ['selectAll','全选工作流','Mod+A'],['undo','撤销','Mod+Z'],['redo','重做','Mod+Shift+Z'],
        ['delete','删除所选',mac?'Backspace':'Delete'],['settings','设置','Mod+,'],['copy','复制','Mod+C'],['paste','粘贴','Mod+V'],
        ['zoomIn','放大','Mod+='],['zoomOut','缩小','Mod+-'],['zoomReset','缩放至 100%','Mod+0'],
        ['fit','适配全部节点','F'],['preview','缩放预览','Z'],['knife','按住切断连线','K'],['pan','按住平移','Space'],['selection','按住框选','R']
    ];
    const defaults = Object.fromEntries(definitions.map(([id,,key])=>[id,key]));
    const reserved = new Set(['Mod+B','Mod+O','Mod+M','Mod+F','Mod+H','Mod+Q','Mod+W','Mod+T','Mod+N','Mod+R','Mod+L','Mod+Tab','Mod+Shift+T','Mod+Shift+N','Mod+Shift+W','Alt+F4','Mod+Space','Mod+Shift+3','Mod+Shift+4','Mod+Shift+5','Alt+Tab','Mod+Alt+Delete','Mod+Alt+Escape','Mod+Alt+Q','Mod+Shift+Q','Mod+Shift+R','Escape','Tab','Enter','Shift','Control','Meta','Alt']);
    let state={enabled:true,bindings:{...defaults}}, ready=false;
    const api = window.JinniShortcuts = {
        mac, definitions, defaults, reserved, handlesCanvasKeys:true,
        get state(){return state}, get ready(){return ready},
        normalize(event){
            if((mac&&event.ctrlKey)||(!mac&&event.metaKey))return '';
            let key=event.key===' '?'Space':event.key.length===1?event.key.toUpperCase():event.key;
            if(['Control','Meta','Alt','Shift'].includes(key))return '';
            if(event.code==='Digit1'&&event.shiftKey)key='1';
            if(key==='+' && event.code==='Equal')key='=';
            return [(mac?event.metaKey:event.ctrlKey)?'Mod':'',event.altKey?'Alt':'',event.shiftKey && key!=='='?'Shift':'',key].filter(Boolean).join('+');
        },
        label(key){return key?key.replace('Mod',mac?'Cmd':'Ctrl').replace('Backspace',mac?'Delete':'Backspace'):'未设置'},
        apply(value){state={enabled:value.enabled!==false,bindings:{...defaults,...value.bindings}};ready=true;window.dispatchEvent(new CustomEvent('jinni-shortcuts-change'));},
        async load(){const r=await fetch('/api/ui-preferences');if(!r.ok)throw Error('快捷键配置读取失败');api.apply(await r.json());return state},
        validate(value){const used=new Map();for(const [id,key] of Object.entries({...defaults,...value.bindings})){if(!key)continue;if(reserved.has(key))throw Error(`${api.label(key)} 是保留按键`);if(key==='Shift+1' && id!=='fit')throw Error('Shift+1 已用于适配视图');if(key==='Mod+Y' && id!=='redo')throw Error('Ctrl+Y 已用于重做');if(used.has(key))throw Error(`${api.label(key)} 与「${definitions.find(x=>x[0]===used.get(key))?.[1]}」冲突`);used.set(key,id)}},
        async save(value){api.validate(value);const r=await fetch('/api/ui-preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const result=await r.json();if(!r.ok)throw Error(result.detail||'保存失败');api.apply(result);return state},
        editable(target){return !!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')}
    };
    api.load().catch(error=>{console.warn(error.message);window.dispatchEvent(new CustomEvent('jinni-preferences-error',{detail:error.message}))});
})();
