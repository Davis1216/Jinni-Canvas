async page => {
 await page.unrouteAll({behavior:'ignoreErrors'});
 const assert=(v,m)=>{if(!v)throw Error(m)},errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture={id:'stable',title:'画布稳定性',nodes:[{id:'image',type:'image',url:'/assets/test.png',natural_w:600,natural_h:400,x:30,y:100,w:280,h:240},{id:'prompt',type:'prompt',text:'测试提示词',x:350,y:100},{id:'gen',type:'generator',x:700,y:100}],connections:[{id:'edge',from:'prompt',to:'gen'}]};
 await page.route('**/api/**',r=>r.fulfill({json:new URL(r.request().url()).pathname==='/api/canvases/stable'?{canvas:fixture}:{}}));
 await page.route('**/assets/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#4b736a"/></svg>'}));
 await page.goto('http://127.0.0.1:8768/static/canvas.html?id=stable');await page.waitForFunction(()=>!!canvas&&nodes.length===3);
 await page.evaluate(()=>{window.originalNode=nodesEl.querySelector('[data-id="image"]');window.originalImage=originalNode.querySelector('img');selected.add('prompt');refreshSelectionVisuals();});
 await page.locator('.link-delete').click({force:true});
 assert(await page.evaluate(()=>originalNode===nodesEl.querySelector('[data-id="image"]')&&originalImage.isConnected),'删除连线导致未变化的图片节点被重建');
 await page.evaluate(()=>performUndo());
 assert(await page.evaluate(()=>connections.length===1&&originalNode===nodesEl.querySelector('[data-id="image"]')),'undo must preserve unaffected node');
 await page.evaluate(()=>performRedo());
 assert(await page.evaluate(()=>connections.length===0&&originalImage.isConnected),'redo must preserve media');
 await page.evaluate(()=>{const p=nodes.find(n=>n.id==='prompt');p.text='更新后的提示词';render()});
 assert(await page.locator('[data-id="prompt"] [contenteditable]').first().innerText()==='更新后的提示词','changed content must update');
 assert(await page.evaluate(()=>originalImage.isConnected),'editing another node must preserve media');
 assert(!errors.length,errors.join('\n'));return {delete:true,undo:true,redo:true,unchangedMediaPreserved:true,errors};
}
