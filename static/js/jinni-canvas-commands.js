(() => {
    const shortcuts=window.JinniShortcuts;let settingsOpen=false;const heldKeys={};
    const specs=[['image','addImageNode()'],['prompt','addPromptNode()'],['loop','addLoopNode()'],['output','#toolbarOutputBtn'],['llm','addLLMNode()'],['generate','addGeneratorNode()'],['video','addVideoNode()'],['group','groupSelectedImages()'],['effects','#canvasEffectsToggle'],['transfer','#workflowTransferToggle'],['library','#canvasAssetToggle'],['logs','#canvasLogToggle'],['undo','#dockUndoBtn'],['redo','#dockRedoBtn'],['delete','#dockDeleteBtn'],['fit','#fitViewBtn'],['zoomIn','#zoomInBtn'],['zoomOut','#zoomOutBtn'],['zoomReset','#zoomResetBtn']];
    const buttons={};for(const [id,selector] of specs){const button=selector.startsWith('#')?document.querySelector(selector):document.querySelector(`[onclick="${selector}"]`);if(button){buttons[id]=button;button.dataset.command=id}}
    const all=document.createElement('button');all.type='button';all.className='tool-btn';all.innerHTML='<i data-lucide="square-dashed-mouse-pointer" class="w-4 h-4"></i>';all.dataset.command='selectAll';document.querySelector('.dock-action-group')?.prepend(all);buttons.selectAll=all;
    function selectAll(){if(!canvas)return;selected.clear();nodes.forEach(n=>selected.add(n.id));window.getSelection()?.removeAllRanges();refreshSelectionVisuals();renderSelectionHub()}
    all.onclick=selectAll;window.selectAllCanvasNodes=selectAll;
    function tooltips(){for(const [id,button] of Object.entries(buttons)){const name=shortcuts.definitions.find(d=>d[0]===id)?.[1]||id;const label=`${name} · ${shortcuts.label(shortcuts.state.bindings[id])}${shortcuts.state.enabled?'':' · 快捷键已关闭'}`;button.title=label;button.dataset.label=label;button.setAttribute('aria-label',label)}}
    window.addEventListener('jinni-shortcuts-change',tooltips);tooltips();window.lucide?.createIcons();
    const actions={selectAll,settings:()=>{if(parent!==window)parent.postMessage({type:'jinni-open-settings'},location.origin);else window.openJinniSettings?.()},copy:copySelectedNodes,paste:()=>{const time=Date.now();setTimeout(()=>{if(canvas&&lastImagePasteAt<time&&clipboardNodeCount())pasteNodes()},90)},zoomIn:()=>zoomStep(1),zoomOut:()=>zoomStep(-1),zoomReset:resetZoomTo100,fit:()=>fitAllNodesViewportSmooth(true),preview:toggleZoomPreview,undo:performUndo,redo:performRedo,delete:deleteSelectedNodes};
    for(const [id,button] of Object.entries(buttons))if(!actions[id])actions[id]=()=>button.click();
    function blocked(){return settingsOpen||document.hidden||!!window.frameElement?.ownerDocument.querySelector('dialog[open]')||(window.frameElement && getComputedStyle(window.frameElement).visibility==='hidden')||!!document.querySelector('dialog[open],.output-lightbox.open,.error-modal.open,#assetManagerModal.open,#logModal.open,#workflowTransferModal.open,#imageEditModal.open,#promptTemplateModal.open,#canvasEffectsPanel:not([hidden]),.canvas-asset-panel.open')}
    window.jinniCanvasKeyboardBlocked=blocked;
    window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='jinni-settings-state'){settingsOpen=!!e.data.open;isKnifeKeyDown=false;isRKeyDown=false;isSpaceDown=false;setKnifeMode(false)}if(e.data?.type==='jinni-shortcuts-update')shortcuts.apply(e.data.preferences)});
    window.addEventListener('keydown',e=>{
        if(!canvas||shortcuts.editable(e.target)||shortcuts.editable(document.activeElement)||e.isComposing)return;
        if(blocked())return;
        const key=shortcuts.normalize(e),enabled=shortcuts.ready&&shortcuts.state.enabled;
        if(key==='Mod+A'){e.preventDefault();window.getSelection()?.removeAllRanges()}
        if(!enabled){if(e.key!=='Escape')e.stopImmediatePropagation();return}
        let id=Object.keys(shortcuts.state.bindings).find(id=>shortcuts.state.bindings[id]===key);
        if(!id&&!shortcuts.mac&&key==='Mod+Y'&&shortcuts.state.bindings.redo===shortcuts.defaults.redo)id='redo';
        if(!id&&key==='Shift+1'&&shortcuts.state.bindings.fit===shortcuts.defaults.fit)id='fit';
        if(!id)return;
        if(id==='copy'&&window.getSelection()?.toString())return;
        if(id!=='paste')e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
        if(['knife','pan','selection'].includes(id))heldKeys[id]=e.code||e.key;
        if(id==='knife'){isKnifeKeyDown=true;setKnifeMode(true);return}
        if(id==='pan'){isSpaceDown=true;return}
        if(id==='selection'){isRKeyDown=true;return}
        actions[id]?.();
    },true);
    window.addEventListener('keyup',e=>{const key=shortcuts.normalize(e);if(key===shortcuts.state.bindings.knife||heldKeys.knife===(e.code||e.key)){isKnifeKeyDown=false;if(knifeActive)endDrag();setKnifeMode(false)}if(key===shortcuts.state.bindings.pan||heldKeys.pan===(e.code||e.key))isSpaceDown=false;if(key===shortcuts.state.bindings.selection||heldKeys.selection===(e.code||e.key))isRKeyDown=false},true);
    window.addEventListener('blur',()=>{isKnifeKeyDown=false;isSpaceDown=false;isRKeyDown=false;setKnifeMode(false)});
    if(parent===window){const script=document.createElement('script');script.src='/static/js/jinni-settings.js';script.onload=()=>{const gear=document.createElement('button');gear.textContent='⚙';gear.title='设置';gear.style.cssText='position:fixed;left:16px;bottom:16px;z-index:90;border-radius:14px;padding:12px;background:var(--panel,#fff);color:var(--ink,#222);border:1px solid var(--line,#ddd)';gear.onclick=()=>window.openJinniSettings();document.body.append(gear)};document.body.append(script)}
    if(parent!==window)parent.postMessage({type:'jinni-canvas-ready'},location.origin);
})();
