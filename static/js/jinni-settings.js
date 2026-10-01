(() => {
    const keys=window.JinniShortcuts; let draft,dirty=false,capture=null,previousFocus=null;
    const dialog=document.createElement('dialog');dialog.id='jinniSettings';dialog.className='jinni-dialog';dialog.setAttribute('aria-label','设置');
    dialog.innerHTML=`
        <div class="jinni-settings-layout">
            <nav class="jinni-settings-nav" aria-label="设置项目">
                <strong>设置</strong>
                <button data-page="providers" class="active">供应商配置</button>
                <button data-page="shortcuts">快捷键配置</button>
                <button data-page="about">关于</button>
            </nav>
            <section class="jinni-settings-main">
                <header class="jinni-settings-head"><h2>供应商配置</h2><button data-close aria-label="关闭设置">✕</button></header>
                <div class="jinni-settings-page providers" data-content="providers"></div>
                <div class="jinni-settings-page jinni-shortcuts-page" data-content="shortcuts" hidden>
                    <div class="jinni-shortcuts-intro">
                        <label class="jinni-toggle-row" for="jinniKeysEnabled"><span><strong>启用快捷键</strong><small>关闭后仍可使用工具栏按钮。</small></span><input type="checkbox" id="jinniKeysEnabled" role="switch"></label>
                        <p class="jinni-description">点击键位即可修改，按 Esc 取消录入。编辑文字或打开弹窗时，画布快捷键暂停生效。</p>
                    </div>
                    <div id="jinniKeyRows" aria-label="功能与快捷键"></div>
                    <footer class="jinni-settings-footer">
                        <p class="jinni-message" role="status"></p>
                        <div class="jinni-actions"><button data-reset>恢复默认</button><div class="jinni-action-end"><button data-cancel>取消修改</button><button data-save class="jinni-primary">保存更改</button></div></div>
                    </footer>
                </div>
                <div class="jinni-settings-page" data-content="about" hidden>
                    <div class="jinni-about-heading"><span class="jinni-app-mark" aria-hidden="true">JC</span><div><h3>Jinni Canvas</h3><p class="jinni-description">你的无限创作画布</p></div></div>
                    <dl class="jinni-about-details"><div><dt>版本</dt><dd>v1.0.0</dd></div><div><dt>作者</dt><dd>Davis</dd></div><div><dt>联系方式</dt><dd>QQ1270034721</dd></div></dl>
                </div>
            </section>
        </div>`;
    document.body.append(dialog);
    const providerFrame=document.getElementById('frame-api-settings')||document.createElement('iframe');providerFrame.id='frame-api-settings';providerFrame.title='供应商配置';dialog.querySelector('[data-content="providers"]').append(providerFrame);
    const notify=(type,extra={})=>document.querySelectorAll('iframe').forEach(f=>{try{f.contentWindow.postMessage({type,...extra},location.origin)}catch(e){}});
    const message=(text,error=false)=>{const el=dialog.querySelector('.jinni-message');el.textContent=text;el.classList.toggle('jinni-error',error)};
    function providerDirty(){try{return !!providerFrame.contentWindow.JinniProviderDraft?.dirty}catch(e){return false}}
    function close(){capture=null;dialog.close();notify('jinni-settings-state',{open:false});previousFocus?.focus()}
    function rows(){
        const container=dialog.querySelector('#jinniKeyRows');
        const scrollTop=container.scrollTop;
        container.replaceChildren();
        for(const [id,name,key] of keys.definitions){
            const row=document.createElement('div');row.className='jinni-shortcut-row';
            const info=document.createElement('div');info.className='jinni-shortcut-info';
            const label=document.createElement('span');label.textContent=name;
            const def=document.createElement('small');def.textContent=`默认：${keys.label(key)}`;
            info.append(label,def);
            const button=document.createElement('button');button.className='binding';button.dataset.binding=id;
            button.textContent=capture===id?'按下快捷键…':keys.label(draft.bindings[id]);
            button.title=`修改「${name}」的快捷键`;button.setAttribute('aria-label',`${name}：${keys.label(draft.bindings[id])}，点击修改`);
            button.setAttribute('aria-pressed',String(capture===id));
            button.onclick=()=>{capture=id;rows();container.querySelector(`[data-binding="${id}"]`).focus({preventScroll:true});message('请按下新的快捷键，或按 Esc 取消。')};
            const clear=document.createElement('button');clear.className='jinni-clear-key';clear.textContent='清空';clear.setAttribute('aria-label',`清空「${name}」的快捷键`);
            clear.onclick=()=>{draft.bindings[id]='';capture=null;dirty=true;rows();message('键位已清空，保存后生效。')};
            row.append(info,button,clear);container.append(row);
        }
        container.scrollTop=scrollTop;
        dialog.querySelector('#jinniKeysEnabled').checked=draft.enabled;
    }
    function resetDraft(){draft=structuredClone(keys.state);dirty=false;capture=null;rows();message('修改后点击“保存更改”生效。')}
    window.openJinniSettings=async(page='providers')=>{if(!dialog.open){previousFocus=document.activeElement;if(!draft)resetDraft();dialog.showModal();notify('jinni-settings-state',{open:true});try{await keys.load();if(!dirty)resetDraft()}catch(e){message(e.message,true)}}showPage(page);};
    function showPage(page){capture=null;if(draft)rows();dialog.querySelectorAll('[data-content]').forEach(el=>el.hidden=el.dataset.content!==page);dialog.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));dialog.querySelector('h2').textContent={providers:'供应商配置',shortcuts:'快捷键配置',about:'关于'}[page];if(page==='providers'&&!providerFrame.getAttribute('src'))providerFrame.src='/static/api-settings.html?embedded=1';}
    dialog.querySelectorAll('[data-page]').forEach(el=>el.onclick=()=>showPage(el.dataset.page));dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();if(capture){capture=null;rows()}else close()});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
    dialog.querySelector('#jinniKeysEnabled').onchange=e=>{draft.enabled=e.target.checked;dirty=true};dialog.querySelector('[data-reset]').onclick=()=>{draft={enabled:true,bindings:{...keys.defaults}};dirty=true;capture=null;rows();message('已恢复默认键位，保存后生效。')};dialog.querySelector('[data-cancel]').onclick=()=>{if(!dirty||confirm('确认丢弃快捷键修改？'))resetDraft()};
    dialog.querySelector('[data-save]').onclick=async e=>{e.target.disabled=true;try{await keys.save(draft);dirty=false;notify('jinni-shortcuts-update',{preferences:keys.state});message('快捷键设置已保存。')}catch(error){message(error.message,true)}finally{e.target.disabled=false}};
    dialog.addEventListener('keydown',e=>{if(!capture)return;e.stopPropagation();if(e.key==='Escape'){e.preventDefault();capture=null;rows();return}if(e.isComposing||e.repeat)return;e.preventDefault();const key=keys.normalize(e);if(!key)return;try{const next=structuredClone(draft);next.bindings[capture]=key;keys.validate(next);draft=next;dirty=true;capture=null;rows();message('键位已修改，保存后生效。')}catch(error){message(error.message,true)}});
    document.addEventListener('keydown',e=>{if(!dialog.open&&!keys.editable(e.target)&&keys.state.enabled&&keys.normalize(e)===keys.state.bindings.settings){e.preventDefault();window.openJinniSettings()}});
    window.JinniSettingsCaptureKey=(key,shift)=>{if(!capture||!dialog.open)return false;dialog.dispatchEvent(new KeyboardEvent('keydown',{key,metaKey:true,shiftKey:shift,bubbles:true,cancelable:true}));return true};
    const originalSwitch=window.switchUI;if(originalSwitch)window.switchUI=function(el,page,...args){if(page==='api-settings'){window.openJinniSettings();return}return originalSwitch(el,page,...args)};
    const entry=document.querySelector('[onclick*="switchUI(this, \'api-settings\')"]');if(entry){entry.onclick=()=>window.openJinniSettings();entry.title='设置';entry.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 3-.7 2.1-2 .9-2.1-.5-2 3.5 1.5 1.6v2.3L2.2 15l2 3.5 2.1-.5 2 .9L9 21h4l.7-2.1 2-.9 2.1.5 2-3.5-1.5-2.1v-2.3L20 9l-2-3.5-2.1.5-2-.9L13 3z"/><circle cx="11" cy="12" r="3"/></svg><span class="side-pill-text">设置</span>'}
    window.addEventListener('message',e=>{if(e.origin!==location.origin)return;const frames=[...document.querySelectorAll('iframe')];if(!frames.some(f=>f.contentWindow===e.source))return;if(e.data?.type==='jinni-open-settings')window.openJinniSettings();if(e.data?.type==='jinni-close-settings')close();if(e.data?.type==='jinni-canvas-ready'&&dialog.open)notify('jinni-settings-state',{open:true})});
})();
