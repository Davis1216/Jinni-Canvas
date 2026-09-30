// Local static server on 8766; playwright-cli run-code "$(cat tests/canvas_effects.browser.js)".
async (page) => {
    const check = (value,message) => { if(!value) throw new Error(message); };
    const fixture = {id:'effects-test',title:'动态画布验收',nodes:[
        {id:'a',type:'prompt',x:150,y:180,w:300,h:230,text:'构图与光线'},
        {id:'b',type:'generator',x:700,y:150,w:310,h:400}
    ],connections:[{id:'ab',from:'a',to:'b'}]};
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.unroute('**/api/**');
    await page.route('**/api/**',route => route.fulfill({json:
        new URL(route.request().url()).pathname === '/api/canvases/effects-test' ? {canvas:fixture} : {}
    }));
    await page.setViewportSize({width:1440,height:900});
    await page.goto('http://127.0.0.1:8766/static/canvas.html?id=effects-test');
    await page.locator('#shell:not(.no-canvas)').waitFor();
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(() => { StudioTheme.apply('dark'); localStorage.removeItem('jinni_canvas_appearance_v1'); });
    const modes = ['flow','liquid','floatingLines','galaxy','silk','waves','dotField','dotGrid','shapeGrid','faultyTerminal'];
    const results = [];
    for(const mode of modes){
        await page.evaluate(mode => JinniCanvasEffects.setMode(mode),mode);
        await page.mouse.move(200,120);
        await page.mouse.move(800,220,{steps:18});
        await page.waitForTimeout(mode === 'liquid' ? 1400 : 150);
        const state = await page.evaluate(() => JinniCanvasEffects.getState());
        check(state.active && state.renderMode === mode, `${mode} must render, not silently fall back`);
        check(state.resources.frames <= 2 && state.resources.observers === 1, `${mode} has duplicate resources`);
        // A clear strip of background: pixel changes must come from the effect.
        const before = await page.screenshot({clip:{x:300,y:90,width:700,height:100}});
        await page.mouse.move(900,160,{steps:12});
        await page.waitForTimeout(180);
        const after = await page.screenshot({clip:{x:300,y:90,width:700,height:100}});
        check(!before.equals(after), `${mode} must animate actual pixels`);
        results.push(mode);
    }
    await page.locator('#canvasEffectsToggle').click();
    await page.locator('[data-effect-mode="liquid"]').click();
    const viewportBefore = await page.evaluate(() => JSON.stringify(viewport));
    await page.keyboard.down('Shift');
    await page.locator('[data-effect-mode="dotGrid"]').click();
    await page.keyboard.up('Shift');
    check(await page.evaluate(() => JSON.stringify(viewport)) === viewportBefore, 'Settings must not pan or cut the canvas');
    await page.locator('#canvasEffectMotion').uncheck();
    check(!(await page.evaluate(() => JinniCanvasEffects.getState())).active, 'Motion toggle must release renderer');
    await page.locator('#canvasEffectMotion').check();
    await page.keyboard.press('Escape');
    check(await page.locator('#canvasEffectsPanel').isHidden(),'Escape must close the settings');
    await page.reload();
    await page.locator('#shell:not(.no-canvas)').waitFor();
    check((await page.evaluate(() => JinniCanvasEffects.getState())).mode === 'dotGrid','Appearance must persist across reloads');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForTimeout(250); // Media-query changes are delivered asynchronously.
    check(!(await page.evaluate(() => JinniCanvasEffects.getState())).active,'Reduced motion must stop all background frames');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.waitForTimeout(250);
    check((await page.evaluate(() => JinniCanvasEffects.getState())).active,'Motion must resume after the system preference changes back');
    await page.evaluate(() => JinniCanvasEffects.setMode('flow'));
    const target = page.locator('#canvasEffectsToggle');
    const buttonBefore = await target.boundingBox();
    await target.hover();
    await page.waitForTimeout(300);
    const spring = await target.locator('svg').evaluate(el => getComputedStyle(el).transform);
    const buttonAfter = await target.boundingBox();
    check(spring !== 'none' && JSON.stringify(buttonBefore) === JSON.stringify(buttonAfter),'Spring must move icons without moving hit areas');
    await page.mouse.move(200,120);
    await page.waitForTimeout(1000);
    check(!(await page.evaluate(() => JinniCanvasEffects.getState())).dockAnimating,'Spring must stop when settled');
    // Synthetic context loss verifies fallback and cleanup, without needing a GPU fault.
    await page.evaluate(() => {
        JinniCanvasEffects.setMode('liquid');
        document.querySelector('.canvas-effect-surface').dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
    });
    const failed = await page.evaluate(() => JinniCanvasEffects.getState());
    check(!failed.active && failed.renderMode === 'dots' && failed.resources.frames === 0,'Context loss must show a usable static fallback');
    await page.evaluate(() => JinniCanvasEffects.setMode('liquid'));
    await page.setViewportSize({width:1024,height:768});
    await page.waitForTimeout(200);
    const size = await page.locator('.canvas-effect-surface').evaluate(el => ({w:el.width,h:el.height,rect:el.getBoundingClientRect().width}));
    check(size.w > 0 && size.h > 0 && size.rect === 1024,'Effects must resize with the viewport');
    // Use the actual host iframe visibility mechanism, not a synthetic document.hidden flag.
    await page.goto('http://127.0.0.1:8766/static/index.html');
    await page.locator('#frame-canvas').evaluate(el => { el.src='/static/canvas.html?id=effects-test'; });
    const editor = page.frameLocator('#frame-canvas');
    await editor.locator('#shell:not(.no-canvas)').waitFor();
    await editor.locator('[data-effect-mode="liquid"]').waitFor({state:'attached'});
    await editor.locator('#board').evaluate(() => JinniCanvasEffects.setMode('liquid'));
    await page.locator('#frame-canvas').evaluate(el => el.classList.remove('active'));
    await page.waitForTimeout(100);
    check(!(await editor.locator('#board').evaluate(() => JinniCanvasEffects.getState())).active,'Hidden iframe must release GPU and animation callbacks');
    await page.locator('#frame-canvas').evaluate(el => el.classList.add('active'));
    await page.waitForTimeout(150);
    check((await editor.locator('#board').evaluate(() => JinniCanvasEffects.getState())).active,'Visible iframe must resume');
    check(errors.length === 0,errors.join('\n'));
    return {animatedModes:results,settingsIsolation:true,persistence:true,reducedMotion:true,dockHitAreas:true,springSettles:true,contextLossFallback:true,resize:true,hiddenFrameCleanup:true,runtimeErrors:errors};
}
