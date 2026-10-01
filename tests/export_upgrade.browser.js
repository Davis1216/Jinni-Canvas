async page=>{
 await page.unrouteAll({behavior:'ignoreErrors'});const assert=(v,m)=>{if(!v)throw Error(m)};
 const cv={id:'export',title:'中文导出',kind:'classic',nodes:[{id:'i',type:'image',url:'/assets/test.png'}],connections:[]};
 await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return r.fulfill({json:p==='/api/canvases/export'?{canvas:cv}:p==='/api/canvases'?{canvases:[cv]}:p==='/api/projects'?{projects:[]}: {}})});
 await page.route('**/assets/test.png',r=>r.fulfill({contentType:'image/png',body:Buffer.from([137,80,78,71])}));
 await page.goto('http://127.0.0.1:8768/static/canvas-list.html');
 await page.evaluate(()=>{window.saved=[];window.showSaveFilePicker=async options=>{window.saved.push({options});return {name:options.suggestedName,createWritable:async()=>({write:async blob=>{saved.at(-1).bytes=Array.from(new Uint8Array(await blob.arrayBuffer()))},close:async()=>{saved.at(-1).closed=true},abort:async()=>{}})}}});
 await page.evaluate(()=>exportCanvas('export'));await page.evaluate(()=>exportCanvasWithResources('export'));
 const files=await page.evaluate(()=>saved);assert(files.length===2&&files.every(f=>f.closed),'write completed');assert(JSON.parse(Buffer.from(files[0].bytes).toString()).title==='中文导出','JSON preserved');assert(Buffer.from(files[1].bytes).readUInt32LE(0)===0x04034b50,'ZIP header');assert(Buffer.from(files[1].bytes).includes(Buffer.from('resources-manifest.json')),'ZIP manifest');
 await page.route('**/assets/test.png',r=>r.fulfill({status:404,body:'missing'}));await page.evaluate(()=>exportCanvasWithResources('export'));assert((await page.locator('body').innerText()).includes('1 个资源未能包含'),'missing resource warning');
 const partial=await page.evaluate(()=>saved.at(-1).bytes);assert(Buffer.from(partial).includes(Buffer.from('HTTP 404')),'missing resource in manifest');
 await page.evaluate(()=>{window.showSaveFilePicker=async()=>{throw new DOMException('cancel','AbortError')}});await page.evaluate(()=>exportCanvas('export'));assert((await page.locator('body').innerText()).includes('已取消导出'),'cancel status');
 await page.evaluate(()=>{window.showSaveFilePicker=async()=>({name:'fail.json',createWritable:async()=>{throw Error('disk full')}})});await page.evaluate(()=>exportCanvas('export'));assert((await page.locator('body').innerText()).includes('导出失败：disk full'),'write failure status');
 return {json:true,zip:true,cancel:true,writeFailure:true,missingResources:true};
}
