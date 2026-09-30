// Run against the local static server on 8766 with playwright-cli run-code.
async (page) => {
    const check = (value, message) => { if(!value) throw new Error(message); };
    const art = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#bdd3ea"/><stop offset="1" stop-color="#f2e5d7"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h720v480H0z"/><circle fill="#fff5dd" cx="520" cy="140" r="52"/><path fill="#7896ad" d="M0 320 190 140 440 420 590 220 720 340V480H0z"/><path fill="#426579" d="M0 420 240 280 440 460 720 330V480H0z"/></svg>');
    const fixture = {id:'visual-test',title:'山间日光 · 视觉创作',nodes:[
        {id:'reference',type:'image',x:80,y:120,w:360,h:320,url:art,name:'构图参考',natural_w:720,natural_h:480},
        {id:'prompt',type:'prompt',x:560,y:140,w:340,h:280,text:'清晨的远山，柔和的日光。\n保留开阔的构图与自然的色彩层次。'},
        {id:'generator',type:'generator',x:1020,y:120,w:320,h:430}
    ],connections:[{id:'ref-prompt',from:'reference',to:'prompt'},{id:'prompt-gen',from:'prompt',to:'generator'}]};
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.unroute('**/api/**');
    await page.route('**/api/**', route => route.fulfill({json:
        new URL(route.request().url()).pathname === '/api/canvases/visual-test' ? {canvas:fixture} : {}
    }));
    await page.setViewportSize({width:1440,height:900});
    await page.goto('http://127.0.0.1:8766/static/canvas.html?id=visual-test');
    await page.locator('#shell:not(.no-canvas)').waitFor();
    await page.waitForTimeout(400);
    const grid = await page.evaluate(() => {
        const saved = {...viewport};
        const samples = [];
        for(const scale of [.06,.125,.249999,.25,.250001,.499999,.5,.500001,1,2,3]){
            viewport = {x:-137.25,y:83.75,scale};
            applyViewport();
            const fine = getComputedStyle(canvasBackdrop, '::before');
            const coarse = getComputedStyle(canvasBackdrop, '::after');
            const size = parseFloat(fine.backgroundSize);
            const point = fine.backgroundPosition.split(' ').map(parseFloat);
            samples.push({scale,size,coarse:parseFloat(coarse.backgroundSize),alpha:Number(fine.opacity)+Number(coarse.opacity),
                phase:Math.abs((viewport.x-point[0])/size-Math.round((viewport.x-point[0])/size))});
        }
        viewport = saved;
        applyViewport();
        return {samples,pointerEvents:getComputedStyle(canvasBackdrop).pointerEvents,hit:document.elementFromPoint(200,100)?.id};
    });
    check(grid.samples.every(s => s.size >= 16 && s.size <= 32 && Math.abs(s.coarse-s.size*2)<.001 && Math.abs(s.alpha-1)<.0001 && s.phase<.0001), 'Grid must stay sparse and anchored across zoom levels');
    check(grid.pointerEvents === 'none' && grid.hit === 'board', 'Background must not intercept board interactions');
    // Exercise real node drag with the background present.
    const before = await page.evaluate(() => ({x:nodes[1].x,y:nodes[1].y,scale:viewport.scale}));
    const head = await page.locator('.node[data-id="prompt"] .node-head').boundingBox();
    await page.mouse.move(head.x+80,head.y+20);
    await page.mouse.down();
    await page.mouse.move(head.x+120,head.y+45,{steps:6});
    await page.mouse.up();
    const after = await page.evaluate(() => ({x:nodes[1].x,y:nodes[1].y}));
    check(Math.abs(after.x-before.x-40/before.scale)<1 && Math.abs(after.y-before.y-25/before.scale)<1, 'Background must not alter node dragging');
    const themes = [];
    for(const theme of ['light','dark']){
        await page.evaluate(theme => { StudioTheme.apply(theme); selected.add('prompt'); refreshSelectionVisuals(); },theme);
        await page.waitForTimeout(220);
        const state = await page.evaluate(() => ({
            background:getComputedStyle(canvasBackdrop).backgroundImage,
            border:getComputedStyle(nodesEl.querySelector('[data-id="prompt"]')).borderColor,
            link:getComputedStyle(linksEl.querySelector('.link-active')).stroke
        }));
        const accent = theme === 'light' ? 'rgb(59, 130, 246)' : 'rgb(96, 165, 250)';
        check(state.border === accent && state.link === accent, `Selection must survive shared ${theme} theme overrides`);
        themes.push(state);
        await page.screenshot({path:`output/playwright/canvas-visual-${theme}.png`});
    }
    check(themes[0].background !== themes[1].background, 'Background must respond to theme changes');
    await page.emulateMedia({reducedMotion:'reduce'});
    const reduced = await page.locator('#quickToolbar .tool-btn').first().evaluate(el => getComputedStyle(el).transitionDuration);
    check(reduced === '0s', 'Reduced motion must disable toolbar transitions');
    const idle = await page.evaluate(async () => {
        let changes = 0;
        const observer = new MutationObserver(records => changes += records.length);
        observer.observe(canvasBackdrop,{attributes:true,childList:true,subtree:true});
        await new Promise(resolve => setTimeout(resolve,350));
        observer.disconnect();
        return changes;
    });
    check(idle === 0, 'Idle background must not keep updating');
    check(errors.length === 0, errors.join('\n'));
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(() => StudioTheme.apply('light'));
    return {grid:grid.samples.length,backgroundHitTesting:true,nodeDrag:true,themeSelection:true,reducedMotion:true,idleUpdates:idle,runtimeErrors:errors};
}
