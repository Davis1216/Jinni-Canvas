async page => {
 const check=(v,m)=>{if(!v)throw Error(m)};
 await page.unroute('**/api/**');
 await page.route('**/api/**',route=>route.fulfill({json:new URL(route.request().url()).pathname==='/api/providers'?{providers:[{id:'yzstudio',name:'yzstudio',base_url:'https://yzstudio.vip/v1',protocol:'openai',image_models:[],chat_models:[],video_models:[],has_key:false}]}:{}}));
 const inspect=async locator=>locator.evaluate(el=>{
  const title=el.querySelector('.block-title'),desc=el.querySelector('.block-desc'),actions=el.querySelector('.models-toolbar-actions');
  const line=Number.parseFloat(getComputedStyle(title).lineHeight);
  const r=el.getBoundingClientRect(),t=title.getBoundingClientRect(),d=desc.getBoundingClientRect(),a=actions.getBoundingClientRect();
  return {width:r.width,titleWidth:t.width,titleLines:t.height/line,descriptionWidth:d.width,descriptionHeight:d.height,actionsInside:a.left>=r.left&&a.right<=r.right+1,overflow:el.scrollWidth>el.clientWidth+2};
 });
 const verify=async(locator,label)=>{
  const result=await inspect(locator);
  check(result.titleLines<=1.2&&result.descriptionWidth>=180&&result.descriptionHeight<130&&result.actionsInside&&!result.overflow,`${label}: ${JSON.stringify(result)}`);
  return result;
 };
 const results=[];
 await page.setViewportSize({width:1440,height:937});
 await page.goto('http://127.0.0.1:8766/static/index.html');
 await page.locator('button[title="设置"]').click();
 const toolbar=page.frameLocator('#frame-api-settings').locator('#modelsHead');
 await toolbar.waitFor();
 await toolbar.scrollIntoViewIfNeeded();
 results.push(await verify(toolbar,'Settings iframe'));
 await page.screenshot({path:'output/playwright/provider-text-settings.png'});
 for(const embedded of [true,false]){
  await page.goto(`http://127.0.0.1:8766/static/api-settings.html${embedded?'?embedded=1':''}`);
  await page.locator('#modelsHead').waitFor();
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>StudioTheme.apply(theme),theme);
   for(const width of [320,390,620,768,780,860,861,1024,1440]){
    await page.setViewportSize({width,height:900});await page.waitForTimeout(200);
    results.push(await verify(page.locator('#modelsHead'),`${embedded?'embedded':'standalone'} ${theme} ${width}`));
   }
  }
 }
 return {cases:results.length,textHorizontal:true,actionsInside:true};
}
