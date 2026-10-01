async page => {
 await page.unrouteAll({behavior:'ignoreErrors'});const assert=(ok,msg)=>{if(!ok)throw Error(msg)},errors=[];page.on('pageerror',e=>errors.push(e.message));let refreshed=0;
 const provider={id:'yzstudio',name:'yzstudio',base_url:'https://yzstudio.vip/v1',enabled:true,protocol:'openai',has_key:true,image_models:['gpt-image-1'],chat_models:['gpt-4.1'],video_models:['sora'],key_scopes:{llm:{configured:true,source:'global'},image:{configured:true,source:'independent'},video:{configured:true,source:'global'}}};
 await page.route('**/api/**',r=>{const url=new URL(r.request().url());let data={};if(url.pathname==='/api/providers')data={providers:[provider,{...provider,id:'custom',name:'自定义供应商',base_url:'https://example.com/v1'}]};if(url.pathname.endsWith('/usage')){if(url.searchParams.get('refresh')==='true')refreshed++;data={entries:[{status:'ok',scopes:['global','llm','video'],key_quota:{remaining:128.5,unit:'USD'},balance:200,unit:'USD',updated_at:'2026-10-01T02:00:00Z'},{status:'ok',scopes:['image'],key_quota:{remaining:45,unit:'USD'},updated_at:'2026-10-01T02:00:00Z'}]}}return r.fulfill({json:data})});
 await page.setViewportSize({width:1200,height:950});await page.goto('http://127.0.0.1:8768/static/api-settings.html?embedded=1');await page.locator('.usage-entry').first().waitFor();
 assert(await page.locator('#providerUsage').evaluate(el=>el.compareDocumentPosition(document.querySelector('#providerConnection'))&Node.DOCUMENT_POSITION_FOLLOWING),'quota before connection fields');
 assert(await page.locator('.usage-refresh').innerText()==='','refresh is icon only');
 await page.getByRole('button',{name:'刷新额度',exact:true}).click();assert(refreshed===1,'refresh makes request');
 await page.getByRole('textbox',{name:'图像 API Key',exact:true}).fill('synthetic-only');
 await page.locator('.provider-key-row').filter({hasText:'图像'}).getByRole('button',{name:'恢复继承'}).click();
 assert(await page.locator('.provider-key-row').filter({hasText:'图像'}).locator('small').innerText()==='继承全局 Key','scope returns to global');
 await page.locator('#providerKeyPurpose').selectOption('image');assert(await page.locator('#providerKeyPurpose').inputValue()==='image','test scope selectable');
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>StudioTheme.set(theme),theme);
  for(const width of [1200,780,620,390,320]){
   await page.setViewportSize({width,height:950});await page.evaluate(()=>window.scrollTo(0,0));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert(!overflow,theme+' horizontal overflow at '+width);
   const controls=await page.locator('#providerKeyScopes button').evaluateAll(buttons=>buttons.every(b=>b.getBoundingClientRect().right<=innerWidth+1));assert(controls,'key actions overflow at '+width);
   if(width===1200)await page.screenshot({path:'output/playwright/providers-'+theme+'.png'});
   if(width===390&&theme==='dark')await page.screenshot({path:'output/playwright/providers-narrow.png'});
  }
 }
 await page.setViewportSize({width:1200,height:950});
 await page.goto('http://127.0.0.1:8768/static/index.html');await page.waitForFunction(()=>!!window.openJinniSettings);await page.evaluate(()=>openJinniSettings('providers'));
 const frame=page.frameLocator('#frame-api-settings');await frame.locator('.usage-entry').first().waitFor();
 await page.screenshot({path:'output/playwright/providers-dialog.png'});
 await frame.locator('#providerKeyScopes').scrollIntoViewIfNeeded();
 await page.screenshot({path:'output/playwright/providers-keys-dialog.png'});
 await frame.locator('.model-grid').scrollIntoViewIfNeeded();
 await page.screenshot({path:'output/playwright/providers-models-dialog.png'});
 assert(await frame.locator('.api-page-save-btn').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),'save remains in viewport while editing models');
 assert(!errors.length,errors.join('\n'));return {quotaTop:true,iconRefresh:true,scopeInheritance:true,layouts:10,errors};
}
