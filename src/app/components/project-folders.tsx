import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useLanguage } from "./LanguageContext";
import { api } from "../lib/api";

export function includesProjectFolder(id: string | null, selected: string | null, folders: any[]) {
 if (!selected) return true;
 const seen = new Set<string>();
 while (id && !seen.has(id)) { if (id === selected) return true; seen.add(id); id = folders.find(f => f.id === id)?.parentId; }
 return false;
}
export function folderPath(id: string, folders: any[]): string {
 const parts: string[] = [], seen = new Set<string>(); let f = folders.find(f => f.id === id);
 while (f && !seen.has(f.id)) { seen.add(f.id); parts.unshift(f.name); f = folders.find(p => p.id === f.parentId); }
 return parts.join(" / ");
}
const empty = { name: "", description: "", kind: "GENERAL", parentId: "", sector: "", clientContactId: "" };
export function ProjectFolders({folders, selected, onSelect, onSaved}: {folders: any[]; selected: string | null; onSelect: (id: string | null) => void; onSaved: () => void}) {
 const {t} = useLanguage(); const [draft,setDraft] = useState<any>(null), [editId,setEditId] = useState<string|null>(null), [error,setError] = useState(""), [busy,setBusy] = useState(false), [contacts,setContacts] = useState<any[]>([]);
 const current = folders.find(f => f.id === selected);
 const open = (f?: any) => {setEditId(f?.id || null);setDraft(f ? {...empty,...f} : {...empty,parentId:selected || ""});setError("");api.contacts.list().then(r=>setContacts(r.items)).catch(()=>setError(t("تعذر تحميل العملاء","Could not load clients")));};
 const save = async () => {setBusy(true);setError("");try {const f = await api.projectFolders.save(editId,draft);setDraft(null);onSelect(f.id);onSaved();}catch {setError(t("تعذر الحفظ. تأكد من الاسم والمجلد الأب وعدم تداخل المجلد مع نفسه.","Could not save. Check the name and parent; a folder cannot contain itself."));}finally {setBusy(false);}};
 return <section className="space-y-3" aria-label={t("مجلدات المشاريع","Project folders")}>
  <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" onClick={()=>onSelect(null)}>{t("كل المجلدات","All folders")}</Button>{current && <><span>/</span><Button variant="ghost" className="h-auto max-w-full whitespace-normal [overflow-wrap:anywhere]" onClick={()=>onSelect(current.parentId || null)}>{folderPath(current.id,folders)}</Button></>}<Button variant="outline" onClick={()=>open()}>{t("مجلد جديد","New folder")}</Button>{current && <Button variant="ghost" onClick={()=>open(current)}>{t("تعديل المجلد","Edit folder")}</Button>}</div>
  {current && <div className="border-s-2 border-primary ps-4"><h2 className="font-semibold">{current.name}</h2><p className="whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">{current.description}</p>{current.sector && <p className="text-sm">{current.sector}</p>}</div>}
  <div className="flex flex-wrap gap-2">{folders.filter(f=>(f.parentId || null)===selected).map(f=><Button key={f.id} variant="outline" className="h-auto max-w-full whitespace-normal [overflow-wrap:anywhere]" onClick={()=>onSelect(f.id)}>{f.name} <span className="text-muted-foreground">{f._count?.projects || 0}</span></Button>)}</div>
  {draft && <form onSubmit={e=>{e.preventDefault();void save();}} className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-2">
   <label className="min-w-0 space-y-1 text-sm">{t("اسم المجلد","Folder name")}<Input required maxLength={160} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
   <label className="min-w-0 space-y-1 text-sm">{t("داخل مجلد","Parent folder")}<select className="w-full rounded-md border border-border bg-background p-2" value={draft.parentId || ""} onChange={e=>setDraft({...draft,parentId:e.target.value})}><option value="">{t("المستوى الرئيسي","Top level")}</option>{folders.filter(f=>!editId || !includesProjectFolder(f.id,editId,folders)).map(f=><option key={f.id} value={f.id}>{folderPath(f.id,folders)}</option>)}</select></label>
   <div className="flex flex-wrap gap-2 md:col-span-2">{[["GENERAL",t("عام","General")],["INTERNAL",t("داخلي","Internal")],["CLIENT",t("عميل","Client")],["SECTOR",t("قطاع","Sector")]].map(([key,label])=><Button key={key} type="button" variant={draft.kind===key?"default":"outline"} onClick={()=>setDraft({...draft,kind:key})}>{label}</Button>)}</div>
   {draft.kind==="CLIENT" && <label className="text-sm">{t("العميل","Client")}<select className="w-full rounded-md border border-border bg-background p-2" value={draft.clientContactId || ""} onChange={e=>setDraft({...draft,clientContactId:e.target.value})}><option value="">{t("اختر العميل","Choose client")}</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}</select></label>}
   {draft.kind==="SECTOR" && <label className="text-sm">{t("القطاع","Sector")}<Input value={draft.sector || ""} onChange={e=>setDraft({...draft,sector:e.target.value})}/></label>}
   <label className="space-y-1 text-sm md:col-span-2">{t("معلومات عامة","General information")}<textarea rows={3} maxLength={4000} className="w-full rounded-md border border-border bg-background p-3" value={draft.description || ""} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
   {error && <p role="alert" className="text-danger md:col-span-2">{error}</p>}<div className="flex gap-2"><Button disabled={busy}>{t("حفظ","Save")}</Button><Button type="button" variant="ghost" onClick={()=>setDraft(null)}>{t("إلغاء","Cancel")}</Button></div>
  </form>}
 </section>;
}
