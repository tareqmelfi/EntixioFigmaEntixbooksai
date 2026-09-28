import {test,expect} from '@playwright/test';
import {prepareVisualApp} from './fixtures/visual-app';
const count={channels:{whatsapp:2},categories:{payouts:2},total:8,open:3,pending:1,resolved:3,closed:1,needsReply:2,urgent:1,replies:6,responseSamples:3,resolutionSamples:4,ratings:3,positive:2,neutral:0,negative:1,averageResponseMs:600000,averageResolutionMs:7200000,averageRating:4};
for(const lang of ['ar','en'] as const) for(const width of [390,1280,1920]) test(`support KPI and ticket workspace uses viewport (${lang}, ${width})`,async({page})=>{
 await prepareVisualApp(page,lang);await page.setViewportSize({width,height:1000});
 await page.route('https://api.entix.io/me',r=>r.fulfill({json:{isPlatformAdmin:true,memberships:[]}}));
 const ticket={id:'ticket1',subject:'Partner payout follow-up',contactName:'Synthetic partner',channel:'web',category:'payouts',priority:'URGENT',status:'RESOLVED',needsHuman:false,assignedAgentEmail:'operator@example.invalid',updatedAt:'2026-09-28T10:00:00Z',messages:[{id:'m1',authorType:'ADMIN',authorEmail:'operator@example.invalid',body:'Synthetic reviewed reply',createdAt:'2026-09-28T10:00:00Z'}]};
 const requests:string[]=[];
 await page.route('**/api/admin/**',async r=>{
 const url=new URL(r.request().url());requests.push(url.pathname+url.search);
 if(url.pathname.endsWith('/me'))return r.fulfill({json:{isInternal:true,isSuper:true,permissions:['*'],email:'operator@example.invalid',assignedOrgIds:null}});
 if(url.pathname.endsWith('/metrics'))return r.fulfill({json:{overall:count,agents:[{...count,email:'operator@example.invalid',resolved:2,averageRating:4.5}],channels:{web:6,whatsapp:2},categories:{payouts:5,support:3},unattributedResolutions:1,currentAgent:'operator@example.invalid',since:null,generatedAt:'2026-09-28T10:00:00Z'}});
 if(url.pathname==='/api/admin/tickets')return r.fulfill({json:{tickets:[ticket]}});
 if(url.pathname==='/api/admin/tickets/ticket1')return r.fulfill({json:{ticket}});
 return r.fulfill({json:{items:[]}});
 });
 await page.route('**/api/support/config',r=>r.fulfill({json:{whatsapp:'966593305959',email:'support@entix.io'}}));
 await page.goto('/admin/support?ticket=ticket1');
 const dashboard=page.getByRole('region',{name:lang==='ar'?'مؤشرات الدعم الفني':'Support performance'});
 await expect(dashboard.getByText('4.0 / 5',{exact:true})).toBeVisible();
 await dashboard.getByRole('combobox',{name:lang==='ar'?'عرض الأداء':'Performance view'}).selectOption('mine');
 await expect(dashboard.getByText('4.5 / 5',{exact:true}).first()).toBeVisible();
 await dashboard.getByRole('combobox',{name:lang==='ar'?'الفترة':'Period',exact:true}).selectOption('7');
 await expect.poll(()=>requests.includes('/api/admin/tickets/metrics?days=7')).toBe(true);
 await page.getByRole('combobox',{name:lang==='ar'?'نوع الطلب':'Request category',exact:true}).selectOption('payouts');
 await expect.poll(()=>requests.some(x=>x.includes('/api/admin/tickets?')&&x.includes('category=payouts'))).toBe(true);
 await expect(page.getByText(lang==='ar'?'الاسم الظاهر للعميل: فريق دعم Entix':'Customer-facing name: Entix Support',{exact:true})).toBeVisible();
 await page.screenshot({path:`/tmp/entix-support-kpi-${lang}-${width}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 const box=await dashboard.boundingBox();if(width===1920)expect(box!.width).toBeGreaterThan(1500);
});

test('customer can rate a resolved support request without seeing internal identity',async({page})=>{
 await prepareVisualApp(page,'en');let score:number|null=null;
 const ticket=()=>({id:'t1',subject:'Resolved request',status:'RESOLVED',satisfactionScore:score,updatedAt:'2026-09-28T10:00:00Z',messages:[{id:'m1',authorType:'ADMIN',body:'Issue resolved',createdAt:'2026-09-28T10:00:00Z'}]});
 await page.route('**/api/public/support/portal**',r=>{
 const path=new URL(r.request().url()).pathname;
 if(path.endsWith('/rating')){score=r.request().postDataJSON().score;return r.fulfill({status:201,json:{ok:true}})}
 return r.fulfill({json:path.endsWith('/portal')?{items:[ticket()]}:{ticket:ticket()}});
 });
 await page.goto('/app/help');await page.getByRole('button',{name:/Resolved request/}).click();
 await expect(page.getByText(/Entix Support ·/)).toBeVisible();
 await page.getByRole('combobox',{name:'How was your support experience?'}).selectOption('2');
 await page.getByRole('button',{name:'Submit rating',exact:true}).click();
 await expect(page.getByText(/Thank you for rating support: 2/)).toBeVisible();expect(score).toBe(2);
 await expect(page.getByRole('button',{name:'Submit rating',exact:true})).toBeHidden();
});
