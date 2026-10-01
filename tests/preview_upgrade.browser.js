async page => {
 await page.unrouteAll({behavior:'ignoreErrors'});
 const assert=(v,m)=>{if(!v)throw Error(m)},errors=[];page.on('pageerror',e=>errors.push(e.message));
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#8680bb"/></svg>';
 const fixture={id:'preview',title:'预览验收',nodes:[{id:'upload',type:'image',url:'/assets/upload.png',name:'参考图',x:20,y:80,w:300,h:280},{id:'output',type:'output',outputKind:'image-group',images:['/assets/generated.png','/assets/second.png'],x:500,y:80,w:360,h:340}],connections:[],viewport:{x:0,y:0,scale:1}};
 await page.route('**/assets/**',r=>r.fulfill({contentType:'image/svg+xml',body:svg}));
 await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;if(path==='/api/media-preview')return r.fulfill({contentType:'image/svg+xml',body:svg});return r.fulfill({json:path==='/api/canvases/preview'?{canvas:fixture}:{}})});
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:8768/static/canvas.html?id=preview');
 await page.locator('.node[data-id="upload"] .node-body img').first().dblclick();await page.locator('#imageEditModal.open').waitFor();
 const upload=await page.evaluate(()=>{
  const stage=document.getElementById('imageEditStage'),rect=stage.getBoundingClientRect();
  const measure=deltaY=>{resetImageEditZoom();stage.dispatchEvent(new WheelEvent('wheel',{deltaY,clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2,bubbles:true,cancelable:true}));return imageEditZoom};
  return {tiny:measure(-1),large:measure(-100),zero:measure(0)};
 });assert(upload.tiny>1&&upload.tiny<upload.large&&upload.zero===1,'uploaded proportional zoom');
 await page.evaluate(()=>closeImageEditor());
 await page.locator('.node[data-id="output"] .output-img-wrap img').first().dblclick();await page.locator('#outputLightbox.open').waitFor();
 const output=await page.evaluate(async()=>{
  const el=document.getElementById('outputPreview');
  document.body.style.zoom='.8';
  await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  const base=JSON.stringify(viewport);
  const rect=el.getBoundingClientRect(),x=Math.round(rect.x+rect.width*.35),y=Math.round(rect.y+rect.height*.4);
  const wheel=(deltaY,deltaMode=0)=>el.dispatchEvent(new WheelEvent('wheel',{deltaY,deltaMode,clientX:x,clientY:y,bubbles:true,cancelable:true}));
  resetOutputPreviewZoom();const point=JinniPreviewZoom.point({clientX:x,clientY:y},el);for(let i=0;i<100;i++)wheel(-1);const continuous=outputPreviewZoom;
  const anchor={x:(point.x-outputPreviewPan.x)/outputPreviewZoom,y:(point.y-outputPreviewPan.y)/outputPreviewZoom};
  resetOutputPreviewZoom();wheel(-100);const large=outputPreviewZoom;wheel(100);const reversed=outputPreviewZoom;wheel(0);const zero=outputPreviewZoom;
  resetOutputPreviewZoom();wheel(-1,1);const line=outputPreviewZoom;resetOutputPreviewZoom();wheel(-16);const pixels=outputPreviewZoom;
  resetOutputPreviewZoom();wheel(100);const smaller=outputPreviewZoom;
  await new Promise(requestAnimationFrame);
  const transition=getComputedStyle(document.getElementById('outputLightboxImg')).transitionDuration;
  return {continuous,large,reversed,zero,line,pixels,smaller,anchorError:Math.hypot(anchor.x-point.x,anchor.y-point.y),baseUnchanged:base===JSON.stringify(viewport),transition};
 });
 assert(Math.abs(output.continuous-output.large)<1e-10,'event rate independent');assert(Math.abs(output.reversed-1)<1e-10&&output.zero===output.reversed,'reverse and zero');assert(output.line===output.pixels,'deltaMode normalization');assert(output.anchorError<1e-6,'focal point stable at UI scale');assert(output.baseUnchanged,'underlying canvas moved');assert(output.smaller<1,'zoom out from fit');assert(output.transition==='0s','preview transition trails');
 await page.evaluate(()=>closeOutputLightbox());await page.goto('http://127.0.0.1:8768/static/smart-canvas.html?id=preview');await page.waitForFunction(()=>!!canvas);
 await page.evaluate(()=>{nodes=[];createImageNodeAt({x:400,y:350},[{url:'/assets/upload.png',name:'参考图',kind:'image'}]);render()});
 await page.locator('.image-node img.node-img').first().dblclick();await page.locator('#imageEditModal.open').waitFor();
 const smart=await page.evaluate(async()=>{
  resetPreviewTransform();const stage=document.getElementById('previewStage'),r=stage.getBoundingClientRect();const event={clientX:Math.round(r.x+r.width*.35),clientY:Math.round(r.y+r.height*.4)};const p=JinniPreviewZoom.point(event,stage);
  const before={x:(p.x-stage.clientWidth/2-previewPan.x)/previewZoom,y:(p.y-stage.clientHeight/2-previewPan.y)/previewZoom};
  document.getElementById('imageEditStage').dispatchEvent(new WheelEvent('wheel',{...event,deltaY:-120,bubbles:true,cancelable:true}));await new Promise(requestAnimationFrame);
  return {error:Math.hypot((p.x-stage.clientWidth/2-previewPan.x)/previewZoom-before.x,(p.y-stage.clientHeight/2-previewPan.y)/previewZoom-before.y),zoom:previewZoom};
 });assert(smart.error<1e-6,'smart focal anchor');assert(!errors.length,errors.join('\n'));return {upload,output,smart,errors};
}
