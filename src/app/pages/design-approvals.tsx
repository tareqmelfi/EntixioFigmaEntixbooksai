import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router';
import {api,getOrgId} from '../lib/api';
import {blankApproval,type ApprovalContent,type ApprovalRecord} from '../lib/design-approval';
import {DesignApprovalDocument} from '../components/design-approval-document';
import {SearchableCombobox} from '../components/searchable-combobox';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {Textarea} from '../components/ui/textarea';
import {InlineConfirm} from '../components/side-panel';
import {useLanguage} from '../components/LanguageContext';
import {downloadDocumentPdf} from '../lib/document-pdf';

export function DesignApprovals() {
  const {t}=useLanguage(),navigate=useNavigate(),{id}=useParams();
  const [items,setItems]=useState<ApprovalRecord[]>([]),[record,setRecord]=useState<ApprovalRecord|null>(null);
  const [templates,setTemplates]=useState<any[]>([]),[org,setOrg]=useState<any>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[dirty,setDirty]=useState(false),[remove,setRemove]=useState<string|null>(null);
  const preview=useRef<HTMLDivElement>(null),[scale,setScale]=useState(1);
  useEffect(()=>{
    let alive=true;setLoading(true);setError('');setRecord(null);setDirty(false);setSaved(false);
    Promise.all([api.designApprovals.list(),api.documentTemplates.list(),api.orgs.get(getOrgId()!)]).then(async([list,brands,company])=>{
      if(!alive)return;setItems(list.items);setTemplates(brands.items);setOrg(company);
      if(id==='new') {setRecord({id:'',name:t('قالب اعتماد المخططات 2D','2D design approval template'),isTemplate:true,identityTemplateId:brands.items[0]?.id||null,content:blankApproval(),identity:brandOf(company,brands.items[0]),version:1,updatedAt:''});setDirty(true);}
      else if(id) {const item=await api.designApprovals.get(id);if(alive)setRecord(item);}
    }).catch(e=>alive&&setError(e.message)).finally(()=>alive&&setLoading(false));
    return ()=>{alive=false;};
  },[id]);
  useEffect(()=>{const el=preview.current;if(!el)return;const resize=()=>setScale(Math.min(1,el.clientWidth/1123));resize();const observer=new ResizeObserver(resize);observer.observe(el);return()=>observer.disconnect();},[record?.id,loading]);
  const edit=(patch:Partial<ApprovalRecord>)=>{setRecord(r=>r?{...r,...patch}:r);setDirty(true);setSaved(false);};
  const content=(patch:Partial<ApprovalContent>)=>record&&edit({content:{...record.content,...patch}});
  const drawing=(index:number,patch:Partial<ApprovalContent['drawings'][number]>)=>record&&content({drawings:record.content.drawings.map((d,i)=>i===index?{...d,...patch}:d)});
  async function save(){if(!record)return;setBusy(true);setError('');try{
    const body={name:record.name,identityTemplateId:record.identityTemplateId,content:record.content};
    const result=record.id?await api.designApprovals.update(record.id,{...body,version:record.version}):await api.designApprovals.create({...body,isTemplate:record.isTemplate});
    setRecord(result);setDirty(false);setSaved(true);if(!record.id)navigate(`/app/templates/design-approvals/${result.id}`,{replace:true});
  }catch(e:any){setError(e.message||t('تعذر الحفظ. بياناتك باقية؛ أعد المحاولة.','Save failed. Your inputs are retained; try again.'));}finally{setBusy(false);}}
  async function useTemplate(itemId:string){setBusy(true);setError('');try{const copy=await api.designApprovals.use(itemId);navigate(`/app/templates/design-approvals/${copy.id}`);}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  async function upload(index:number,file?:File){if(!file)return;setError('');try{
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error(t('أرفق المخطط بصيغة PNG أو JPG أو WEBP.','Attach a PNG, JPG or WEBP drawing.'));
    if(file.size>5*1024*1024)throw Error(t('صورة المخطط تتجاوز 5 MB.','Drawing image exceeds 5 MB.'));
    const url=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);});
    drawing(index,{image:url});
  }catch(e:any){setError(e.message);}}
  async function download(){if(!preview.current||!record)return;setBusy(true);setError('');try{
    if(!record.isTemplate && (!record.content.client.trim() || !record.content.project.trim() || !record.content.number.trim() || !record.content.drawings.length || record.content.drawings.some(d=>!d.image || !d.title.trim() || !d.code.trim()))) {setError(t('أكمل اسم العميل والمشروع ورقم المستند، وأرفق المخططات المسجلة قبل إرسال النسخة.','Complete client, project and document number, and attach every listed drawing before sending.'));return;}
    const root=preview.current.querySelector<HTMLElement>('.design-approval-document')!;
    await document.fonts.ready;await Promise.all(Array.from(root.querySelectorAll('img'),img=>img.decode()));
    await downloadDocumentPdf(root,'.approval-sheet',record.content.number||record.name);
  }catch{setError(t('تعذر إخراج PDF. تحقق من الصور وطول النصوص ثم أعد المحاولة.','PDF export failed. Check images and text length, then retry.'));}finally{setBusy(false);}}
  const field=(key:keyof Omit<ApprovalContent,'terms'|'drawings'>,label:string,max=180)=> <label className="grid gap-1 text-sm" key={key}>{label}<Input value={record?.content[key]||''} maxLength={max} type={key==='date'?'date':'text'} onChange={e=>content({[key]:e.target.value})}/></label>;
  return <div className="space-y-5 min-w-0">
    <Link className="text-sm text-primary" to="/app/templates">← {t('القوالب','Templates')}</Link>
    <div className="flex items-center justify-between gap-3 flex-wrap"><div><h1 className="text-2xl font-bold">{t('اعتماد المخططات 2D','2D design approvals')}</h1><p className="text-sm text-muted-foreground">{t('قالب بهوية شركتك، ونسخة مستقلة لكل عميل يمكن تعديلها وتنزيلها للإرسال.','Your company identity, with a separate editable PDF for each client.')}</p></div>
      {!id?<Button onClick={()=>navigate('/app/templates/design-approvals/new')}>{t('قالب اعتماد جديد','New approval template')}</Button>:<div className="flex gap-2"><Button variant="outline" onClick={()=>navigate('/app/templates/design-approvals')} disabled={busy}>{t('العودة للقائمة','Back to list')}</Button><Button onClick={save} disabled={busy||!record||!dirty}>{t('حفظ','Save')}</Button><Button variant="outline" onClick={download} disabled={busy||dirty||!record?.id}>{t('تنزيل PDF للإرسال','Download PDF to send')}</Button></div>}
    </div>
    {error&&<div role="alert" className="border border-danger-border bg-danger-subtle text-danger rounded p-3">{error}</div>}
    {saved&&<p role="status">{t('تم الحفظ','Saved')}</p>}
    {loading?<p>{t('جار التحميل…','Loading…')}</p>:!id?<div className="space-y-6">{[true,false].map(isTemplate=><section key={String(isTemplate)}><h2 className="font-bold mb-3">{isTemplate?t('قوالب قابلة لإعادة الاستخدام','Reusable templates'):t('مستندات العملاء','Client documents')}</h2><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{items.filter(i=>i.isTemplate===isTemplate).map(item=><article key={item.id} className="rounded-xl border border-border bg-card overflow-hidden"><div className="bg-[#1B2A41] text-white p-6"><small className="text-[#A7D1EA]">DESIGN APPROVAL · 2D</small><h3 className="text-lg font-bold mt-3">{item.name}</h3></div><div className="p-4 flex gap-2 flex-wrap"><Button size="sm" variant="outline" onClick={()=>navigate(`/app/templates/design-approvals/${item.id}`)}>{t('فتح وتعديل','Open and edit')}</Button>{isTemplate&&<Button size="sm" disabled={busy} onClick={()=>useTemplate(item.id)}>{t('استخدام لعميل','Use for a client')}</Button>}{remove===item.id?<InlineConfirm onCancel={()=>setRemove(null)} onConfirm={async()=>{try{await api.designApprovals.remove(item.id);setItems(old=>old.filter(i=>i.id!==item.id));setRemove(null);}catch(e:any){setError(e.message);}}}/>:<button className="text-sm text-muted-foreground" onClick={()=>setRemove(item.id)}>{t('حذف','Delete')}</button>}</div></article>)}</div></section>)}</div>:record&&<>
      {dirty&&<p className="text-sm text-muted-foreground">{t('تغييرات غير محفوظة — احفظ قبل تنزيل النسخة.','Unsaved changes — save before downloading.')}</p>}
      <div className="grid xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] gap-6 items-start">
        <fieldset disabled={busy} className="space-y-5 min-w-0">
          <section className="space-y-3 rounded-xl border border-border bg-card p-4"><h2 className="font-bold">{t('بيانات المستند','Document details')}</h2><label className="grid gap-1 text-sm">{t('اسم الحفظ','Saved name')}<Input value={record.name} maxLength={180} onChange={e=>edit({name:e.target.value})}/></label>
            <div><div className="text-sm mb-1">{t('هوية الشركة من القالب','Company identity template')}</div><SearchableCombobox value={record.identityTemplateId||''} items={templates.map(t=>({id:t.id,label:t.name}))} onChange={value=>edit({identityTemplateId:value,identity:brandOf(org,templates.find(t=>t.id===value))})} placeholder={t('اختر هوية محفوظة','Choose a saved identity')}/></div>
            {field('title',t('عنوان المستند','Document title'))}{field('client',t('اسم العميل','Client name'))}{field('project',t('اسم المشروع وموقعه','Project and location'),250)}
            <div className="grid grid-cols-2 gap-3">{field('number',t('رقم المستند','Document number'),80)}{field('reference',t('مرجع عرض السعر','Quote reference'),80)}{field('revision',t('الإصدار','Revision'),30)}{field('date',t('تاريخ المستند','Document date'))}</div>
            {field('companySigner',t('ممثل الشركة','Company representative'),150)}{field('companyRole',t('المسمى الوظيفي','Role'),150)}
          </section>
          <section className="space-y-3 rounded-xl border border-border bg-card p-4"><h2 className="font-bold">{t('نص الاعتماد','Approval wording')}</h2><label className="grid gap-1 text-sm">{t('المقدمة','Introduction')}<Textarea value={record.content.introduction} maxLength={900} onChange={e=>content({introduction:e.target.value})}/></label>{record.content.terms.map((term,i)=><label key={i} className="grid gap-1 text-sm">{t('البند','Term')} {i+1}<Textarea value={term} maxLength={900} onChange={e=>content({terms:record.content.terms.map((x,j)=>i===j?e.target.value:x)})}/><button type="button" onClick={()=>content({terms:record.content.terms.filter((_,j)=>i!==j)})} disabled={record.content.terms.length===1}>{t('حذف البند','Remove term')}</button></label>)}<Button variant="outline" size="sm" disabled={record.content.terms.length>=6} onClick={()=>content({terms:[...record.content.terms,'']})}>{t('إضافة بند','Add term')}</Button></section>
          <section className="space-y-4 rounded-xl border border-border bg-card p-4"><h2 className="font-bold">{t('المخططات','Drawings')}</h2><p className="text-xs text-muted-foreground">{t('PNG · JPG · WEBP، حتى 5 MB للصورة. تظهر كل لوحة كاملة مع خانة توقيع.','PNG · JPG · WEBP, up to 5 MB per image. Each complete drawing has a signature line.')}</p>{record.content.drawings.map((d,i)=><div key={i} className="space-y-2 border-b border-border pb-3"><label className="grid text-sm gap-1">{t('اسم المخطط','Drawing title')}<Input value={d.title} maxLength={150} onChange={e=>drawing(i,{title:e.target.value})}/></label><div className="flex gap-2"><Input aria-label={t('رمز المخطط','Drawing code')} value={d.code} maxLength={40} onChange={e=>drawing(i,{code:e.target.value})}/><Input aria-label={t('إصدار المخطط','Drawing revision')} value={d.revision} maxLength={30} onChange={e=>drawing(i,{revision:e.target.value})}/></div><input aria-label={`${t('صورة المخطط','Drawing image')} ${i+1}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(i,e.target.files?.[0])} className="text-xs max-w-full"/>{d.image&&<p className="text-xs">{t('الصورة مرفقة','Image attached')}</p>}<div className="flex gap-3 text-xs"><button onClick={()=>drawing(i,{image:''})}>{t('إزالة الصورة','Remove image')}</button><button onClick={()=>content({drawings:record.content.drawings.filter((_,j)=>j!==i)})}>{t('حذف المخطط','Remove drawing')}</button></div></div>)}<Button size="sm" variant="outline" disabled={record.content.drawings.length>=20} onClick={()=>content({drawings:[...record.content.drawings,{title:'',code:`2D-${String(record.content.drawings.length+1).padStart(2,'0')}`,revision:record.content.revision,image:''}]})}>{t('إضافة مخطط','Add drawing')}</Button></section>
        </fieldset>
        <section className="min-w-0"><h2 className="font-bold mb-3">{t('معاينة النسخة التي سترسل للعميل','Preview of the client document')}</h2><div ref={preview} className="overflow-hidden min-w-0"><div style={{zoom:scale}}><DesignApprovalDocument record={record}/></div></div></section>
      </div>
    </>}
  </div>;
}

function brandOf(org:any,tpl:any) {return {company:org?.nameAr||org?.name||'',logo:tpl?.logoUrl||org?.printLogoUrl||org?.logoUrl||'',logoLight:tpl?.logoLightUrl||'',coverImage:tpl?.coverImageUrl||'',watermark:tpl?.watermarkUrl||'',coverColor:tpl?.theme?.navy||tpl?.coverColor||'#1B2A41',accent:tpl?.theme?.steel||tpl?.brandColor||'#4675AD',footer:tpl?.footerText||[org?.website,org?.email,org?.phone].filter(Boolean).join(' · ')};}
