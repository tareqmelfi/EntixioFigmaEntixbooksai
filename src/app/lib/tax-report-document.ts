import type { Org, ReportColumn, ReportPayload, ReportRow, ReportSection, TaxReturnPayload, UsSalesTaxPayload, VatSummaryPayload } from './api';

type TaxPayload = TaxReturnPayload | UsSalesTaxPayload | VatSummaryPayload;
const bi = (ar: string, en: string) => `${ar}␟${en}`;
const columns: ReportColumn[] = [{ key:'label', label:bi('البند','Line item') }, { key:'base', label:bi('الأساس الضريبي','Taxable base'), kind:'money', align:'end' }, { key:'tax', label:bi('الضريبة','Tax'), kind:'money', align:'end' }];
const row = (id: string, ar: string, en: string, base: number, tax: number): ReportRow => ({ id, label:bi(ar,en), values:{label:bi(ar,en), base, tax} });

/** Render the saved tax-return snapshot with the same pagination as every financial report. */
export function taxReportDocument(payload: TaxPayload, org: Org): ReportPayload {
  const sections: ReportSection[] = [];
  const notices = [bi('نسخة للمراجعة؛ لا تمثل تقديمًا رسميًا للإقرار.', 'Review copy; this is not an official tax filing.')];
  let id: string, title: string, englishTitle: string;
  const currency = 'currency' in payload ? payload.currency : payload.org.baseCurrency;
  if ('vatDeclaration' in payload) {
    id = 'sa-vat-return'; title = 'الإقرار الضريبي السعودي'; englishTitle = 'Saudi VAT Return';
    const {sales:s, purchases:p, netVat} = payload.vatDeclaration;
    sections.push({id:'sales',title:bi('ضريبة المبيعات','Output tax'),columns,rows:[
      row('standard','المبيعات الأساسية (15%)','Standard-rated sales (15%)',s.standardRated.base,s.standardRated.vat),
      row('citizens','المبيعات للمواطنين (الصحة والتعليم)','Sales to citizens (health & education)',s.citizens?.base||0,s.citizens?.vat||0),
      row('zero','مبيعات صفرية محلية','Zero-rated domestic sales',s.zeroDomestic?.base||0,0),
      row('exports','الصادرات','Exports',s.exports?.base||0,0),
      row('exempt','مبيعات معفاة','Exempt sales',s.exempt.base,0),
      row('nontax','إيرادات غير ضريبية','Non-taxable revenue',s.nonTaxable.base,0),
      row('sales-total','إجمالي المبيعات','Total sales',s.totalBase,s.totalVat),
    ]},{id:'purchases',title:bi('ضريبة المشتريات','Input tax'),columns,rows:[
      row('standard','المشتريات الأساسية (15%)','Standard-rated purchases (15%)',p.deductible.base,p.deductible.vat),
      row('customs','الاستيرادات — الجمارك','Imports — customs',p.importCustoms?.base||0,p.importCustoms?.vat||0),
      row('rcm','الاستيرادات — الاحتساب العكسي','Imports — reverse charge',p.importRcm?.base||0,p.importRcm?.vat||0),
      row('zero','المشتريات الصفرية والمعفاة','Zero-rated & exempt purchases',p.zeroExempt?.base||0,0),
      row('purchases-total','إجمالي المشتريات','Total purchases',p.totalBase,p.totalVat),
      row('net-total','صافي الضريبة المستحقة / المستردة','Net VAT due / refundable',0,netVat),
    ]});
    sections.push({id:'withholding',title:bi('ضريبة الاستقطاع — القيم المحفوظة','Withholding tax — saved values'),columns:[
      {key:'number',label:bi('السند','Voucher')},{key:'date',label:bi('التاريخ','Date')},{key:'label',label:bi('المستفيد','Beneficiary')},
      {key:'type',label:bi('النوع','Type')},{key:'currency',label:bi('العملة','Currency')},{key:'base',label:bi('الأساس','Base'),kind:'money',align:'end'},
      {key:'rate',label:bi('النسبة %','Rate %'),kind:'number'},{key:'tax',label:bi('الاستقطاع','Withholding'),kind:'money',align:'end'}
    ],rows:payload.withholding.rows.map(r=>({id:r.voucherId,label:r.beneficiary,values:{number:r.number,date:r.date,label:r.beneficiary,type:r.transferType,currency:r.currency,base:r.baseAmount,rate:r.rate,tax:r.withholdingAmount}}))});
    if(payload.drafts?.count) notices.push(bi(`${payload.drafts.count} مستندات مسودة مستبعدة من أرقام الإقرار.`, `${payload.drafts.count} draft documents are excluded from the return.`));
  } else if(payload.type === 'us-sales-tax') {
    id=payload.type;title='ملخص ضريبة المبيعات الأمريكية';englishTitle='US Sales Tax Summary';
    const s=payload.sales;
    sections.push({id:'sales',title:bi('ملخص المبيعات','Sales summary'),columns,rows:[
      row('gross','إجمالي المبيعات','Gross sales',s.grossSales,s.taxCollected),
      row('exempt','معفاة / بدون ضريبة','Exempt / untaxed',s.exemptSales,0),
      row('taxable','المبيعات الخاضعة','Taxable sales',s.taxableSales,s.taxCollected),
    ]},{id:'by-state',title:bi('حسب الولاية','By state'),columns,rows:s.byState.map((r,i)=>row(`state-${i}`,r.state,r.state,r.base,r.tax))});
    if(payload.irsGuide) notices.push(`${payload.irsGuide.form} · ${bi(payload.irsGuide.titleAr,payload.irsGuide.title)}`,...payload.irsGuide.notes);
    if(payload.org.ein) notices.push(`EIN: ${payload.org.ein}`);
    if(payload.hint) notices.push(payload.hint);
  } else {
    id=payload.type;title='ملخص ضريبة القيمة المضافة';englishTitle='VAT Summary';
    const s=payload.sales,p=payload.purchases;
    sections.push({id:'vat',title:bi('بنود الإقرار','Return lines'),columns,rows:[
      row('standard-sales','المبيعات الأساسية','Standard-rated sales',s.standardBase,s.standardVat),
      row('zero','مبيعات صفرية محلية','Zero-rated domestic sales',s.zeroBase,0),
      row('exports','الصادرات','Exports',s.exportsBase,0),
      row('exempt','مبيعات معفاة','Exempt sales',s.exemptBase,0),
      row('nontax','إيرادات غير ضريبية','Non-taxable revenue',s.nonTaxBase,0),
      row('standard-purchases','المشتريات الأساسية','Standard-rated purchases',p.standardBase,p.standardVat),
      row('zero-purchases','المشتريات الصفرية والمعفاة','Zero-rated & exempt purchases',p.zeroExemptBase,0),
      row('net-total','صافي الضريبة المستحقة / المستردة','Net VAT due / refundable',0,payload.net.due),
    ]});
  }
  return {id,title,englishTitle,description:'',category:'tax',status:'live',generatedAt:new Date().toISOString(),period:payload.period,currency,org,summary:{},sections,notices};
}
