// Mock APIs keep manager regression checks independent of personal canvas data.
async (page) => {
    const check = (value, message) => { if(!value) throw new Error(message); };
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let posts = [], failCreate = false;
    const cards = [
        {id:'a',project:'default',title:'画板 A',board_x:-5000,board_y:-2000},
        {id:'b',project:'default',title:'画板 B',board_x:5000,board_y:3000}
    ];
    await page.route('**/api/**', async route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        if(path === '/api/canvases' && req.method() === 'POST'){
            posts.push(req.postDataJSON());
            await new Promise(resolve => setTimeout(resolve, 150));
            return route.fulfill({status:failCreate ? 500 : 200,json:failCreate ? {} : {canvas:{id:'new',...posts.at(-1)}}});
        }
        return route.fulfill({json:path === '/api/projects' ? {projects:[{id:'default',name:'我的画板'}]} : path === '/api/canvases' ? {canvases:cards} : {}});
    });
    await page.setViewportSize({width:1280,height:800});
    await page.goto('http://127.0.0.1:8766/static/canvas-list.html');
    await page.locator('.ws-card').first().waitFor();
    await page.waitForTimeout(100);
    const fitted = () => page.evaluate(() => {
        const b=board.getBoundingClientRect();
        return [...boardWorld.querySelectorAll('.ws-card')].every(el=>{
            const r=el.getBoundingClientRect();
            return r.left>=b.left && r.top>=b.top && r.right<=b.right && r.bottom<=b.bottom;
        });
    });
    check(await fitted(),'Opening must fit distant cards completely');
    await page.evaluate(() => { viewport.x+=10000; applyViewport(); window.postMessage({type:'canvas-focus'},location.origin); });
    await page.waitForTimeout(100);
    check(await fitted(),'Returning to manager must fit the board');
    await page.setViewportSize({width:760,height:650});
    await page.waitForTimeout(150);
    check(await fitted(),'Resizing must keep cards in view');
    check(await page.locator('#boardMinimap rect[data-card]').count()===2,'Minimap must show all cards');
    const before = await page.locator('#boardWorld').getAttribute('style');
    await page.locator('#boardMinimap').click({position:{x:15,y:15}});
    await page.waitForTimeout(50);
    check(before!==await page.locator('#boardWorld').getAttribute('style'),'Minimap must navigate');
    await page.locator('#boardFitView').click();
    check(await fitted(),'Fit button must restore the view');
    const retained = await page.evaluate(async () => {
        const first=boardMinimapCards.firstChild;
        for(let i=0;i<10;i++){ viewport.x+=2; applyViewport(); await new Promise(requestAnimationFrame); }
        return first===boardMinimapCards.firstChild;
    });
    check(retained,'Panning must retain minimap card elements');
    await page.evaluate(() => {
        canvases.forEach((c,i)=>{ c.board_x=i*280; c.board_y=0; });
        renderBoard(); resetView();
    });
    await page.waitForTimeout(50);
    await page.locator('#newCanvasBtn').click();
    check(await page.locator('body > dialog[open]').count()===1,'Create form must be an independent modal');
    check(await page.locator('#boardWorld .ws-create-card').count()===0,'Create form must not occupy board space');
    await page.locator('.ws-create-input').fill('新画布');
    await page.locator('[data-kind="smart"]').click();
    failCreate=true;
    await page.locator('.ws-create-confirm').click();
    await page.locator('.ws-create-error:not([hidden])').waitFor();
    check(await page.locator('.ws-create-input').inputValue()==='新画布','Failed creation must retain the input');
    failCreate=false;
    await page.locator('.ws-create-confirm').dblclick();
    await page.waitForTimeout(250);
    check(posts.length===2,'Pending creation must not submit twice');
    check(posts[1].title==='新画布' && posts[1].kind==='smart' && posts[1].project==='default','Creation must preserve fields');
    check(await page.locator('dialog[open]').count()===0,'Successful creation must close the dialog');
    const overlaps=await page.evaluate(()=>{
        const rects=[...boardWorld.querySelectorAll('.ws-card')].map(el=>el.getBoundingClientRect());
        const n=rects.pop();
        return rects.some(r=>n.left<r.right && n.right>r.left && n.top<r.bottom && n.bottom>r.top);
    });
    check(!overlaps,'New cards must avoid existing cards');
    await page.locator('#newCanvasBtn').click();
    await page.keyboard.press('Escape');
    check(await page.locator('dialog[open]').count()===0,'Escape must dismiss the dialog');
    for(const width of [360,480,760,1280]){
        await page.setViewportSize({width,height:700});
        await page.waitForTimeout(100);
        const layout=await page.evaluate(()=>{
            const b=board.getBoundingClientRect(),m=boardNavigator.getBoundingClientRect(),z=document.querySelector('.ws-view-controls').getBoundingClientRect();
            return m.left>=b.left && m.right<=b.right && z.left>=b.left && z.right<=b.right &&
                !(m.left<z.right && m.right>z.left && m.top<z.bottom && m.bottom>z.top);
        });
        check(layout,'Navigation controls must fit without overlap at '+width);
        check(await fitted(),'Cards must fit at '+width);
    }
    check(errors.length===0,errors.join('\n'));
    await page.screenshot({path:'output/playwright/manager-minimap.png'});
    return {passed:true,posts:posts.length};
}
