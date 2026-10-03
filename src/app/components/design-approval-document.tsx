import type { ApprovalRecord } from '../lib/design-approval';

const safeImage = (value:string) => /^(data:image\/(png|jpeg|webp);base64,|https:\/\/)/.test(value || '') ? value : '';
const color = (value:string, fallback:string) => /^#[a-f\d]{6}$/i.test(value || '') ? value : fallback;

/** A non-financial customer document, rendered identically for preview and PDF. */
export function DesignApprovalDocument({record}:{record:ApprovalRecord}) {
  const c=record.content,b=record.identity;
  const pages:string[][]=[[]];
  for(const term of c.terms) {
    // Each bounded text block remains intact; long forms gain pages, never clip text.
    const used=pages[pages.length-1].join('').length+(pages.length===1?c.introduction.length:0);
    if(used+term.length>1100 && (used>0)) pages.push([]);
    pages[pages.length-1].push(term);
  }
  const registerPages=Array.from({length:Math.max(1,Math.ceil(c.drawings.length/8))},(_,i)=>c.drawings.slice(i*8,i*8+8));
  let page=0;
  const footer=()=> <footer><span dir="ltr">{c.number || '—'} · {c.revision}</span><span>{b.footer}</span><span>{++page}</span></footer>;
  const header=()=> <header>{safeImage(b.logo)&&<img src={safeImage(b.logo)} alt={b.company}/>}<div><strong>{c.title}</strong><small>{c.project || 'اسم المشروع'}</small></div></header>;
  return <div className="design-approval-document" dir="rtl" data-testid="approval-document" style={{'--approval-cover':color(b.coverColor,'#1B2A41'),'--approval-accent':color(b.accent,'#4675AD')} as React.CSSProperties}>
    <style>{`
      @font-face{font-family:Tajawal;src:url('/fonts/Tajawal-400-arabic.woff2');font-weight:400;font-display:block}
      @font-face{font-family:Tajawal;src:url('/fonts/Tajawal-700-arabic.woff2');font-weight:600 900;font-display:block}
      @font-face{font-family:'Plus Jakarta Sans';src:url('/fonts/PlusJakartaSans-400-latin.woff2');font-weight:400;font-display:block}
      @font-face{font-family:'JetBrains Mono';src:url('/fonts/JetBrainsMono-400-latin.woff2');font-weight:400 700;font-display:block}
      .design-approval-document{font-family:Tajawal,'Noto Sans Arabic',sans-serif;color:#231F20;font-size:14px;line-height:1.75;width:794px;direction:rtl}
      .approval-sheet{box-sizing:border-box;width:210mm;height:297mm;margin:0 auto 16px;padding:17mm 16mm 24mm;position:relative;background:#fff;overflow:hidden;isolation:isolate}
      .approval-sheet *{box-sizing:border-box}.approval-sheet h1,.approval-sheet h2,.approval-sheet h3,.approval-sheet p{margin:0}.approval-sheet h1{font-size:43px;line-height:1.4}.approval-sheet h2{font-size:24px;line-height:1.5;color:#1B2A41}.approval-sheet small{display:block;font-size:12px;color:#5B6577}
      .approval-sheet header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #DFE4EA;padding-bottom:8mm;margin-bottom:9mm;gap:10mm}.approval-sheet header img{width:46mm;height:22mm;object-fit:contain}.approval-sheet footer{position:absolute;bottom:9mm;left:16mm;right:16mm;display:flex;gap:6mm;align-items:end;border-top:1px solid #DFE4EA;padding-top:4mm;font-size:9px;line-height:1.6;color:#5B6577}.approval-sheet footer span:nth-child(2){flex:1;text-align:center;overflow-wrap:anywhere;max-width:118mm}.approval-sheet footer span:first-child{max-width:38mm;overflow-wrap:anywhere}
      .approval-cover{background:var(--approval-cover);color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:22mm 18mm}.approval-cover .approval-cover-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}.approval-cover:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,30,53,.18),rgba(15,30,53,.62));z-index:-1}.approval-cover .approval-light-logo{width:70mm;height:40mm;object-fit:contain;object-position:right}.approval-cover .approval-cover-label{color:#A7D1EA;letter-spacing:3px;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;margin-bottom:8mm}.approval-cover h1{max-width:155mm}.approval-cover .approval-cover-project{margin-top:10mm;font-size:21px;line-height:1.7}.approval-cover .approval-cover-facts{display:grid;grid-template-columns:1fr 1fr;gap:8mm;border-top:1px solid #537197;padding-top:8mm}.approval-cover small{color:#A7D1EA}.approval-cover footer{border-color:#537197;color:#DCEFF6}.approval-cover strong{overflow-wrap:anywhere}
      .approval-meta{display:grid;grid-template-columns:1fr 1fr;gap:5mm 10mm;padding:6mm;background:#F7F9FB;margin:6mm 0}.approval-meta strong{display:block;overflow-wrap:anywhere}.approval-intro{margin:6mm 0!important;color:#333F4B}.approval-terms{padding:0;list-style:none;counter-reset:term}.approval-terms li{padding:5mm 0;border-bottom:1px solid #DFE4EA;white-space:pre-wrap;overflow-wrap:anywhere}.approval-watermark{position:absolute;width:115mm;height:115mm;object-fit:contain;left:47mm;top:105mm;opacity:.035;z-index:-1}
      .approval-sheet table{border-collapse:collapse;width:100%;margin:7mm 0;font-size:13px}.approval-sheet th{background:#1B2A41;color:white;padding:3mm;text-align:right}.approval-sheet td{border-bottom:1px solid #DFE4EA;padding:4mm 3mm;overflow-wrap:anywhere}.approval-signatures{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:10mm}.approval-signatures article{border:1px solid #DFE4EA;min-height:54mm;padding:5mm}.approval-signatures h3{font-size:16px;color:#1B2A41}.approval-signatures .signature-space{height:18mm;border-bottom:1px dashed #A7D1EA;margin:3mm 0}.approval-drawing{display:flex;flex-direction:column}.approval-drawing .drawing-image{width:100%;height:200mm;object-fit:contain}.approval-drawing .drawing-placeholder{height:200mm;border:1px dashed #A7D1EA;display:grid;place-items:center;color:#5B6577}.approval-drawing header{margin-bottom:4mm}.approval-drawing .drawing-sign{display:flex;justify-content:space-between;font-size:12px;margin-top:5mm}.approval-sheet .mono{font-family:'JetBrains Mono',monospace;font-size:12px}
      @media print{.approval-sheet{margin:0;break-after:page;print-color-adjust:exact;-webkit-print-color-adjust:exact}.approval-sheet:last-child{break-after:auto}@page{size:A4;margin:0}}
    `}</style>
    <section className="approval-sheet approval-cover" style={{backgroundColor:color(b.coverColor,'#1B2A41')}}>
      {safeImage(b.coverImage)&&<img className="approval-cover-image" src={safeImage(b.coverImage)} alt=""/>}
      <div>{safeImage(b.logoLight)?<img className="approval-light-logo" src={safeImage(b.logoLight)} alt={b.company}/>:<strong>{b.company}</strong>}</div>
      <div><div className="approval-cover-label" dir="ltr">DESIGN APPROVAL · 2D</div><h1>{c.title}</h1><p className="approval-cover-project">{c.project || 'اسم المشروع'}<br/>{c.client || 'اسم العميل'}</p></div>
      <div className="approval-cover-facts"><div><small>مرجع المستند</small><strong className="mono" dir="ltr">{c.number || 'يحدد عند الاستخدام'}</strong></div><div><small>الإصدار · التاريخ</small><strong dir="ltr">{c.revision} · {c.date}</strong></div><div><small>الجهة المصدرة</small>{b.company}</div><div><small>الحالة</small>{record.isTemplate?'قالب قابل لإعادة الاستخدام':'بانتظار توقيع العميل'}</div></div>
    </section>
    {pages.map((terms,i)=><section className="approval-sheet" key={`terms-${i}`}>
      {safeImage(b.watermark)&&<img className="approval-watermark" src={safeImage(b.watermark)} alt=""/>}{header()}
      <h2>{i?'تتمة إقرار الاعتماد':'إقرار اعتماد المخططات'}</h2>
      {i===0&&<><div className="approval-meta"><div><small>العميل</small><strong>{c.client||'________________'}</strong></div><div><small>المشروع</small><strong>{c.project||'________________'}</strong></div><div><small>مرجع العرض</small><strong dir="ltr">{c.reference||'—'}</strong></div><div><small>التاريخ · الإصدار</small><strong dir="ltr">{c.date} · {c.revision}</strong></div></div><p className="approval-intro">{c.introduction}</p></>}
      <ol className="approval-terms">{terms.map((term,j)=><li key={j}>{term}</li>)}</ol>{footer()}
    </section>)}
    {registerPages.map((drawings,i)=><section className="approval-sheet" key={`register-${i}`}>{header()}<h2>سجل المخططات المرفقة</h2><table><thead><tr><th>المخطط</th><th>الوصف</th><th>الإصدار</th></tr></thead><tbody>{drawings.map((d,j)=><tr key={j}><td dir="ltr">{d.code}</td><td>{d.title}</td><td dir="ltr">{d.revision}</td></tr>)}</tbody></table>
      {i===registerPages.length-1&&<><p>يشمل الاعتماد المخططات المدرجة وإصداراتها فقط. يرجى مراجعة جميع الصفحات قبل التوقيع.</p><div className="approval-signatures"><article><h3>اعتماد العميل</h3><div>{c.client||'الاسم: __________________'}</div><div className="signature-space"/><small>التوقيع · التاريخ: __________________</small></article><article><h3>ممثل الشركة</h3><div>{c.companySigner||'الاسم: __________________'}</div><small>{c.companyRole}</small><div className="signature-space"/><small>التوقيع · التاريخ: __________________</small></article></div></>}{footer()}</section>)}
    {c.drawings.map((d,i)=><section className="approval-sheet approval-drawing" key={`drawing-${i}`}>{header()}<div className="flex justify-between"><h3>{d.title}</h3><span dir="ltr">{d.code} · {d.revision}</span></div>{safeImage(d.image)?<img className="drawing-image" src={d.image} alt={d.title}/>:<div className="drawing-placeholder">مكان المخطط — يرفق عند إعداد نسخة العميل</div>}<div className="drawing-sign"><span>توقيع العميل: __________________</span><span>التاريخ: __________________</span></div>{footer()}</section>)}
  </div>;
}
