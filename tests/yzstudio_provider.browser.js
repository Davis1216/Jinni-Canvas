async page => {
 const check=(v,m)=>{if(!v)throw Error(m)};
 await page.unroute('**/api/**');
 let stored=[{id:'custom',name:'其他平台',base_url:'https://example.com/v1',protocol:'openai',image_models:[],chat_models:[],video_models:[]},{id:'yzstudio',name:'yzstudio',base_url:'https://yzstudio.vip/v1',protocol:'openai',image_models:[],chat_models:[],video_models:[],has_key:false}];
 let writes=0,modelReads=0,failModels=false;
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let result={};
  if(path==='/api/providers'){
   if(req.method()==='PUT'){writes++;stored=req.postDataJSON().map(p=>{const {api_key,...rest}=p;return {...rest,has_key:!!api_key||stored.find(v=>v.id===p.id)?.has_key}})}
   result={providers:stored};
  }else if(path==='/api/providers/yzstudio/fetch-models'){
   modelReads++;if(failModels)return route.fulfill({status:503,json:{detail:'Unavailable'}});
   result={image_models:['image-demo'],chat_models:['chat-demo'],video_models:[]};
  }
  await route.fulfill({json:result});
 });
 await page.goto('http://127.0.0.1:8766/static/api-settings.html?embedded');
 await page.locator('#providerList .provider-card').first().waitFor();
 check((await page.locator('#providerList .provider-card').first().innerText()).includes('yzstudio'),'Built-in pinned before custom providers');
 check(await page.locator('.provider-website').getAttribute('href')==='https://yzstudio.vip','Pinned website');
 check(await page.locator('#deleteBtn').isHidden(),'Delete hidden');
 check(await page.locator('#nameInput').evaluate(el=>el.readOnly),'Name fixed');
 check(await page.locator('#baseInput').evaluate(el=>el.readOnly&&el.value==='https://yzstudio.vip/v1'),'URL fixed');
 check(await page.locator('#protocolInput').isDisabled(),'Protocol fixed');
 check(await page.locator('.provider-pinned .provider-card').getAttribute('draggable')===null,'Cannot drag built-in');
 await page.locator('#keyInput').fill('synthetic-browser-key');
 await page.locator('.api-page-save-btn').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('可以返回画布'));
 check(writes===2&&modelReads===1,'Save key then import and persist available models');
 check(stored.find(p=>p.id==='yzstudio').image_models[0]==='image-demo','Models persisted');
 await page.locator('#providerList .provider-card').filter({hasText:'其他平台'}).click();
 check(await page.locator('#deleteBtn').isVisible(),'Custom provider remains deletable');
 check(await page.locator('#baseInput').evaluate(el=>!el.readOnly),'Custom URL remains editable');
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>StudioTheme.apply(theme),theme);
  for(const width of [960,390,320]){
   await page.setViewportSize({width,height:800});
   check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+2),'No horizontal overflow');
   check(await page.locator('.provider-builtin-badge').evaluate(el=>getComputedStyle(el).whiteSpace==='nowrap'),'Badge stays horizontal');
  }
 }
 await page.screenshot({path:'output/playwright/yzstudio-320.png'});
 stored.find(p=>p.id==='yzstudio').image_models=[];stored.find(p=>p.id==='yzstudio').chat_models=[];failModels=true;
 await page.reload();await page.locator('#keyInput').fill('synthetic-retry-key');await page.locator('.api-page-save-btn').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('暂未读到'));
 check(stored.find(p=>p.id==='yzstudio').has_key,'Model failure preserves saved key');
 return {pinned:true,fixedIdentity:true,autoModels:true,customEditable:true,responsive:true,retrySafe:true};
}
