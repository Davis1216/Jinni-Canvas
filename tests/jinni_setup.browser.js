async page => {
 const assert=(value,message)=>{if(!value)throw Error(message)};
 await page.goto('http://127.0.0.1:8772/');
 await page.locator('#root').waitFor();
 assert((await page.locator('#root').inputValue()).includes('setup-acceptance'),'Isolated data root');
 await page.locator('#source').selectOption('');
 await page.screenshot({path:'output/playwright/jinni-setup.png'});
 await page.locator('#start').click();
 await page.locator('button[title="设置"]').waitFor({timeout:60000});
 assert((await page.request.get('http://127.0.0.1:8772/api/setup/status')).status()===404,'Setup API removed');
 await page.locator('button[title="设置"]').click();
 await page.locator('[data-page="about"]').click();
 assert((await page.locator('[data-content="about"]').innerText()).includes('v1.0.0'),'Real backend entered main UI');
 await page.screenshot({path:'output/playwright/jinni-about-live.png'});
 return {initialization:true,backendHandoff:true,setupEndpointsClosed:true};
}
