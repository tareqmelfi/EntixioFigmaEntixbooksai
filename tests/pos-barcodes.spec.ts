import {test,expect} from '@playwright/test';
import {prepareVisualApp} from './fixtures/visual-app';
test('POS accepts digital product barcode and package multiplier without submitting a sale',async({page})=>{
 await prepareVisualApp(page); let writes=0;
 await page.route('**/api/pos/catalog',r=>r.fulfill({json:{items:[{id:'qa-digital',name:'QA digital service',nameAr:'خدمة اختبار رقمية',type:'DIGITAL',sku:'QA-DIG',unitPrice:'12',barcodes:[{barcode:'QA-PACK',unitMultiplier:'6'}]}],orgVatRate:0,store:{name:'Synthetic test',baseCurrency:'USD'}}}));
 await page.route('**/api/pos/shift/current',r=>r.fulfill({json:{shift:{id:'qa-shift',openedAt:'2026-09-27T00:00:00Z',openingFloat:'0'}}}));
 await page.route('**/api/pos/sale',r=>{writes++;return r.fulfill({status:500,json:{error:'delivery_disabled'}})});
 await page.goto('/app/pos');
 const scan=page.getByPlaceholder('Scan barcode or type a product · 3* for quantity · Enter to pay',{exact:true});
 await scan.fill('3*QA-PACK');await scan.press('Enter');
 await expect(page.getByTitle('Edit price',{exact:true})).toHaveValue('12');
 await expect(page.getByText('× 18',{exact:true})).toBeVisible();
 await scan.fill('QA-DIG');await scan.press('Enter');
 await expect(page.getByText('× 19',{exact:true})).toBeVisible();
 expect(writes).toBe(0);
});
