async page => {
 const check=(v,m)=>{if(!v)throw Error(m)};
 await page.unroute('**/api/**');
 await page.route('**/api/**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/canvases/sidebar-test'?{canvas:{id:'sidebar-test',title:'侧栏验证',nodes:[],connections:[]}}:{}}));
 await page.setViewportSize({width:1440,height:900});
 await page.goto('http://127.0.0.1:8766/static/index.html');
 await page.locator('#frame-canvas').evaluate(el=>el.src='/static/canvas.html?id=sidebar-test');
 const frame=page.frameLocator('#frame-canvas');
 await frame.locator('#shell:not(.no-canvas)').waitFor();
 await frame.locator('#board').evaluate(()=>{JinniCanvasEffects.setMode('liquid');});
 await page.mouse.move(800,400);await page.waitForTimeout(1200);
 await frame.locator('#board').evaluate(()=>{
  window.sidebarProbe={replaced:0,blank:0,frames:0,resizes:0};
  const initial=document.querySelector('.canvas-effect-surface');let lastWidth=initial.width;
  const tick=()=>{
   const canvas=document.querySelector('.canvas-effect-surface');
   if(canvas!==initial)sidebarProbe.replaced++;
   if(canvas){
    if(canvas.width!==lastWidth){sidebarProbe.resizes++;lastWidth=canvas.width;}
    const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    const data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
    let painted=false;for(let i=3;i<data.length;i+=4){if(data[i]){painted=true;break}}
    if(!painted)sidebarProbe.blank++;
   }else sidebarProbe.blank++;
   sidebarProbe.frames++;sidebarProbe.raf=requestAnimationFrame(tick);
  };sidebarProbe.raf=requestAnimationFrame(tick);
 });
 for(let i=0;i<2;i++){
  await page.locator('#studioSidebar').hover();await page.waitForTimeout(850);
  await page.mouse.move(800,400);await page.waitForTimeout(1250);
 }
 await page.locator('#sidebarLogoToggle').click();await page.waitForTimeout(700);
 await page.locator('#sidebarLogoToggle').click();await page.mouse.move(800,400);await page.waitForTimeout(1200);
 const result=await frame.locator('#board').evaluate(()=>{cancelAnimationFrame(sidebarProbe.raf);return sidebarProbe});
 check(result.replaced===0&&result.blank===0&&result.resizes===0,`Sidebar must preserve a painted background: ${JSON.stringify(result)}`);
 return result;
}
