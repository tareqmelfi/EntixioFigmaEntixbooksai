import { test, expect } from '@playwright/test'
import { prepareVisualApp } from './fixtures/visual-app'
test('company BYOK replacement and request limits use the company settings API', async ({page}) => {
 await prepareVisualApp(page, 'en')
 const patches:any[]=[]
 let config:any={mode:'BYOK',byokProvider:'openrouter',byokKeyHint:'sk-...old1',monthlyAllocation:5,creditBalance:0,spentThisPeriod:0,requestLimit:1000,requestsThisPeriod:4,disabled:false,percentUsed:0}
 await page.route('**/api/ai-billing**',async route=>{
 const req=route.request()
 if(req.method()==='PATCH'){const body=req.postDataJSON();patches.push(body);config={...config,...body,byokKeyHint:body.byokKey?'sk-...new1':config.byokKeyHint};delete config.byokKey}
 await route.fulfill({json:req.url().includes('/usage')?{items:[],byEndpoint:{},byModel:{}}:config})
 })
 await page.goto('/app/settings?tab=ai')
 await page.getByLabel('AI request limit per 30 days').fill('25')
 await page.getByRole('button',{name:'Save request limit',exact:true}).click()
 await expect.poll(()=>patches.some(p=>p.requestLimit===25)).toBe(true)
 await page.getByPlaceholder('sk-or-v1-...').fill('synthetic-customer-key-new1')
 await page.getByRole('button',{name:'Save key and activate BYOK'}).click()
 await expect.poll(()=>patches.some(p=>p.mode==='BYOK'&&p.byokKey==='synthetic-customer-key-new1'&&p.byokProvider==='openrouter')).toBe(true)
 await expect(page.getByPlaceholder('sk-or-v1-...')).toHaveValue('')
})
