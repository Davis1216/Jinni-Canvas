// Run with a local static server on 8766 and playwright-cli:
// playwright-cli run-code "$(cat tests/canvas_ui.browser.js)"
async (page) => {
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const fixture = {id:'interaction-test', title:'交互验证', nodes:[{id:'prompt-test',type:'prompt',x:100,y:100,text:'测试提示词'}], connections:[], viewport:{x:0,y:0,scale:1}};
    await page.route('**/api/**', route => route.fulfill({json:
        route.request().url().endsWith('/canvases/interaction-test') ? {canvas:fixture} : {}
    }));
    await page.goto('http://127.0.0.1:8766/static/index.html');
    await page.locator('#frame-canvas').evaluate(frame => {
        frame.src = '/static/canvas.html?id=interaction-test';
    });
    const editor = page.frameLocator('#frame-canvas');
    await editor.locator('#shell:not(.no-canvas)').waitFor();
    const frames = await page.locator('iframe').evaluateAll(items => items.map(frame => ({
        active:frame.classList.contains('active'), visibility:getComputedStyle(frame).visibility
    })));
    assert(frames.every(f => f.visibility === (f.active ? 'visible' : 'hidden')), 'Inactive frames must leave WebKit hit testing');
    await page.setViewportSize({width:1440,height:900});
    const board = await editor.locator('#board').boundingBox();
    // Auto-fit centers the fixture node; use the clear upper-left board area.
    const point = {x:board.x + 200, y:board.y + 150};
    await page.mouse.click(point.x, point.y, {button:'right'});
    assert(await editor.locator('#createMenu').isVisible(), 'Right-click must open the canvas menu');
    await page.mouse.click(point.x - 100, point.y);
    const scale = () => editor.locator('#zoomValueText').innerText().then(parseFloat);
    const before = await scale();
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(150);
    const enlarged = await scale();
    assert(enlarged > before, 'Wheel up must zoom in');
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(150);
    assert(await scale() < enlarged, 'Wheel down must zoom out');
    await editor.locator('.node-head').click({button:'right'});
    assert(await editor.locator('#nodeContextMenu').isVisible(), 'Node right-click must open its context menu');
    const linkOptions = await editor.locator('#board').evaluate(() => {
        localStorage.setItem(STUDIO_LOCAL_TOOLS_VISIBLE_KEY, '1');
        return linkCreateOptions({originId:'prompt-test',originKind:'out'}).map(option => option.type);
    });
    assert(!linkOptions.some(type => ['rh','comfy','ltxDirector'].includes(type)), 'Connection menus must not offer removed launch buttons');
    await page.mouse.click(point.x - 100, point.y);
    assert(await editor.locator('#quickToolbar [data-local-tools-required], #createMenu [data-local-tools-required], #createMenu [data-provider-required="runninghub"]').count() === 0, 'Removed launch buttons must not return');
    const results = [];
    for (const width of [1440,1280,1024,800,600,480,360]) {
        await page.setViewportSize({width,height:900});
        await page.waitForTimeout(250);
        const layout = await editor.locator('#quickToolbar').evaluate(dock => {
            const d = dock.getBoundingClientRect();
            const z = document.querySelector('#zoomDock').getBoundingClientRect();
            const buttons = [...dock.querySelectorAll('button')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.getBoundingClientRect());
            const overlaps = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            return {
                outside: d.left < 0 || d.right > innerWidth || buttons.some(r => r.left < d.left || r.right > d.right || r.top < d.top || r.bottom > d.bottom),
                overlap: overlaps(d,z) || buttons.some((r,i) => buttons.slice(i+1).some(other => overlaps(r,other))),
                width:innerWidth, height:d.height
            };
        });
        assert(!layout.outside && !layout.overlap, `Toolbar overflow or overlap at window width ${width}: ${JSON.stringify(layout)}`);
        results.push(layout);
    }
    await page.setViewportSize({width:1280,height:900});
    await page.waitForTimeout(250);
    await page.screenshot({path:'output/playwright/canvas-responsive.png'});
    return {rightClick:true, wheelZoom:true, inactiveFramesHidden:true, layouts:results};
}
