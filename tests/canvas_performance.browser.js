// Local static server: python3 -m http.server 8766 --bind 127.0.0.1
// Run: playwright-cli run-code "$(cat tests/canvas_performance.browser.js)"
async (page) => {
    const check = (condition, message) => { if(!condition) throw new Error(message); };
    const fixture = {id:'perf',title:'性能验证',nodes:Array.from({length:120},(_,i)=>({id:'p'+i,type:'prompt',x:5000+(i%12)*400,y:4000+Math.floor(i/12)*300,text:'中文提示词排版验证。'.repeat(30)})),connections:[],viewport:{x:0,y:0,scale:1}};
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname;
        const data = path === '/api/canvases/perf' ? {canvas:fixture}
            : path === '/api/projects' ? {projects:[{id:'default',name:'我的画板'}]}
            : path === '/api/canvases' ? {canvases:[{id:'perf',project:'default',title:'中文排版与交互验证',node_count:120,board_x:40,board_y:40},{id:'second',project:'default',title:'第二个画布',board_x:340,board_y:220}]}
            : {};
        return route.fulfill({json:data});
    });
    await page.goto('http://127.0.0.1:8766/static/canvas.html?id=perf');
    await page.locator('#shell:not(.no-canvas)').waitFor();
    await page.waitForTimeout(400);
    const fit = await page.evaluate(() => [...document.querySelectorAll('.node')].every(node => {
        const r=node.getBoundingClientRect();
        return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;
    }));
    check(fit,'Opening must fit every node without a click');
    const metrics = await page.evaluate(async () => {
        let replacements=0;
        const observer=new MutationObserver(records => replacements+=records.filter(r=>r.target.id==='minimapContent').length);
        observer.observe(minimapContent,{childList:true});
        const samples=[];
        for(let i=0;i<45;i++){
            const start=performance.now();
            viewport.x+=2;
            applyViewport();
            await new Promise(requestAnimationFrame);
            samples.push(performance.now()-start);
        }
        observer.disconnect();
        return {minimapReplacements:replacements,meanFrameMs:samples.reduce((a,b)=>a+b)/samples.length};
    });
    check(metrics.minimapReplacements===0,'Panning must reuse minimap nodes');
    const interruption = await page.evaluate(async () => {
        setZoomAtCenter(2,true);
        await new Promise(requestAnimationFrame);
        handleCanvasWheel({target:board,deltaX:0,deltaY:60,clientX:500,clientY:300,preventDefault(){},stopPropagation(){}});
        const expected={...viewport};
        await new Promise(resolve=>setTimeout(resolve,260));
        return Math.abs(viewport.scale-expected.scale)<1e-8 && Math.abs(viewport.x-expected.x)<1e-8;
    });
    check(interruption,'Wheel input must cancel the preceding zoom animation');
    const drag = await page.evaluate(() => {
        const node=nodes[0], x=node.x;
        startNodeDrag({button:0,target:nodesEl.querySelector('.node-head'),clientX:100,clientY:100,preventDefault(){},stopPropagation(){}},node);
        onNodeDrag({clientX:130,clientY:100});
        endDrag();
        return Math.abs(node.x-x-30/viewport.scale)<1e-7;
    });
    check(drag,'Mouseup must retain the final queued drag position');
    await page.emulateMedia({reducedMotion:'reduce'});
    const reduced = await page.evaluate(() => { setZoomAtCenter(1,true); return viewport.scale===1 && viewportAnimationFrame===0; });
    check(reduced,'Reduced motion must apply zoom immediately');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.goto('http://127.0.0.1:8766/static/canvas-list.html');
    await page.locator('.ws-card').first().waitFor();
    const list = await page.evaluate(() => ({zoom:getComputedStyle(document.querySelector('.workspace')).zoom,willChange:getComputedStyle(boardWorld).willChange,scale:viewport.scale}));
    check(Number(list.zoom)===1,'Board manager must not shrink text through a second CSS zoom');
    check(list.willChange==='auto','Idle cards must not retain a rasterized transform layer');
    const anchor = await page.evaluate(async () => {
        const rect=board.getBoundingClientRect(),x=rect.left+100,y=rect.top+100;
        const before=screenToWorld(x,y);
        onBoardWheel({target:board,deltaX:0,deltaY:-12,deltaMode:0,clientX:x,clientY:y,preventDefault(){}});
        await new Promise(requestAnimationFrame);
        const after=screenToWorld(x,y);
        return Math.hypot(before.x-after.x,before.y-after.y)<1e-7;
    });
    check(anchor,'Board wheel must preserve the point under the cursor');
    await page.locator('.ws-card').first().click({button:'right'});
    check(await page.locator('.ws-card-pop').isVisible(),'Board cards must support right-click');
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:1024,height:800});
    await page.screenshot({path:'output/playwright/board-manager.png'});
    await page.goto('http://127.0.0.1:8766/static/index.html');
    await page.waitForTimeout(400);
    check(errors.length===0,`Unexpected runtime errors: ${errors.join('; ')}`);
    return {autoFit:fit,metrics,animationInterruption:interruption,finalDragPosition:drag,reducedMotion:reduced,manager:list,cursorAnchor:anchor,runtimeErrors:errors};
}
