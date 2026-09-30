/* Canvas presentation only: preferences and effect lifetimes are independent of documents. */
(() => {
    'use strict';
    const board = document.getElementById('board');
    const layer = document.getElementById('canvasBackdrop');
    const shell = document.getElementById('shell');
    const dock = document.getElementById('quickToolbar');
    const toggle = document.getElementById('canvasEffectsToggle');
    const panel = document.getElementById('canvasEffectsPanel');
    if(!board || !layer || !dock || !panel || !toggle) return;
    const modes = [
        ['flow','流动点场','Flow','Flow'], ['liquid','液态以太','Liquid ether','LiquidEther'],
        ['floatingLines','浮动光线','Floating lines','FloatingLines'], ['galaxy','星系','Galaxy','Galaxy'],
        ['silk','丝绸','Silk','Silk'], ['waves','波浪','Waves','Waves'],
        ['dotField','互动点场','Dot field','DotField'], ['dotGrid','弹性点阵','Elastic dots','DotGrid'],
        ['shapeGrid','滚动方格','Moving grid','ShapeGrid'], ['faultyTerminal','数字终端','Terminal','FaultyTerminal'],
        ['dots','经典点阵','Dots'], ['lines','网格线','Lines'], ['blank','空白','Blank']
    ];
    const key = 'jinni_canvas_appearance_v1';
    let prefs = {mode:'flow', intensity:0.7, motion:true};
    try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null');
        if(saved && modes.some(item => item[0] === saved.mode)) prefs.mode = saved.mode;
        if(Number.isFinite(saved?.intensity)) prefs.intensity = Math.max(.25, Math.min(1,saved.intensity));
        if(typeof saved?.motion === 'boolean') prefs.motion = saved.motion;
    } catch(_) {}
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    const english = () => window.StudioI18n?.lang?.() === 'en';
    const label = (zh,en) => english() ? en : zh;
    let active = null;
    let signature = '';
    let destroyed = false;
    let failedMode = '';
    let frameElement = null;
    try { frameElement = window.frameElement; } catch(_) {}
    const visible = () => !document.hidden && !shell.classList.contains('no-canvas') &&
        (!frameElement || (getComputedStyle(frameElement).visibility !== 'hidden' && getComputedStyle(frameElement).display !== 'none'));
    const motionEnabled = () => prefs.motion && !reduced.matches;
    const save = () => { try { localStorage.setItem(key,JSON.stringify(prefs)); } catch(_) {} };

    // Own all resources, including partially initialized or failed renderers.
    function createRuntime(onError){
        const frames = new Set(), observers = [], listeners = [], contexts = new Set();
        let stopped = false;
        const runtime = {
            requestFrame(callback){
                if(stopped) return 0;
                let id;
                const tick = now => {
                    if(stopped) return;
                    frames.delete(id);
                    try { callback(now); } catch(error) { onError(error); }
                };
                id = requestAnimationFrame(tick);
                frames.add(id);
                return id;
            },
            cancelFrame(id){ cancelAnimationFrame(id); frames.delete(id); },
            observe(callback){
                const observer = new ResizeObserver(entries => { if(!stopped) { try { callback(entries); } catch(error) { onError(error); } } });
                observers.push(observer);
                return observer;
            },
            listen(target,type,callback,options){
                target.addEventListener(type,callback,options);
                listeners.push([target,type,callback,options]);
            },
            context(canvas,type,options){
                const context = canvas.getContext(type,options);
                if(context && type.startsWith('webgl')) contexts.add(context);
                return context;
            },
            dispose(){
                stopped = true;
                frames.forEach(cancelAnimationFrame); frames.clear();
                observers.forEach(observer => observer.disconnect());
                listeners.forEach(args => args[0].removeEventListener(...args.slice(1)));
                contexts.forEach(context => { if(!context.isContextLost()) context.getExtension('WEBGL_lose_context')?.loseContext(); });
            },
            counts(){ return {frames:frames.size,listeners:listeners.length,observers:observers.length}; }
        };
        return runtime;
    }
    function stopBackground(){
        if(!active) return;
        const previous = active;
        active = null;
        previous.canvas.removeEventListener('webglcontextlost',previous.onLost);
        try { previous.dispose?.(); } catch(_) {}
        previous.runtime.dispose();
        previous.canvas.remove();
    }
    function startBackground(mode){
        const definition = modes.find(item => item[0] === mode);
        const renderer = window.JinniCanvasBackgrounds?.[`mount${definition?.[3]}Background`];
        if(!renderer) return false;
        const canvas = document.createElement('canvas');
        canvas.className = 'canvas-effect-surface';
        canvas.setAttribute('aria-hidden','true');
        layer.appendChild(canvas);
        const fail = () => {
            if(destroyed || active?.canvas !== canvas) return;
            failedMode = prefs.mode;
            stopBackground();
            layer.dataset.renderMode = 'dots';
            updateStatus();
        };
        const runtime = createRuntime(fail);
        const onLost = event => { event.preventDefault(); fail(); };
        canvas.addEventListener('webglcontextlost',onLost);
        active = {canvas,runtime,onLost,dispose:null};
        try {
            const dispose = renderer(canvas,runtime);
            if(typeof dispose !== 'function') { fail(); return false; }
            active.dispose = dispose;
            return true;
        } catch(_) { fail(); return false; }
    }
    function updateStatus(){
        const status = panel.querySelector('.canvas-effects-status');
        status.textContent = failedMode === prefs.mode
            ? label('此背景暂不可用，已显示经典点阵。','This background is unavailable. Showing dots.')
            : reduced.matches ? label('已跟随系统减少动态效果。','Following system reduced motion.')
            : !prefs.motion ? label('动态效果已暂停。','Motion is paused.')
            : label('移动鼠标与背景互动，弹性点阵支持点击涟漪。','Move the pointer to interact. Elastic dots also react to clicks.');
    }
    function sync(force=false){
        if(destroyed) return;
        const isVisible = visible();
        const moving = motionEnabled();
        const dark = document.documentElement.classList.contains('theme-dark');
        const next = `${prefs.mode}/${moving}/${isVisible}/${dark}`;
        layer.style.setProperty('--effect-intensity',String(prefs.intensity));
        shell.classList.toggle('canvas-effects-paused',!isVisible || !moving);
        if(force || next !== signature){
            signature = next;
            stopBackground();
            const dynamic = Boolean(modes.find(item => item[0] === prefs.mode)?.[3]);
            layer.dataset.mode = prefs.mode;
            layer.dataset.renderMode = dynamic ? 'dots' : prefs.mode;
            if(isVisible && moving && dynamic){
                failedMode = '';
                if(startBackground(prefs.mode)) layer.dataset.renderMode = prefs.mode;
            }
            if(!moving || !isVisible) resetDock();
        }
        updateStatus();
    }
    function choose(mode){
        if(!modes.some(item => item[0] === mode)) return;
        prefs.mode = mode;
        save();
        panel.querySelectorAll('[data-effect-mode]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.effectMode === mode)));
        sync(true);
    }
    panel.innerHTML = `<div class="canvas-effects-heading"><strong>${label('画布背景与动效','Background & motion')}</strong><button type="button" class="canvas-effects-close" aria-label="${label('关闭','Close')}">×</button></div>
        <div class="canvas-effects-options">${modes.map(([mode,zh,en]) => `<button type="button" data-effect-mode="${mode}" aria-pressed="${mode === prefs.mode}"><span class="effect-swatch effect-swatch-${mode}" aria-hidden="true"></span><span>${label(zh,en)}</span></button>`).join('')}</div>
        <label class="canvas-effects-setting"><span>${label('背景强度','Intensity')}</span><input id="canvasEffectIntensity" type="range" min="25" max="100" step="5" value="${prefs.intensity*100}"><output>${Math.round(prefs.intensity*100)}%</output></label>
        <label class="canvas-effects-setting"><span>${label('动态背景与交互动画','Background & interaction motion')}</span><input id="canvasEffectMotion" type="checkbox" ${prefs.motion ? 'checked' : ''}></label>
        <p class="canvas-effects-status" role="status"></p>`;
    const intensity = panel.querySelector('#canvasEffectIntensity');
    intensity.addEventListener('input',() => {
        prefs.intensity = Number(intensity.value)/100;
        panel.querySelector('output').value = `${intensity.value}%`;
        layer.style.setProperty('--effect-intensity',String(prefs.intensity));
        save();
    });
    panel.querySelector('#canvasEffectMotion').addEventListener('change',event => { prefs.motion = event.target.checked; save(); sync(); });
    panel.querySelectorAll('[data-effect-mode]').forEach(button => button.addEventListener('click',() => choose(button.dataset.effectMode)));
    ['mousedown','click','dblclick','contextmenu'].forEach(type => panel.addEventListener(type,event => event.stopPropagation()));
    toggle.addEventListener('mousedown',event => event.stopPropagation());
    function closePanel(focus=false){ panel.hidden = true; toggle.setAttribute('aria-expanded','false'); if(focus) toggle.focus(); }
    toggle.addEventListener('click',() => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute('aria-expanded',String(!panel.hidden));
        if(!panel.hidden) panel.querySelector(`[data-effect-mode="${prefs.mode}"]`).focus();
    });
    panel.querySelector('.canvas-effects-close').addEventListener('click',() => closePanel(true));
    panel.addEventListener('keydown',event => {
        event.stopPropagation();
        if(event.key === 'Escape'){ event.preventDefault(); closePanel(true); }
        if(event.key === 'Tab'){
            const items = [...panel.querySelectorAll('button,input')];
            const next = items[(items.indexOf(document.activeElement)+(event.shiftKey ? -1 : 1)+items.length)%items.length];
            event.preventDefault(); next.focus();
        }
    });
    const outside = event => { if(!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target)) closePanel(); };
    document.addEventListener('pointerdown',outside,true);

    // Spring-mass Dock inspired by the reference. Animate icons inside fixed hit areas.
    let dockFrame = 0, dockLast = 0, tiles = [], pointer = null;
    function captureDock(){
        tiles = [...dock.querySelectorAll('button')].filter(button => button.offsetWidth > 0).map(button => {
            const rect = button.getBoundingClientRect();
            return {icon:button.querySelector('svg'),x:rect.left+rect.width/2,y:rect.top+rect.height/2,size:1,velocity:0};
        });
    }
    function resetDock(){
        cancelAnimationFrame(dockFrame); dockFrame = 0;
        tiles.forEach(tile => tile.icon?.style.removeProperty('transform'));
        dock.querySelectorAll('.canvas-dock-ripple').forEach(ring => { ring.getAnimations().forEach(animation => animation.cancel()); ring.remove(); });
        pointer = null;
    }
    function dockStep(now){
        const dt = Math.min(.034,Math.max(.001,(now-dockLast)/1000));
        dockLast = now;
        let settled = true;
        for(const tile of tiles){
            const distance = pointer ? Math.hypot(pointer.x-tile.x,(pointer.y-tile.y)*2) : Infinity;
            const target = 1 + .42*Math.max(0,1-distance/110);
            tile.velocity += ((170*(target-tile.size)-16*tile.velocity)/.5)*dt;
            tile.velocity = Math.max(-5,Math.min(5,tile.velocity));
            tile.size = Math.max(.98,Math.min(1.48,tile.size+tile.velocity*dt));
            if(Math.abs(target-tile.size)>.002 || Math.abs(tile.velocity)>.015) settled = false;
            else { tile.size = target; tile.velocity = 0; }
            if(tile.icon) tile.icon.style.transform = `translateY(${-(tile.size-1)*10}px) scale(${tile.size})`;
        }
        dockFrame = settled ? 0 : requestAnimationFrame(dockStep);
    }
    function wakeDock(){ if(!dockFrame){ dockLast = performance.now(); dockFrame = requestAnimationFrame(dockStep); } }
    const enterDock = () => { resetDock(); captureDock(); };
    const moveDock = event => {
        if(!motionEnabled() || !finePointer.matches || !visible()) return;
        pointer = {x:event.clientX,y:event.clientY}; wakeDock();
    };
    const leaveDock = () => { pointer = null; if(motionEnabled()) wakeDock(); };
    dock.addEventListener('pointerenter',enterDock);
    dock.addEventListener('pointermove',moveDock);
    dock.addEventListener('pointerleave',leaveDock);
    const pressDock = event => {
        const button = event.target.closest('button');
        if(!button || button.disabled || !motionEnabled()) return;
        const ring = document.createElement('i');
        ring.className = 'canvas-dock-ripple'; ring.setAttribute('aria-hidden','true');
        button.appendChild(ring);
        const animation = ring.animate([{transform:'scale(.35)',opacity:.55},{transform:'scale(1.15)',opacity:0}],{duration:360,easing:'cubic-bezier(.2,.7,.3,1)'});
        animation.finished.then(() => ring.remove(),() => ring.remove());
    };
    dock.addEventListener('click',pressDock);
    const refresh = () => sync();
    const resize = () => { resetDock(); captureDock(); };
    const theme = () => sync(true);
    const observer = new MutationObserver(refresh);
    observer.observe(shell,{attributes:true,attributeFilter:['class']});
    if(frameElement) observer.observe(frameElement,{attributes:true,attributeFilter:['class','style','hidden']});
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('studio-theme-change',theme);
    window.addEventListener('resize',resize);
    reduced.addEventListener('change',refresh);
    const onPageHide = () => { stopBackground(); resetDock(); signature = ''; };
    window.addEventListener('pagehide',onPageHide);
    window.addEventListener('pageshow',refresh);
    window.JinniCanvasEffects = {
        setMode:choose,
        getState:() => ({...prefs,renderMode:layer.dataset.renderMode,active:Boolean(active),visible:visible(),reduced:reduced.matches,resources:active?.runtime.counts() || {frames:0,listeners:0,observers:0},dockAnimating:Boolean(dockFrame)}),
        destroy(){
            destroyed = true; stopBackground(); resetDock(); observer.disconnect();
            document.removeEventListener('visibilitychange',refresh);
            document.removeEventListener('pointerdown',outside,true);
            window.removeEventListener('studio-theme-change',theme);
            window.removeEventListener('resize',resize);
            window.removeEventListener('pagehide',onPageHide);
            window.removeEventListener('pageshow',refresh);
            reduced.removeEventListener('change',refresh);
            dock.removeEventListener('pointerenter',enterDock); dock.removeEventListener('pointermove',moveDock);
            dock.removeEventListener('pointerleave',leaveDock); dock.removeEventListener('click',pressDock);
        }
    };
    sync();
})();
