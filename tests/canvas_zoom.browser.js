// Run against the local static server on 8766 with playwright-cli run-code.
async (page) => {
    const check=(value,message)=>{if(!value)throw new Error(message);};
    const original='/assets/input/zoom-test.png';
    const fixture={id:'zoom-test',title:'图片缩放回归',nodes:[
        {id:'img',type:'image',url:original,name:'参考图',natural_w:1800,natural_h:1200,x:100,y:100,w:700,h:500},
        {id:'prompt',type:'prompt',x:900,y:100,text:'参考 图片1',promptParts:[{type:'text',text:'参考 '},{type:'image',key:'img',sourceId:'img',url:original,name:'图片1'}]},
        {id:'generator',type:'generator',x:1500,y:100}
    ],connections:[{id:'a',from:'img',to:'prompt'},{id:'b',from:'prompt',to:'generator'},{id:'c',from:'img',to:'generator'}]};
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',route=>{
        const p=new URL(route.request().url()).pathname;
        if(p==='/api/media-preview') return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="pink"/></svg>'});
        return route.fulfill({json:p==='/api/canvases/zoom-test'?{canvas:fixture}:{}});
    });
    await page.setViewportSize({width:1440,height:900});
    await page.goto('http://127.0.0.1:8766/static/canvas.html?id=zoom-test');
    await page.locator('.image-mention-token img').waitFor();
    await page.waitForTimeout(400);
    const thumbs=await page.locator('.prompt-reference-thumb img,.image-mention-token img,.prompt-preview-mention img').evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src')));
    check(thumbs.length>=3 && thumbs.every(src=>src.startsWith('/api/media-preview?')),'Small reference thumbnails must use previews');
    check(await page.locator('.image-mention-token').getAttribute('data-url')===original,'Image references must retain original URLs');
    const serialized=await page.locator('.image-mention-editor').evaluate(el=>StudioImageMentions.serialize(el));
    check(serialized.some(p=>p.type==='image' && p.url===original),'Saving mentions must retain original media');
    await page.evaluate(()=>{ selected.add('prompt'); syncCanvasSelectedImageResolution(); });
    await page.waitForTimeout(350);
    check(await page.locator('.prompt-reference-thumb img').evaluate(el=>el.getAttribute('src').startsWith('/api/media-preview?')),'Selecting a prompt must not load original images into its thumbnail strip');
    const active=await page.evaluate(async()=>{
        const r=board.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
        const before=screenToWorld(x,y);
        handleCanvasWheel({target:board,clientX:x,clientY:y,deltaY:-40,preventDefault(){},stopPropagation(){}});
        await new Promise(requestAnimationFrame);
        const after=screenToWorld(x,y);
        return {layer:getComputedStyle(nodesEl.querySelector('.node')).transform,anchor:Math.hypot(before.x-after.x,before.y-after.y)};
    });
    check(active.layer!=='none' && active.anchor<1e-6,'Wheel must composite nodes while preserving cursor anchor');
    await page.waitForTimeout(350);
    check(await page.locator('.node').first().evaluate(el=>getComputedStyle(el).transform)==='none','Idle nodes must release cached layers for sharp text');
    const sequence=await page.evaluate(async()=>{
        const originalSources=[...nodesEl.querySelectorAll('img')].map(i=>i.src);
        for(let i=0;i<40;i++){
            handleCanvasWheel({target:board,clientX:700,clientY:400,deltaY:i<20?-15:15,preventDefault(){},stopPropagation(){}});
            await new Promise(requestAnimationFrame);
            if(!world.classList.contains('viewport-moving')) return false;
        }
        return originalSources.every((src,i)=>src===nodesEl.querySelectorAll('img')[i].src);
    });
    check(sequence,'Continuous zoom must retain node layers and avoid changing image sources mid-gesture');
    await page.waitForTimeout(350);
    await page.evaluate(()=>onZoomSliderInput(120));
    check(await page.locator('#world').evaluate(el=>el.classList.contains('viewport-moving')),'Slider must use the same compositing path');
    await page.waitForTimeout(350);
    check(await page.locator('#world').evaluate(el=>!el.classList.contains('viewport-moving')),'Slider layers must also be released');
    check(errors.length===0,errors.join('\n'));
    return {thumbnails:thumbs.length,originalReferences:true,cursorAnchor:true,transientLayers:true,noMidGestureImageChanges:true};
}
