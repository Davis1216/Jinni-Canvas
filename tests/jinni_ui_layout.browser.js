async page => {
 const check=(v,m)=>{if(!v)throw Error(m)};
 const sizes=[1440,1024,768,620,390,320], results=[];
 await page.unroute('**/api/**');
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;
  let result={};
  if(path==='/api/providers')result={providers:[{id:'layout-test',name:'图像与视频创作平台',base_url:'https://api.example.com/v1',protocol:'openai',has_key:false,image_models:['image-test'],chat_models:[],video_models:[]}]};
  if(path==='/api/ui-preferences')result={enabled:true,bindings:{}};
  if(path==='/api/setup/status')result={root:'/Users/test/中文创作空间/.jinni-canvas',sources:[],hasData:false,busy:false,error:'',progress:'',complete:false};
  return route.fulfill({json:result});
 });
 await page.goto('http://127.0.0.1:8766/static/index.html');
 await page.locator('button[title="设置"]').click();
 for(const theme of ['light','dark']) {
  await page.evaluate(theme=>{localStorage.setItem('studio_theme',theme);StudioTheme.apply(theme)},theme);
  for(const width of sizes) {
   await page.setViewportSize({width,height:width<500?700:900});
   await page.waitForTimeout(150); // Allow the host resize/scale debounce and paint to settle.
   await page.locator('[data-page="shortcuts"]').click();
   const inspect=await page.locator('#jinniSettings').evaluate(dialog=>{
    const d=dialog.getBoundingClientRect();
    const bad=[...dialog.querySelectorAll('button')].filter(el=>el.getClientRects().length).filter(el=>{
     const s=getComputedStyle(el),r=el.getBoundingClientRect();
     return s.whiteSpace!=='nowrap'||el.scrollWidth>el.clientWidth+2||r.left<d.left||r.right>d.right+1;
    }).map(el=>el.textContent);
    const footer=dialog.querySelector('.jinni-settings-footer').getBoundingClientRect();
    return {bad,overflow:dialog.scrollWidth>dialog.clientWidth+1,footerVisible:footer.bottom<=d.bottom};
   });
   check(!inspect.overflow&&inspect.bad.length===0&&inspect.footerVisible,`Shortcut layout ${theme} ${width}: ${JSON.stringify(inspect)}`);
   const before=await page.locator('[data-save]').boundingBox();
   await page.locator('#jinniKeyRows').evaluate(el=>el.scrollTop=el.scrollHeight);
   const after=await page.locator('[data-save]').boundingBox();
   check(Math.abs(before.y-after.y)<1,'Save footer must remain visible while scrolling');
   await page.locator('#jinniKeyRows').evaluate(el=>el.scrollTop=0);
   if([1440,390,320].includes(width))await page.screenshot({path:`output/playwright/ui-shortcuts-${theme}-${width}.png`});
   await page.locator('[data-page="about"]').click();
   check(await page.locator('[data-content="about"]').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'About has no horizontal overflow');
   if(width===1440&&theme==='light')await page.screenshot({path:'output/playwright/ui-about.png'});
   results.push({theme,width,buttonsHorizontal:true,footerVisible:true});
  }
 }
 await page.locator('[data-page="providers"]').click();
 const provider=page.frameLocator('#frame-api-settings');
 await provider.locator('#nameInput').waitFor();
 for(const width of [1440,768,390,320]) {
  await page.setViewportSize({width,height:900});
  await page.waitForTimeout(150);
  const bounds=await provider.locator('body').evaluate(el=>({scroll:el.scrollWidth,client:document.documentElement.clientWidth,buttons:[...document.querySelectorAll('.content-actions button')].filter(b=>b.getClientRects().length).map(b=>({text:b.textContent,nowrap:getComputedStyle(b).whiteSpace==='nowrap',overflow:b.scrollWidth>b.clientWidth+2}))}));
  check(bounds.scroll<=bounds.client+2&&bounds.buttons.every(b=>b.nowrap&&!b.overflow),`Provider layout ${width}: ${JSON.stringify(bounds)}`);
  if(width===1440||width===390)await page.screenshot({path:`output/playwright/ui-providers-${width}.png`});
 }
 await page.goto('http://127.0.0.1:8766/static/setup.html');
 await page.waitForFunction(()=>document.querySelector('#root').value.includes('创作空间'));
 for(const theme of ['light','dark']){
  await page.emulateMedia({colorScheme:theme});
  for(const width of [1440,620,390,320]) {
   await page.setViewportSize({width,height:800});
   await page.waitForTimeout(150);
   check(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),'Setup has no horizontal overflow');
   check(await page.locator('#browse').evaluate(el=>getComputedStyle(el).whiteSpace==='nowrap'&&el.scrollWidth<=el.clientWidth+1),'Folder button stays horizontal');
   if(width===1440||width===390)await page.screenshot({path:`output/playwright/ui-setup-${theme}-${width}.png`});
  }
 }
 return {settings:results,providers:true,setup:true};
}
