import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../lib/api";
import { useLanguage } from "./LanguageContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { LedgerFigure, Metric, MetricStrip } from "./product";

const routes: Record<string,string> = {invoices:"/app/invoices/",bills:"/app/purchases/bills/",quotes:"/app/quotes/"};
export function ProjectWorkspace({project, version}: {project:any; version:number}) {
 const {t} = useLanguage();const [data,setData]=useState<any>(null),[error,setError]=useState(""),[selected,setSelected]=useState("invoices");
 useEffect(()=>{let alive=true;setData(null);api.projects.overview(project.id).then(d=>{if(![d.invoices,d.bills,d.quotes,d.tasks].every(Array.isArray))throw new Error("invalid_project_report");if(alive){setData(d);setError("");}}).catch(()=>{if(alive)setError(t("تعذر تحميل تقرير المشروع","Could not load project report"));});return()=>{alive=false;};},[project.id,version]);
 const types = [["invoices",t("فواتير المبيعات","Sales invoices")],["bills",t("فواتير المشتريات","Purchase bills")],["quotes",t("عروض الأسعار","Quotes")]];
 const query = new URLSearchParams({projectId:project.id,...(project.clientContactId?{contactId:project.clientContactId}:{})}).toString();
 const rows = data?.[selected] || [];
 const currencies = [...new Set<string>(rows.map((r:any)=>r.currency))];
 const download = () => {
  const csvCell=(v:any)=>'"'+String(v ?? "").replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
  const csv=[["Type","Number","Date","Status","Currency","Total","Paid"],...types.flatMap(([kind])=>(data?.[kind]||[]).map((r:any)=>[kind,r.invoiceNumber||r.billNumber||r.quoteNumber,r.issueDate?.slice(0,10),r.status,r.currency,r.total,r.amountPaid??""]))].map(row=>row.map(csvCell).join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`${project.code}-documents.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <section id="project-overview" className="space-y-4 scroll-mt-20" data-testid="project-workspace">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{t("نظرة عامة على المشروع","Project overview")}</h2><p className="text-sm text-muted-foreground">{project.startDate?.slice(0,10)||"—"} → {project.endDate?.slice(0,10)||t("لم يحدد الموعد النهائي","No deadline set")}</p></div><div className="flex flex-wrap gap-2"><Button asChild><Link to={`/app/invoices/new?${query}`}>{t("إنشاء فاتورة","Create invoice")}</Link></Button><Button asChild variant="outline"><Link to={`/app/quotes?new=1&${query}`}>{t("إنشاء عرض سعر","Create quote")}</Link></Button><Button disabled={!data} variant="outline" onClick={download}>{t("تصدير تقرير المستندات","Export document report")}</Button></div></div>
  {error && <p role="alert" className="text-danger">{error}</p>}
  {data && <><p className="text-sm text-muted-foreground">{t("المهام المنجزة","Completed tasks")}: {data.tasks.filter((x:any)=>x.status==="DONE").length} / {data.tasks.length} · {t("مهام متأخرة","Overdue tasks")}: {data.tasks.filter((x:any)=>x.dueDate && new Date(x.dueDate)<new Date(new Date().toDateString()) && x.status!=="DONE").length}</p>
   <div className="flex flex-wrap gap-2">{types.map(([key,label])=><Button key={key} variant={selected===key?"default":"outline"} onClick={()=>setSelected(key)}>{label} · {data[key].length}</Button>)}</div>
   {currencies.map(currency=>{const issued=rows.filter((r:any)=>r.currency===currency && !["DRAFT","CANCELLED","VOID","REJECTED","EXPIRED"].includes(r.status));const drafts=rows.filter((r:any)=>r.currency===currency && r.status==="DRAFT");return <MetricStrip key={currency}><Metric label={t("قيمة المستندات غير المسودة","Non-draft document value")} value={<LedgerFigure value={issued.reduce((s:number,r:any)=>s+Number(r.total),0)} currency={currency}/>}/><Metric label={t("المسودات","Drafts")} value={<LedgerFigure value={drafts.reduce((s:number,r:any)=>s+Number(r.total),0)} currency={currency}/>}/>{selected!=="quotes" && <Metric label={t("المتبقي للسداد","Outstanding")} value={<LedgerFigure value={issued.reduce((s:number,r:any)=>s+Math.max(0,Number(r.total)-Number(r.amountPaid||0)),0)} currency={currency}/>}/>}</MetricStrip>;})}
   <p className="text-xs text-muted-foreground">{t("إجماليات المستندات تشمل الضريبة، وكل عملة منفصلة. ليست قائمة أرباح وخسائر.","Document totals include tax and keep currencies separate. This is not a profit and loss statement.")}</p>
   <div className="divide-y divide-border">{rows.map((r:any)=><Link key={r.id} to={`${routes[selected]}${r.id}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm hover:text-primary"><span dir="ltr">{r.invoiceNumber||r.billNumber||r.quoteNumber}</span><span>{r.issueDate?.slice(0,10)}</span><span>{Number(r.total).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} {r.currency}</span></Link>)}{!rows.length && <p className="py-3 text-sm text-muted-foreground">{t("لا توجد مستندات مرتبطة","No linked documents")}</p>}</div>
  </>}
 </section>;
}
export function ProjectPeople({projectId}:{projectId:string}) {
 const {t}=useLanguage();const [people,setPeople]=useState<any[]>([]),[email,setEmail]=useState(""),[link,setLink]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[allowed,setAllowed]=useState(true);
 const load=()=>api.projects.people(projectId).then(d=>setPeople(d.items)).catch(()=>setAllowed(false));useEffect(()=>{void load();},[projectId]);
 const invite=async()=>{setBusy(true);setError("");setLink("");try{const d=await api.projects.invite(projectId,email);setLink(new URL(d.invitationPath,window.location.origin).href);setEmail("");await load();}catch{setError(t("تعذر إنشاء الدعوة","Could not create invitation"));}finally{setBusy(false);}};
 return <section id="project-people" className="space-y-3 border-t border-border pt-5 scroll-mt-20" data-testid="project-people"><h2 className="font-semibold">{t("الأشخاص والمشاركة","People & sharing")}</h2><p className="text-sm text-muted-foreground">{t("مشاركة للقراءة فقط: اسم المشروع ومواعيده والمهام. لا تمنح وصولاً للفواتير أو حسابات الشركة. يقبل المدعو بنفس البريد بعد توثيقه.","Read-only sharing: project identity, dates and tasks. No invoices or company accounts. Acceptance requires the same verified email address.")}</p>
 {!allowed ? <p className="text-sm">{t("يدير المالك أو المدير دعوات المشروع","The owner or administrator manages project invitations")}</p> : <><form onSubmit={e=>{e.preventDefault();void invite();}} className="flex flex-wrap gap-2"><Input aria-label={t("بريد المدعو","Invitee email")} className="max-w-sm" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><Button disabled={busy}>{t("إنشاء رابط دعوة","Create invitation link")}</Button></form>
 {link && <div className="space-y-2"><p className="text-sm">{t("الرابط صالح لمدة 7 أيام. لم تُرسل رسالة بريد.","Link valid for 7 days. No email was sent.")}</p><Input aria-label={t("رابط الدعوة","Invitation link")} readOnly value={link} dir="ltr" onFocus={e=>e.target.select()}/><Button variant="outline" onClick={()=>navigator.clipboard.writeText(link).catch(()=>setError(t("انسخ الرابط من الحقل","Copy the link from the field")))}>{t("نسخ الرابط","Copy link")}</Button></div>}
 {people.map(p=><div key={p.id} className="flex flex-wrap justify-between gap-3 border-b border-border py-2 text-sm"><span>{p.email}</span><span>{p.status==="ACTIVE"?t("مقبولة","Accepted"):p.status==="REVOKED"?t("ملغاة","Revoked"):new Date(p.expiresAt)<new Date()?t("منتهية","Expired"):t("بانتظار القبول","Pending acceptance")}</span>{p.status!=="REVOKED" && <Button variant="ghost" onClick={async()=>{try{await api.projects.revoke(projectId,p.id);await load();}catch{setError(t("تعذر إلغاء الدعوة","Could not revoke invitation"));}}}>{t("إلغاء الوصول","Revoke access")}</Button>}</div>)}</>}{error && <p role="alert" className="text-danger">{error}</p>}
 </section>;
}
