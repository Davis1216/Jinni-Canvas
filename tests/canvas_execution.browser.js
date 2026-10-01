async page => {
  await page.unrouteAll({behavior:'ignoreErrors'});
  const assert=(ok,message)=>{if(!ok)throw Error(message)};
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let submitted=0,textRequests=0,videoRequests=0,failSubmission=0,checkedOutput=0,failQuery=false;
  const provider={id:'demo',name:'Demo',enabled:true,has_key:true,protocol:'openai',image_models:['image-test'],chat_models:['text-test'],video_models:['video-test']};
  const fixture={id:'execution',title:'执行验收',nodes:[],connections:[],viewport:{x:0,y:0,scale:1}};
  await page.route('**/assets/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#8982cc"/></svg>'}));
  await page.route('**/api/**',async r=>{
    const path=new URL(r.request().url()).pathname;let data={};
    if(path==='/api/config')data={api_providers:[provider]};
    if(path==='/api/canvases/execution')data={canvas:fixture};
    if(path==='/api/canvas-llm'){textRequests++;data={text:'测试文本'};}
    if(path==='/api/canvas-video'){videoRequests++;data={videos:['/assets/test.mp4']};}
    if(path==='/api/canvas-image-tasks'&&r.request().method()==='POST'){
      submitted++;if(submitted===failSubmission)return r.fulfill({status:503,json:{detail:'测试：第二项提交失败'}});
      data={task_id:'run-'+submitted};
    }
    if(path.startsWith('/api/canvas-image-tasks/')&&failQuery){failQuery=false;return r.fulfill({status:503,json:{detail:'query temporarily unavailable'}});}
    if(path.startsWith('/api/canvas-image-tasks/'))data={status:'succeeded',result:{images:['/assets/'+path.split('/').pop()+'.png']}};
    if(['/api/canvas-llm','/api/canvas-image-tasks','/api/canvas-video'].includes(path)&&page.url().includes('/canvas.html')){
      assert(await page.evaluate(()=>nodes.some(n=>n.type==='output')),'output must exist before submission');checkedOutput++;
    }
    return r.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:8768/static/canvas.html?id=execution');await page.waitForFunction(()=>!!canvas);
  const classic=await page.evaluate(async()=>{
    nodes=[];connections=[];window.alert=message=>{throw Error(message)};
    addLLMNode({x:0,y:0});const llm=nodes.find(n=>n.type==='llm');llm.userInput='描述森林';llm.llmProvider='demo';llm.model='text-test';
    await runLLMNode(llm.id);await runLLMNode(llm.id);
    const textOutput=nodes.find(n=>n.outputKind==='text');if(!textOutput?.texts?.length)throw Error('missing text result');
    addPromptNode({x:0,y:500});const prompt=nodes.find(n=>n.type==='prompt');prompt.text='画一片森林';
    addGeneratorNode({x:400,y:500});const gen=nodes.find(n=>n.type==='generator');gen.apiProvider='demo';gen.model='image-test';gen.count=2;
    connections.push({id:'input',from:prompt.id,to:gen.id});render();await runGenerator(gen.id);
    const imageOutput=nodes.find(n=>n.outputKind==='single-image');
    if(!imageOutput)throw Error('missing automatic image output');
    const all=[...(imageOutput.images||[]),...(imageOutput.roundCandidates||[])];
    if(new Set(all.map(x=>typeof x==='string'?x:x.url)).size!==2)throw Error('batch results lost');
    const legacy={id:'mixed',type:'output',outputKind:'general',x:0,y:1000,images:[{url:'/assets/old.mp4',kind:'video'},{url:'/assets/old.png',kind:'image'}],texts:[{text:'旧文本'}]};nodes.push(legacy);normalizeCanvasOutputGraph();
    if(legacy.images.length!==2||legacy.texts.length!==1)throw Error('legacy content lost');
    return {textOutputs:nodes.filter(n=>n.outputKind==='text').length,imageKind:imageOutput.outputKind,batch:all.length,legacy:true};
  });
  assert(classic.textOutputs===1,'repeated LLM must reuse output');assert(checkedOutput===4,'all classic requests checked');
  assert(!errors.length,errors.join('\n'));return {classic,checkedOutput,errors};
}
