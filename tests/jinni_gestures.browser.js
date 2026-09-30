async page => {
 const assert=(v,m)=>{if(!v)throw Error(m)};
 const fixture={id:'gesture-test',title:'交互验收',nodes:[{id:'p',type:'prompt',x:100,y:100,text:'提示词'},{id:'g',type:'generator',x:650,y:100}],connections:[{id:'c',from:'p',to:'g'}],viewport:{x:0,y:0,scale:1}};
 await page.route('**/api/**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/canvases/gesture-test'?{canvas:fixture}:{}}));
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:8766/static/canvas.html?id=gesture-test');await page.locator('[data-command="selectAll"]').waitFor();await page.locator('.node').first().waitFor();await page.waitForTimeout(350);
 const before=await page.evaluate(()=>({...viewport}));
 await page.mouse.move(1000,120);await page.mouse.down();await page.mouse.move(1100,160,{steps:6});await page.mouse.up();
 assert(await page.evaluate(v=>viewport.x!==v.x||viewport.y!==v.y,before),'Default blank drag pans');
 await page.evaluate(()=>{viewport={x:0,y:0,scale:1};applyViewport();});
 await page.keyboard.down('Shift');await page.mouse.move(85,85);await page.mouse.down();await page.mouse.move(450,520,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');
 assert(await page.evaluate(()=>selected.has('p')),'Shift box selects node');
 assert(await page.evaluate(()=>connections.length===1),'Shift box does not cut connections');
 await page.evaluate(()=>{window.confirm=()=>false;});
 const point=await page.evaluate(()=>{const a=portPoint('p','out'),b=portPoint('g','in');return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}});
 await page.keyboard.down('k');await page.mouse.move(point.x,point.y-100);await page.mouse.down();await page.mouse.move(point.x,point.y+100,{steps:12});
 assert(await page.evaluate(()=>pendingKnifeConnections.size===1&&connections.length===1),'Knife previews without mutation');
 await page.mouse.up();await page.keyboard.up('k');assert(await page.evaluate(()=>connections.length===1),'Cancel cut retains links');
 await page.evaluate(()=>{window.confirm=()=>true;});
 await page.keyboard.down('k');await page.mouse.move(point.x,point.y-100);await page.mouse.down();await page.mouse.move(point.x,point.y+100,{steps:12});await page.mouse.up();await page.keyboard.up('k');assert(await page.evaluate(()=>connections.length===0),'Confirmed cut removes links');
 await page.locator('#dockUndoBtn').click();assert(await page.evaluate(()=>connections.length===1),'Undo restores cut links');
 await page.locator('#canvasEffectsToggle').click();
 const slider=page.locator('#canvasEffectIntensity');
 if(await slider.count()){const shape=await slider.evaluate(el=>getComputedStyle(el,'::-webkit-slider-thumb').borderRadius);assert(shape==='50%'||shape==='999px','Rounded slider thumb')}
 await page.screenshot({path:'output/playwright/jinni-gestures.png'});
 return {defaultPan:true,shiftBox:true,knifePreview:true,cancelCut:true,confirmCut:true,undoCut:true};
}
