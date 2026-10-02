import {test,expect} from '@playwright/test';
import {prepareVisualApp} from './fixtures/visual-app';
test('unused inactive plans delete only after confirmation and Stripe import stays reviewable',async({page})=>{
 await prepareVisualApp(page,'en');await page.route('https://api.entix.io/me',r=>r.fulfill({json:{isPlatformAdmin:true,memberships:[]}}));
 let items=[{id:'p1',name:'Synthetic unused',stripePriceId:'price_test',nameAr:null,tier:'starter',price:1000,currency:'usd',interval:'month',isActive:false,subscriptions:0}];let removed=false;let imported:any;
 await page.route('**/api/admin/**',r=>{const path=new URL(r.request().url()).pathname;
 if(path.endsWith('/me'))return r.fulfill({json:{isSuper:true,permissions:['*']}});
 if(path.endsWith('/plans/import')){imported=r.request().postDataJSON();return r.fulfill({status:201,json:{plan:items[0]}})}
 if(r.request().method()==='DELETE'){removed=true;items=[];return r.fulfill({json:{ok:true}})}
 return r.fulfill({json:{items}})});
 await page.goto('/admin/plans');await page.getByRole('textbox',{name:'Stripe price ID'}).fill('price_synthetic');await page.getByRole('button',{name:'Link Stripe plan',exact:true}).click();await expect(page.getByText('Plan linked; review before activation',{exact:true})).toBeVisible();expect(imported.stripePriceId).toBe('price_synthetic');
 await page.getByRole('button',{name:'Delete permanently',exact:true}).click();expect(removed).toBe(false);await page.getByRole('button',{name:'Yes',exact:true}).click();await expect(page.getByText('Synthetic unused',{exact:true})).toBeHidden();expect(removed).toBe(true);
});
