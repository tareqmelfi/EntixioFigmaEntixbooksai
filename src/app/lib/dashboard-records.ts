export type DashboardRecordScope = {
  basis: 'saved'|'ledger'|'documents'|'vouchers'; metric: string; from?: string|null; to: string; currency: string;
  state?: 'all'|'draft'|'recorded'; measure?: 'net'|'tax'|'gross'; account?: string; exclude?: string[];
};
export type DashboardRecord = {key:string;id:string;kind:string;number:string;date:string;status:string;currency:string;account:string;description:string;amount:number};
export type DashboardRecords = {scope:DashboardRecordScope;items:DashboardRecord[];total:number;count:number;offset:number;limit:number;hasMore:boolean};
export function dashboardRecordsHref(scope:DashboardRecordScope) {
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(scope)) if(value!==undefined&&value!==null) query.set(key,Array.isArray(value)?JSON.stringify(value):String(value));
  return `/app/dashboard/records?${query}`;
}
export function dashboardSourceHref(row:DashboardRecord) {
  const paths:Record<string,string>={invoice:'invoices',bill:'purchases/bills',expense:'expenses','credit-note':'credit-notes','supplier-credit':'purchases/supplier-credits',receipt:'receipts',payment:'payments'};
  return row.kind==='journal'?`/app/journal-entries?entryId=${encodeURIComponent(row.id)}`:paths[row.kind]?`/app/${paths[row.kind]}/${encodeURIComponent(row.id)}`:null;
}
export const dashboardMetricNames:Record<string,[string,string]>={revenue:['الإيرادات','Revenue'],expenses:['المصروفات','Expenses'],net:['صافي الدخل','Net income'],invoice:['فواتير المبيعات','Sales invoices'],bill:['فواتير المشتريات','Purchase bills'],expense:['المصروفات','Expenses'],'credit-note':['الإشعارات الدائنة','Credit notes'],'supplier-credit':['إشعارات الموردين','Supplier credits'],receipt:['سندات القبض','Receipt vouchers'],payment:['سندات الصرف','Payment vouchers'],journal:['القيود — إجمالي المدين','Journals — total debits']};
