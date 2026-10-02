import {test,expect} from '@playwright/test';
import {prepareVisualApp} from './fixtures/visual-app';
test('support default exposes agent conversations and URL status filters survive reload',async({page})=>{
 await prepareVisualApp(page,'en');await page.route('https://api.entix.io/me',r=>r.fulfill({json:{isPlatformAdmin:true,memberships:[]}}));
 await page.route('**/api/support/config',r=>r.fulfill({json:{whatsapp:'966593305959',email:'support@entix.io'}}));
 const queries:string[]=[];
 await page.route('**/api/admin/**',r=>{const url=new URL(r.request().url());if(url.pathname.endsWith('/me'))return r.fulfill({json:{isSuper:true,permissions:['*']}});if(url.pathname.endsWith('/tickets')){queries.push(url.search);return r.fulfill({json:{tickets:[{id:'t1',subject:'Synthetic pricing question',channel:'whatsapp',status:'OPEN',priority:'NORMAL',needsHuman:false,updatedAt:new Date().toISOString()}]}})}return r.fulfill({json:{items:[]}})});
 await page.goto('/admin/support');await expect(page.getByText('Synthetic pricing question',{exact:true})).toBeVisible();expect(queries.at(-1)).not.toContain('needsHuman');
 await page.goto('/admin/support?status=ACTIVE');await expect.poll(()=>queries.at(-1)).toContain('status=ACTIVE');await page.reload();await expect(page.getByText('Synthetic pricing question',{exact:true})).toBeVisible();expect(queries.at(-1)).toContain('status=ACTIVE');
 await page.screenshot({path:'/tmp/entix-admin-inbox-order.png',fullPage:true});
});
test('authenticated customer starts assistant chat without entering a ticket subject',async({page})=>{
 await prepareVisualApp(page,'en');let input:any=null;
 const ticket={id:'t1',subject:'What plans are available?',status:'OPEN',updatedAt:new Date().toISOString(),messages:[{id:'m1',authorType:'AI',body:'Synthetic catalog response',createdAt:new Date().toISOString()}]};
 await page.route('**/api/public/support/portal**',r=>{if(r.request().method()==='POST'){input=r.request().postDataJSON();return r.fulfill({status:201,json:{ticket}})}return r.fulfill({json:new URL(r.request().url()).pathname.endsWith('/portal')?{items:input?[ticket]:[]}:{ticket}})});
 await page.goto('/app/help');await page.getByRole('button',{name:'Ask support assistant',exact:true}).click();await page.getByRole('textbox',{name:'How can we help?'}).fill('What plans are available?');await page.getByRole('button',{name:'Send to support',exact:true}).click();await expect(page.getByText('Synthetic catalog response',{exact:true})).toBeVisible();expect(input.assistant).toBe(true);expect(input.subject).toBe('What plans are available?');
});
