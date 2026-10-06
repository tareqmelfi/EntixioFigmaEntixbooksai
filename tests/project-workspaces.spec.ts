import {test,expect} from '@playwright/test'
import {prepareVisualApp} from './fixtures/visual-app'
for(const language of ['en','ar'] as const) {
 test(`project hierarchy and workspace ${language}`,async({page})=>{
  await prepareVisualApp(page,language)
  const folders=[{id:'root',name:'Internal',kind:'INTERNAL',parentId:null,description:'Internal work'},{id:'child',name:'Platform',kind:'GENERAL',parentId:'root'}]
  const projects=[{id:'p1',code:'EN-PRJ-BOOK',name:'Books',folderId:'child',projectType:'INTERNAL',status:'ACTIVE',startDate:'2026-01-01',endDate:'2026-12-31',budget:'100',clientContactId:null},{id:'p2',code:'EN-CLI-EDG',name:'EDG',projectType:'CLIENT',status:'ACTIVE'}]
  await page.route('**/api/project-folders**',r=>r.fulfill({json:{items:folders}}))
  await page.route('**/api/projects**',r=>{const u=new URL(r.request().url());return r.fulfill({json:u.pathname.endsWith('/overview')?{invoices:[{id:'inv1',invoiceNumber:'INV-1',status:'DRAFT',issueDate:'2026-10-01',currency:'USD',total:'100',amountPaid:0}],bills:[],quotes:[],tasks:[]}:u.pathname.endsWith('/p1')?projects[0]:{items:projects,total:2}})})
  await page.route('**/api/projects/p1/budget**',r=>r.fulfill({status:404,json:{error:'not_found'}}))
  await page.route('**/api/projects/p1/tasks**',r=>r.fulfill({json:{items:[],total:0,summary:{count:0,byHealth:{GREEN:0,AMBER:0,RED:0}}}}))
  await page.route('**/api/projects/p1/people',r=>r.fulfill({json:r.request().method()==='POST'?{invitationPath:'/project-invite/example'}:{items:[]}}))
  await page.goto('/app/projects')
  await page.getByRole('button',{name:'Internal 0',exact:true}).click()
  await expect(page.getByRole('link',{name:'EN-PRJ-BOOK',exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'EN-CLI-EDG',exact:true})).toHaveCount(0)
  await page.getByRole('link',{name:'EN-PRJ-BOOK',exact:true}).click()
  await expect(page.getByTestId('project-workspace')).toBeVisible()
  await expect(page.getByRole('link',{name:language==='ar'?'إنشاء فاتورة':'Create invoice',exact:true})).toHaveAttribute('href','/app/invoices/new?projectId=p1')
  await expect(page.getByRole('link',{name:'INV-1',exact:false})).toHaveAttribute('href','/app/invoices/inv1')
  await page.getByLabel(language==='ar'?'بريد المدعو':'Invitee email').fill('guest@example.com')
  await page.getByRole('button',{name:language==='ar'?'إنشاء رابط دعوة':'Create invitation link',exact:true}).click()
  await expect(page.getByLabel(language==='ar'?'رابط الدعوة':'Invitation link')).toHaveValue(/project-invite\/example$/)
  await page.setViewportSize({width:1024,height:900})
  await expect(page.getByTestId('project-workspace')).toBeVisible()
  await page.screenshot({path:`/tmp/project-workspace-${language}.png`,fullPage:true})
 })
}
