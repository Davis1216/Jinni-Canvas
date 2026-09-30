(()=>{function update(el){if(el?.matches?.('input[type="range"]')){const min=Number(el.min||0),max=Number(el.max||100);el.style.setProperty('--range-progress',`${Math.max(0,Math.min(100,(Number(el.value)-min)/(max-min||1)*100))}%`)}}window.JinniRange={update};document.addEventListener('input',e=>update(e.target));document.addEventListener('change',e=>update(e.target));const scan=root=>{update(root);root.querySelectorAll?.('input[type="range"]').forEach(update)};scan(document);new MutationObserver(records=>records.forEach(r=>{if(r.type==='attributes')update(r.target);else r.addedNodes.forEach(scan)})).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['value','min','max']});})();
// Native menu equivalents must reach the focused canvas before WebKit selects page text.
window.JinniNativeKey = function(key, shift=false){
    let context=window;
    try { while(context.document.activeElement?.tagName==='IFRAME') context=context.document.activeElement.contentWindow; } catch(e){ return false; }
    if(context.JinniSettingsCaptureKey?.(key,shift))return true;
    if(key==='+')key='=';
    if(!context.selectAllCanvasNodes || context.JinniShortcuts?.editable(context.document.activeElement) || context.jinniCanvasKeyboardBlocked?.())return false;
    const event=new context.KeyboardEvent('keydown',{key,metaKey:true,shiftKey:shift,bubbles:true,cancelable:true});
    context.document.activeElement.dispatchEvent(event);
    // Paste still needs WebKit's clipboard event for files; node paste is scheduled by the command.
    return key!=='v';
};
