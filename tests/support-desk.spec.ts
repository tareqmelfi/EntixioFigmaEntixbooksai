import { test, expect } from '@playwright/test';
import { prepareVisualApp } from './fixtures/visual-app';
for (const lang of ['en','ar'] as const) test(`support operator creates, updates, notes, takes over and reviews agent drafts (${lang})`, async ({page}) => {
 await prepareVisualApp(page,lang);
 await page.route('https://api.entix.io/me',r=>r.fulfill({json:{isPlatformAdmin:true,memberships:[]}}));
 if(lang==='ar') await page.setViewportSize({width:390,height:844});
 let ticket:any={id:'t1',subject:'Synthetic print issue',channel:'whatsapp',status:'OPEN',priority:'NORMAL',needsHuman:true,category:'support',contactName:'Synthetic customer',updatedAt:'2026-09-28T10:00:00Z',messages:[],meta:{}};
 let drafts=0;const mutations:any[]=[];
 await page.route('**/api/admin/**',async r=>{
  const path=new URL(r.request().url()).pathname,method=r.request().method();
  if(path==='/api/admin/me')return r.fulfill({json:{isInternal:true,isSuper:true,permissions:['*'],email:'operator@example.invalid',userId:'u1'}});
  if(path==='/api/admin/support/threads')return r.fulfill({json:{items:[]}});
  if(path==='/api/admin/tickets' && method==='POST'){ticket={...ticket,...r.request().postDataJSON(),id:'t2',channel:'admin',messages:[]};mutations.push(r.request().postDataJSON());return r.fulfill({json:{ticket},status:201});}
  if(path==='/api/admin/tickets')return r.fulfill({json:{tickets:[ticket]}});
  if(path.endsWith('/draft')){drafts++;return r.fulfill({json:{draft:'Please describe the print problem.',handoff:false}});}
  if(path.endsWith('/messages')){const data=r.request().postDataJSON();mutations.push(data);ticket.messages.push({id:`m${mutations.length}`,authorType:data.internal?'NOTE':'ADMIN',body:data.body,createdAt:'2026-09-28T10:00:00Z'});return r.fulfill({json:{delivery:{sent:false,reason:data.internal?'internal_note':'webhook_not_configured'}}});}
  if(method==='PATCH'){const data=r.request().postDataJSON();mutations.push(data);ticket={...ticket,...data,meta:{supportAgentMode:data.agentMode||ticket.meta.supportAgentMode},needsHuman:data.agentMode?data.agentMode==='human':ticket.needsHuman};return r.fulfill({json:{ticket}});}
  if(path.startsWith('/api/admin/tickets/'))return r.fulfill({json:{ticket}});
  return r.fulfill({json:{items:[]}});
 });
 await page.route('**/api/support/config',r=>r.fulfill({json:{whatsapp:'966593305959',email:'support@entix.io'}}));
 await page.goto('/admin/support?ticket=t1');
 await expect(page.getByRole('link',{name:/Support WhatsApp|رقم واتساب الدعم/})).toHaveAttribute('href','https://wa.me/966593305959');
 await expect(page.getByRole('button',{name:lang==='ar'?'إعادة للوكيل':'Return to agent',exact:true})).toBeVisible();
 await page.getByRole('button',{name:lang==='ar'?'إعادة للوكيل':'Return to agent',exact:true}).click();
 await page.getByRole('button',{name:lang==='ar'?'استلام المحادثة':'Take over',exact:true}).click();
 expect(mutations.slice(-2).map(x=>x.agentMode)).toEqual(['auto','human']);
 await page.getByRole('combobox',{name:lang==='ar'?'أولوية التذكرة':'Ticket priority'}).selectOption('HIGH');
 await page.getByRole('button',{name:lang==='ar'?'اقتراح رد بالوكيل':'Draft with agent',exact:true}).click();
 const message=page.getByRole('textbox',{name:lang==='ar'?'نص المتابعة':'Follow-up message'});
 await expect(message).toHaveValue('Please describe the print problem.');expect(drafts).toBe(1);expect(ticket.messages).toHaveLength(0);
 await page.getByRole('button',{name:lang==='ar'?'إرسال الرد':'Send reply',exact:true}).click();
 await expect(page.getByText(lang==='ar'?'حُفظ الرد وتعذّر تأكيد إرساله إلى واتساب. راجع حالة الإرسال قبل إعادة المحاولة.':'Reply saved but WhatsApp sending could not be confirmed. Check delivery before retrying.',{exact:true})).toBeVisible();
 await page.getByRole('checkbox',{name:lang==='ar'?'ملاحظة داخلية لفريق الدعم فقط':'Internal note for the support team only'}).check();
 await message.fill('Internal diagnostic note');await page.getByRole('button',{name:lang==='ar'?'حفظ الملاحظة':'Save note',exact:true}).click();
 await expect(page.getByText('Internal diagnostic note',{exact:true}).last()).toBeVisible();expect(mutations.at(-1).internal).toBe(true);
 await page.getByRole('button',{name:lang==='ar'?'تذكرة جديدة':'New ticket',exact:true}).click();
 await page.getByRole('textbox',{name:lang==='ar'?'موضوع التذكرة':'Ticket subject',exact:true}).first().fill('Manual call follow-up');
 await page.getByRole('button',{name:lang==='ar'?'إنشاء التذكرة':'Create ticket',exact:true}).click();
 await expect(page).toHaveURL(/ticket=t2/);
 await expect(page.getByRole('textbox',{name:lang==='ar'?'موضوع التذكرة':'Ticket subject',exact:true})).toHaveValue('Manual call follow-up');
 await expect(page.getByText(lang==='ar'?'تم إنشاء التذكرة الداخلية':'Internal ticket created',{exact:true})).toBeHidden();
 await page.screenshot({path:`/tmp/entix-support-desk-${lang}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});

test('late ticket response cannot replace the selected customer', async ({page}) => {
 await prepareVisualApp(page,'en');
 await page.route('https://api.entix.io/me',r=>r.fulfill({json:{isPlatformAdmin:true,memberships:[]}}));
 const make=(id:string)=>({id,subject:`Request ${id}`,contactName:`Customer ${id}`,channel:'web',status:'OPEN',priority:'NORMAL',needsHuman:true,updatedAt:'2026-09-28T10:00:00Z',messages:[],meta:{}});
 let releaseA!:()=>void;const delayed=new Promise<void>(resolve=>releaseA=resolve);let requestedA=false;let repliedTo='';
 await page.route('**/api/admin/**',async r=>{
  const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/me'))return r.fulfill({json:{permissions:['*'],isSuper:true,assignedOrgIds:null}});
  if(path==='/api/admin/tickets')return r.fulfill({json:{tickets:[make('A'),make('B')]}});
  if(path==='/api/admin/tickets/A'){requestedA=true;await delayed;return r.fulfill({json:{ticket:make('A')}});}
  if(path.endsWith('/messages')){repliedTo=path;return r.fulfill({json:{delivery:{sent:false,reason:'no_dispatch_needed'}}});}
  if(path==='/api/admin/tickets/B')return r.fulfill({json:{ticket:make('B')}});
  return r.fulfill({json:{items:[]}});
 });
 await page.route('**/api/support/config',r=>r.fulfill({json:{whatsapp:'966593305959'}}));
 await page.goto('/admin/support?ticket=A');
 await expect.poll(()=>requestedA).toBe(true);
 await page.getByRole('button',{name:/Customer B/}).click();
 await expect(page.getByRole('textbox',{name:'Ticket subject',exact:true})).toHaveValue('Request B');
 releaseA();
 await page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/tickets/A');
 await expect(page.getByRole('textbox',{name:'Ticket subject',exact:true})).toHaveValue('Request B');
 await page.getByRole('textbox',{name:'Follow-up message'}).fill('Reply for B');
 await page.getByRole('button',{name:'Send reply',exact:true}).click();
 await expect.poll(()=>repliedTo).toBe('/api/admin/tickets/B/messages');
});
