// Local static server on 8766; all data writes are mocked.
async (page) => {
    const check=(v,m)=>{if(!v)throw new Error(m);};
    const item=(id,title)=>({id,title,category_id:'uncategorized',image_url:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',prompt:'提示词',created_at:1});
    let space={categories:[{id:'uncategorized',name:'未分类'}],items:[item('a','原有灵感')]};
    let reads=0,held=null,holdNext=false;
    await page.route('**/api/**',async route=>{
        const r=route.request(),p=new URL(r.url()).pathname;
        if(p==='/api/inspiration-space/items' && r.method()==='POST'){
            space.items.push(item('saved','画布收藏'));
            return route.fulfill({json:{space}});
        }
        if(p==='/api/inspiration-space'){
            reads++;
            const snapshot=JSON.parse(JSON.stringify(space));
            if(holdNext){holdNext=false;await new Promise(resolve=>held=resolve);}
            return route.fulfill({json:{space:snapshot}});
        }
        if(p.startsWith('/api/inspiration-space/items/') && r.method()==='PATCH'){
            space.items[0]={...space.items[0],...r.postDataJSON()};
            return route.fulfill({json:{space}});
        }
        return route.fulfill({json:{}});
    });
    await page.goto('http://127.0.0.1:8766/static/index.html');
    await page.evaluate(()=>switchUI(null,'inspiration-space'));
    const frame=page.frameLocator('#frame-inspiration-space');
    await frame.locator('.insp-card').waitFor();
    await page.evaluate(()=>switchUI(null,'canvas'));
    space.items.push(item('b','新加入的灵感'));
    await page.evaluate(()=>switchUI(null,'inspiration-space'));
    await frame.locator('[data-item-id="b"]').waitFor({timeout:3000});
    const loaded=reads;
    await page.evaluate(()=>localStorage.setItem('inspiration-space-changed',String(Date.now())));
    await page.waitForTimeout(150);
    check(reads>loaded,'Change notification must refresh immediately');
    const sameCard=await frame.locator('[data-item-id="a"]').evaluate(el=>{window.retainedCard=el;return true;});
    await page.evaluate(()=>localStorage.setItem('inspiration-space-changed',String(Date.now())));
    await page.waitForTimeout(150);
    check(await frame.locator('[data-item-id="a"]').evaluate(el=>el===window.retainedCard),'Unchanged data must retain gallery DOM');
    await frame.locator('[data-edit-item="a"]').click();
    await frame.locator('#titleInput').fill('尚未提交的编辑');
    space.items.push(item('c','外部新增'));
    await page.evaluate(()=>localStorage.setItem('inspiration-space-changed',String(Date.now())));
    await frame.locator('[data-item-id="c"]').waitFor();
    check(await frame.locator('#titleInput').inputValue()==='尚未提交的编辑','Refresh must preserve unsaved form input');
    holdNext=true;
    await page.evaluate(()=>localStorage.setItem('inspiration-space-changed',String(Date.now())));
    for(let i=0;i<30 && !held;i++)await page.waitForTimeout(20);
    check(held,'Delayed refresh must start');
    await frame.locator('#editForm').evaluate(form=>form.requestSubmit());
    await frame.locator('#editModal').waitFor({state:'hidden'});
    held();held=null;
    await page.waitForTimeout(250);
    check(await frame.locator('[data-item-id="a"] .card-title').textContent()==='尚未提交的编辑','Stale GET must not overwrite a successful edit');
    await page.evaluate(()=>switchUI(null,'canvas'));
    await page.waitForTimeout(150);
    const beforeHidden=reads;
    await page.waitForTimeout(5200);
    check(reads===beforeHidden,'Hidden frames must not poll');
    await page.evaluate(()=>switchUI(null,'inspiration-space'));
    await page.waitForTimeout(200);
    space.items.push(item('d','轮询发现的更新'));
    await frame.locator('[data-item-id="d"]').waitFor({timeout:6500});
    const source=await page.context().newPage();
    await source.route('**/api/**',async route=>{
        const p=new URL(route.request().url()).pathname;
        if(p==='/api/inspiration-space/items'){
            space.items.push(item('saved','画布收藏'));
            return route.fulfill({json:{space}});
        }
        return route.fulfill({json:{}});
    });
    await source.goto('http://127.0.0.1:8766/static/canvas.html');
    source.on('dialog',dialog=>dialog.accept());
    const notified=await source.evaluate(async()=>{
        localStorage.removeItem('inspiration-space-changed');
        currentOutputLightboxUrl='/assets/test.png';
        await addCurrentOutputToInspiration();
        return !!localStorage.getItem('inspiration-space-changed');
    });
    check(notified,'Saving from canvas must publish a successful change notification');
    await source.close();
    await page.bringToFront();
    await frame.locator('[data-item-id="saved"]').waitFor({timeout:3000});
    return {canvasSaveNotification:true,returnRefresh:true,changeNotification:true,stableDOM:true,preservedDraft:true,staleResponseGuard:true,hiddenPollingPaused:true,visiblePolling:true,reads};
}
