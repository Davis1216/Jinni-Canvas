async (page) => {
 const assert=(v,m)=>{if(!v)throw Error(m)};
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture={id:'settings-test',title:'设置交互验证',nodes:[{id:'p1',type:'prompt',x:100,y:100,text:'test'},{id:'p2',type:'prompt',x:500,y:100,text:'test 2'}],connections:[{id:'link1',from:'p1',to:'p2'}],viewport:{x:0,y:0,scale:1}};
 let preferences={enabled:true,bindings:{}};
 let library={active_library_id:'default',libraries:[{id:'default',name:'测试素材库',categories:[{id:'photos',name:'图片',type:'image',items:[]}]}]};
 let saves=0;
 await page.route('**/api/**',async route=>{
  const r=route.request(),path=new URL(r.url()).pathname;let result={};
  if(path==='/api/ui-preferences'){if(r.method()==='PUT')preferences=r.postDataJSON();result=preferences}
  else if(path.endsWith('/canvases/settings-test'))result={canvas:fixture};
  else if(path==='/api/asset-library')result={library};
  else if(path==='/api/asset-library/categories'){const data=r.postDataJSON();const cat={id:'new',name:data.name,type:'image',items:[]};library.libraries[0].categories.push(cat);result={library,category:cat}}
  else if(path==='/api/asset-library/items'){saves++;result={library,item:{id:'saved'}}}
  else if(path==='/api/providers')result={providers:[]};
  await route.fulfill({json:result});
 });
 await page.goto('http://127.0.0.1:8766/static/index.html');
 await page.locator('button[title="设置"]').click();
 assert(await page.locator('#jinniSettings').isVisible(),'Settings modal opened');
 await page.locator('[data-page="about"]').click();
 assert((await page.locator('[data-content="about"]').innerText()).includes('QQ1270034721'),'About metadata');
 await page.locator('[data-page="shortcuts"]').click();
 const row=page.locator('.jinni-shortcut-row').filter({hasText:'上传图片'});
 await row.locator('.binding').click();await page.keyboard.press('P');
 assert((await page.locator('.jinni-message').innerText()).includes('冲突'),'Conflict blocked');
 await page.keyboard.press('U');await page.locator('[data-save]').click();
 await page.waitForFunction(()=>document.querySelector('#jinniSettings .jinni-message').textContent.includes('已保存'));
 assert(preferences.bindings.image==='U','Shortcut persisted');
 await page.screenshot({path:'output/playwright/jinni-settings.png'});
 await page.locator('[data-close]').click();
 await page.locator('#frame-canvas').evaluate(frame=>frame.src='/static/canvas.html?id=settings-test');
 const frame=page.frameLocator('#frame-canvas');await frame.locator('.node').first().waitFor();
 await frame.locator('[data-command="selectAll"]').waitFor();
 assert(await frame.locator('#toolSelectBtn,#toolPanBtn').count()===0,'Mode buttons removed');
 await frame.locator('[data-command="selectAll"]').click();
 assert(await frame.locator('#board').evaluate(()=>selected.size)===2,'Select all button');
 const mod=await page.evaluate(()=>/Mac/.test(navigator.platform)?'Meta':'Control');
 await frame.locator('#board').evaluate(()=>{selected.clear();refreshSelectionVisuals()});
 await page.keyboard.press(`${mod}+a`);
 assert(await frame.locator('#board').evaluate(()=>selected.size)===2,'Select all shortcut');
 const input=frame.locator('[contenteditable="true"]').first();await input.focus();await page.keyboard.press(`${mod}+a`);
 assert(await input.evaluate(el=>window.getSelection().toString()===el.textContent),'Editor native selection');
 await frame.locator('#board').evaluate(()=>document.activeElement.blur());
 await frame.locator('#board').evaluate(()=>window.confirm=()=>false);await frame.locator('#dockDeleteBtn').click();
 assert(await frame.locator('#board').evaluate(()=>nodes.length)===2,'Cancel delete preserves nodes');
 await frame.locator('#board').evaluate(()=>{window.confirm=()=>true;window.alert=()=>{}});await frame.locator('#dockDeleteBtn').click();
 assert(await frame.locator('#board').evaluate(()=>nodes.length)===0,'Confirmed delete');
 await frame.locator('#dockUndoBtn').click();assert(await frame.locator('#board').evaluate(()=>nodes.length)===2,'Undo deletion');
 await frame.locator('#board').evaluate(()=>{JinniShortcuts.apply({enabled:false,bindings:{}});selected.clear();refreshSelectionVisuals()});await page.keyboard.press(`${mod}+a`);
 assert(await frame.locator('#board').evaluate(()=>selected.size===0&&!window.getSelection().toString()),'Disabled select all blocks browser text');
 await frame.locator('#board').evaluate(()=>{JinniShortcuts.apply({enabled:true,bindings:{}});});
 await page.locator('button[title="设置"]').click();
 const count=await frame.locator('#board').evaluate(()=>nodes.length);
 await frame.locator('#board').evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'P',bubbles:true})));
 assert(await frame.locator('#board').evaluate(()=>nodes.length)===count,'Settings blocks background keys');
 await page.locator('[data-close]').click();
 await frame.locator('#board').evaluate(()=>openJinniLibraryPicker('/assets/input/test.png','test'));
 await frame.locator('[data-name]').fill('新分类');await frame.locator('[data-create]').click();
 await frame.locator('[data-category] option[value="new"]:checked').waitFor({state:'attached'});
 assert(await frame.locator('[data-category]').inputValue()==='new','New category selected');
 await frame.locator('#board').evaluate(()=>{window.confirm=()=>true;window.alert=()=>{}});await frame.locator('.jinni-library-picker [data-save]').click();
 await frame.locator('.jinni-library-picker').waitFor({state:'hidden'});
 assert(saves===1,'Original saved once');
 await page.screenshot({path:'output/playwright/jinni-canvas.png'});
 assert(errors.length===0,`Runtime errors: ${errors.join('; ')}`);
 return {settings:true,conflictDetection:true,persistence:true,selectAll:true,inputSelection:true,deletionConfirmation:true,undo:true,disabledKeys:true,modalIsolation:true,librarySave:true};
}
