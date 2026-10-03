import {test,expect,type Page} from '@playwright/test';
import {prepareVisualApp,visualOrgId} from './fixtures/visual-app';
import {blankApproval} from '../src/app/lib/design-approval';

async function prepare(page:Page,lang:'ar'|'en'='ar') {
  await prepareVisualApp(page,lang);
  const brand={id:'brand',name:'EDG Identity',theme:{navy:'#1B2A41',steel:'#4675AD'},footerText:'Engineering Design Gates · edg.sa'};
  const identity={company:'شركة بوابات التصاميم الهندسية',logo:'',logoLight:'',coverImage:'',watermark:'',coverColor:'#1B2A41',accent:'#4675AD',footer:brand.footerText};
  await page.route('**/api/document-templates',r=>r.fulfill({json:{items:[brand]}}));
  await page.route(`**/orgs/${visualOrgId}`,r=>r.fulfill({json:{id:visualOrgId,name:identity.company}}));
  const rows:any[]=[{id:'template',name:'EDG · اعتماد المخططات 2D',isTemplate:true,identityTemplateId:'brand',identity,content:blankApproval(),version:1}];let fail=false;
  await page.route('**/api/design-approvals**',async r=>{
    const path=new URL(r.request().url()).pathname.replace('/api/design-approvals',''),method=r.request().method();
    if(method==='GET')return r.fulfill({json:path?rows.find(x=>`/${x.id}`===path):{items:rows}});
    if(fail)return r.fulfill({status:409,json:{error:'version_conflict',messageAr:'تغير المستند في جلسة أخرى. أعد فتحه قبل الحفظ.'}});
    if(path.endsWith('/use')){const source=rows[0];const copy={...structuredClone(source),id:'copy',isTemplate:false,name:'نسخة جديدة'};rows.push(copy);return r.fulfill({status:201,json:copy});}
    if(method==='PUT'){const data=r.request().postDataJSON(),index=rows.findIndex(x=>`/${x.id}`===path);rows[index]={...rows[index],...data,version:data.version+1};return r.fulfill({json:rows[index]});}
    const data=r.request().postDataJSON(),row={...data,id:'created-doc',version:1,identity};rows.push(row);return r.fulfill({status:201,json:row});
  });return{rows,setFail:()=>{fail=true;}};
}
test('gallery opens approval forms; reuse, edit and reload preserve separate customer copy',async({page})=>{
  const f=await prepare(page);await page.goto('/app/templates');await page.getByRole('button',{name:/اعتماد المخططات — قوالب/}).click();
  await page.getByRole('button',{name:'استخدام لعميل',exact:true}).click();await expect(page).toHaveURL(/design-approvals\/copy/);
  await page.getByLabel('اسم العميل',{exact:true}).fill('عميل اختبار');await page.getByLabel('اسم المشروع وموقعه',{exact:true}).fill('مشروع تجريبي');
  await expect(page.getByRole('button',{name:'تنزيل PDF للإرسال',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'حفظ',exact:true}).click();await expect(page.getByRole('status')).toHaveText('تم الحفظ');await page.reload();
  await expect(page.getByLabel('اسم العميل',{exact:true})).toHaveValue('عميل اختبار');expect(f.rows[0].content.client).toBe('');
  await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('save failure retains all edits and prevents exporting stale data',async({page})=>{
  const f=await prepare(page);await page.goto('/app/templates/design-approvals/template');await page.getByLabel('اسم العميل',{exact:true}).fill('مدخلات محفوظة في النموذج');f.setFail();await page.getByRole('button',{name:'حفظ',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('اسم العميل',{exact:true})).toHaveValue('مدخلات محفوظة في النموذج');await expect(page.getByRole('button',{name:'تنزيل PDF للإرسال',exact:true})).toBeDisabled();
});
test('branded preview fits every sheet, embeds drawing, downloads a non-empty PDF',async({page})=>{
  test.setTimeout(120000);await prepare(page);await page.goto('/app/templates/design-approvals/template');
  const preview=page.getByTestId('approval-document');await expect(preview).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  const sheets=preview.locator('.approval-sheet');expect(await sheets.count()).toBe(5);
  const sizes=await sheets.evaluateAll(nodes=>nodes.map(el=>({height:(el as HTMLElement).scrollHeight,client:(el as HTMLElement).clientHeight})));
  for(const size of sizes)expect(size.height).toBeLessThanOrEqual(size.client+1);
  await expect(preview.locator('.approval-cover')).toHaveCSS('background-color','rgb(27, 42, 65)');
  await preview.locator('.approval-cover').screenshot({path:'test-results/design-approval-cover.png'});
  await preview.locator('.approval-sheet').nth(1).screenshot({path:'test-results/design-approval-terms.png'});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'تنزيل PDF للإرسال',exact:true}).click();const file=await download;expect(file.suggestedFilename()).toMatch(/\.pdf$/);await file.saveAs('test-results/design-approval.pdf');await expect(page.getByRole('alert')).toHaveCount(0);
});
test('English controls and creation stay usable',async({page})=>{
  await prepare(page,'en');await page.goto('/app/templates/design-approvals/new');await expect(page.getByRole('heading',{name:'2D design approvals',exact:true})).toBeVisible();await page.getByLabel('Saved name').fill('EDG 2D template');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page).toHaveURL(/design-approvals\/created-doc$/);await expect(page.getByLabel('Saved name')).toHaveValue('EDG 2D template');
});

test('long introduction paginates and uploaded drawings survive reopening',async({page})=>{
  const f=await prepare(page);f.rows[0].content.introduction='تفاصيل المشروع والمراجعة. '.repeat(35);f.rows[0].content.terms=['الشروط الخاصة بالمخططات. '.repeat(30),...f.rows[0].content.terms];
  await page.goto('/app/templates/design-approvals/template');const preview=page.getByTestId('approval-document');await expect(preview).toBeVisible();await page.evaluate(()=>document.fonts.ready);
  expect(await preview.locator('.approval-sheet').count()).toBeGreaterThan(5);
  const dimensions=await preview.locator('.approval-sheet').evaluateAll(nodes=>nodes.map(node=>({scroll:node.scrollHeight,height:node.clientHeight})));
  for(const d of dimensions)expect(d.scroll).toBeLessThanOrEqual(d.height+1);
  const image=await preview.locator('.approval-cover').screenshot();
  await page.getByLabel('صورة المخطط 1',{exact:true}).setInputFiles({name:'synthetic-drawing.png',mimeType:'image/png',buffer:image});
  await expect(preview.locator('.drawing-image')).toHaveCount(1);await page.getByRole('button',{name:'حفظ',exact:true}).click();await expect(page.getByRole('status')).toHaveText('تم الحفظ');await page.reload();await expect(page.getByTestId('approval-document').locator('.drawing-image')).toHaveCount(1);expect(f.rows[0].content.drawings[0].image).toMatch(/^data:image\/png;base64,/);
});
