import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve,basename } from 'node:path';
import assert from 'node:assert/strict';
import qrcode from 'qrcode-generator';
import { renderDocument } from '../src/app/lib/document-render';
const dir=process.env.QUOTE_EVIDENCE_DIR || '/tmp/entix-quote-evidence-20261010';
const server=createServer(async(req,res)=>{try{const data=await readFile(resolve('public/fonts',basename(req.url||'')));res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','font/woff2');res.end(data)}catch{res.statusCode=404;res.end()}});
await new Promise<void>(r=>server.listen(56242,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1});
const metrics:any[]=[];
try {
 for(const lang of ['ar','en']) {
  const html=await readFile(`${dir}/quote-proof-${lang}.html`,'utf8');
  const input=JSON.parse(await readFile(`${dir}/render-input-${lang}.json`,'utf8'));
  input.qr=(text:string)=>{const q=qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag({cellSize:2,margin:8,scalable:true})};
  const webHtml=renderDocument(input).html.replace(/\.edoc \.draft-mark\{[^}]*\}\.edoc \.sheet\.dark \.draft-mark\{[^}]*\}/,'');
  assert.ok(webHtml===html,`${lang}: web/API rendering differs`);
  await page.setContent(html,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  const stats=await page.evaluate(()=>{
   const overflows=Array.from(document.querySelectorAll('table.items td')).filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>({text:el.textContent,width:el.clientWidth,scroll:el.scrollWidth}));
   const pages=Array.from(document.querySelectorAll('.sheet')).map(sheet=>{const flow=sheet.querySelector('.pgflow');return {rows:Array.from(sheet.querySelectorAll('table.items tr')).map(r=>({h:r.getBoundingClientRect().height,text:r.textContent})),page:sheet.getAttribute('data-page'),client:flow?.clientHeight,scroll:flow?.scrollHeight,signature:!!sheet.querySelector('.sigcols'),note:sheet.textContent?.includes('يرجى إعادة النسخة الموقعة')}});
   return {overflows,pages,fonts:document.fonts.status};
  });
  metrics.push({lang,...stats});
  await page.pdf({path:`${dir}/quote-proof-${lang}.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
  await page.locator('.sheet').first().screenshot({path:`${dir}/cover-${lang}.png`});
  await page.locator('.sheet').filter({has:page.locator('.sigcols')}).screenshot({path:`${dir}/approval-${lang}.png`});
  const quantity=page.locator('table.items tr').filter({hasText:'38,160'});await quantity.first().screenshot({path:`${dir}/quantity-${lang}.png`});
  await page.locator('.sheet').nth(2).screenshot({path:`${dir}/page3-${lang}.png`});
  assert.deepEqual(stats.overflows,[],`${lang}: numeric cells overflow`);
  assert.ok(stats.pages.every(p=>!p.client || p.scroll!<=p.client+3),`${lang}: page flow overflow`);
  assert.ok(stats.pages.some(p=>p.signature&&p.note),`${lang}: approval note separated`);
 }
} finally {await writeFile(`${dir}/print-metrics.json`,JSON.stringify(metrics,null,2));await browser.close();server.close()}
console.log(JSON.stringify(metrics.map(m=>({lang:m.lang,pages:m.pages.length,overflows:m.overflows.length,signatureTogether:m.pages.some(p=>p.signature&&p.note),webApiParity:true})),null,2));
