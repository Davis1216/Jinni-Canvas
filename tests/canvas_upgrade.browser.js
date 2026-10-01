async page => {
 const assert=(v,m)=>{if(!v)throw Error(m)},errors=[];page.on('pageerror',e=>errors.push(e.message));await page.unrouteAll({behavior:'ignoreErrors'});
 const base='http://127.0.0.1:8768';let generated=0,llm=0;
 const provider={id:'demo',name:'Demo',enabled:true,has_key:true,protocol:'openai',image_models:['image-test'],chat_models:['text-test'],video_models:['video-test'],key_scopes:{image:{configured:true},llm:{configured:true},video:{configured:true}}};
 const fixture={id:'upgrade',title:'升级验收',nodes:[],connections:[],viewport:{x:0,y:0,scale:1}};
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#8d87cb"/></svg>';
 await page.route('**/assets/**',r=>r.fulfill({contentType:'image/svg+xml',body:svg}));
 await page.route('**/api/**',r=>{const req=r.request(),p=new URL(req.url()).pathname;let result={};if(p==='/api/config')result={api_providers:[provider]};if(p==='/api/providers')result={providers:[provider]};if(p==='/api/canvases/upgrade')result={canvas:fixture};if(p==='/api/canvas-llm'){llm++;result={text:'生成的文本'}};if(p==='/api/canvas-image-tasks'&&req.method()==='POST'){generated++;result={task_id:'t'+generated}};if(p.startsWith('/api/canvas-image-tasks/'))result={status:'succeeded',result:{images:['/assets/'+p.split('/').pop()+'.png']}};if(p==='/api/canvas-video')result={videos:['/assets/movie.mp4']};return r.fulfill({json:result})});
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/static/canvas.html?id=upgrade');await page.waitForFunction(()=>!!canvas);
 const outputs=await page.evaluate(()=>{nodes=[{id:'llm',type:'llm',x:0,y:0},{id:'gen',type:'generator',x:400,y:0},{id:'vid',type:'video',x:800,y:0}];connections=[];const result=nodes.slice().map(n=>outputForNode(n).outputKind);const length=nodes.length;nodes.filter(n=>n.type!=='output').forEach(n=>outputForNode(n));if(nodes.length!==length)throw Error('duplicate outputs');return result});assert(outputs.join(',')==='text,single-image,video','default outputs');
 await page.evaluate(()=>{window.confirm=()=>{throw Error('unexpected confirmation')};deleteConnection(connections[0].id)});assert(await page.evaluate(()=>connections.length)===2,'delete connection');await page.evaluate(()=>performUndo());assert(await page.evaluate(()=>connections.length)===3,'undo connection');
 assert(!errors.length,errors.join('\n'));return {outputs,errors};
}
