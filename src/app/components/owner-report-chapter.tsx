import type { CSSProperties, ReactNode } from 'react';
import type { ReportPayload, ReportPrintSettings } from '../lib/api';
import { reportAppearance, reportTheme } from '../lib/report-appearance';
import { useLanguage } from './LanguageContext';
import { accountGroups, availableAccounts, comparison, metricDefinitions, one, rows, type MetricKey, type OwnerAnalysis } from '../lib/owner-report';
import '../../styles/owner-report.css';

const n = (v: number | null, digits = 2) => v === null ? '—' : Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const signed = (v: number | null, digits = 2) => v !== null && v < 0 ? `(${n(v,digits)})` : n(v,digits);
function Spark({ values }: { values: Array<number | null> }) {
  const valid = values.filter((v): v is number => v !== null); if (!valid.length) return <span className="owner-spark" />;
  const min = Math.min(0,...valid), max = Math.max(0,...valid), span = max-min || 1;
  return <svg className="owner-spark" viewBox="0 0 150 28" aria-hidden="true">{values.map((v,i) => v === null || i === 0 || values[i-1] === null ? null : <line key={i} x1={(i-1)*150/Math.max(1,values.length-1)} y1={25-(values[i-1]!-min)/span*22} x2={i*150/Math.max(1,values.length-1)} y2={25-(v-min)/span*22} stroke="currentColor" strokeWidth="1.5" />)}</svg>;
}
function Chart({ labels, series, bars = false }: { labels: string[]; series: { label: string; values: Array<number | null>; color: string }[]; bars?: boolean }) {
  const values = series.flatMap(s => s.values).filter((v): v is number => v !== null);
  if (!values.length) return <p className="owner-note">—</p>;
  const min = Math.min(0,...values), max = Math.max(0,...values), span = max-min || 1;
  const y = (v: number) => 170-(v-min)/span*145;
  const x = (i: number) => 85+i*500/Math.max(1,labels.length-1);
  return <div className="owner-chart"><div className="owner-legend">{series.map(s => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    <svg viewBox="0 0 660 205" role="img" aria-label={series.map(s=>s.label).join(' / ')} style={{direction:'ltr'}}>
      {Array.from({length:5},(_,i)=>{const v=min+span*i/4;return <g key={i}><line x1="62" x2="625" y1={y(v)} y2={y(v)} stroke="#d9e1e8" strokeWidth=".7"/><text x="54" y={y(v)+4} textAnchor="end">{v.toLocaleString('en-US',{notation:'compact',maximumFractionDigits:1})}</text></g>;})}
      <line x1="62" x2="625" y1={y(0)} y2={y(0)} stroke="#64748b" strokeWidth="1" />
      {labels.map((label,i)=><text key={i} x={x(i)} y="195" textAnchor="middle">{label}</text>)}
      {series.map((s,k)=><g key={k}>{s.values.map((v,i)=>v===null?null:bars?<rect key={i} x={x(i)+(k-(series.length/2))*14} y={Math.min(y(v),y(0))} width="12" height={Math.max(1,Math.abs(y(v)-y(0)))} fill={s.color}/>:<g key={i}>{i>0&&s.values[i-1]!==null&&<line x1={x(i-1)} y1={y(s.values[i-1]!)} x2={x(i)} y2={y(v)} stroke={s.color} strokeWidth="2"/>}<circle cx={x(i)} cy={y(v)} r="3" fill="white" stroke={s.color} strokeWidth="1.5"/></g>)}</g>)}
    </svg>
  </div>;
}
function Table({ title, heads, body }: { title: string; heads: string[]; body: ReactNode[][] }) {
  return <section className="owner-table-section"><h2>{title}</h2><table className="owner-table"><thead><tr>{heads.map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{body.map((cells,i)=><tr key={i}>{cells.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></section>;
}
export function OwnerReportChapter({ report, settings, analysis }: { report: ReportPayload; settings: ReportPrintSettings; analysis: OwnerAnalysis }) {
  const { t,language }=useLanguage(); const text=(s:string)=>one(s,language);
  const current=analysis.metrics[0], prior=analysis.metrics[1], opts=analysis.options;
  const timeline=[...analysis.metrics].reverse(), periods=[...analysis.periods].reverse();
  const labels=periods.map(p=>p.income.period.to.slice(0,4));
  const color=settings.colorMode==='plain'||settings.colorMode==='grayscale';
  const palette=[color?'#111111':settings.accentColor||'#167faf',color?'#555555':settings.primaryColor||'#102d50',color?'#999999':'#86b6c7'];
  const id=report.id.replace('owner-','');
  const money=(v:number|null)=><bdi className={v!==null&&v<0?'owner-negative':''}>{signed(v)} <small>{report.currency}</small></bdi>;
  const value=(v:number|null,unit:string)=>unit==='money'?money(v):<bdi>{signed(v)}{v===null?'':unit==='percent'?'%':unit==='times'?'×':` ${t('يوم','days')}`}</bdi>;
  const delta=(key:MetricKey,unit:string)=>{const c=comparison(current[key],prior?.[key]??null,unit==='percent');return c.delta===null?'—':<bdi>{c.delta>0?'↑':c.delta<0?'↓':'→'} {c.percent===null?`${signed(c.delta)} ${t('فرق بالقيمة','value change')}`:`${n(c.percent)}${unit==='percent'?t(' نقطة',' pp'):'%'}`}</bdi>;};
  const groupLabel=(key:MetricKey)=>metricDefinitions.find(m=>m.key===key)?.label||key;
  const metricsCards=(keys:MetricKey[])=>keys.map(key=>{const d=metricDefinitions.find(m=>m.key===key)!;const diff=comparison(current[key],prior?.[key]??null).delta; const favorable=diff===null||diff===0||!d.favorable?'neutral':(diff>0)===(d.favorable==='up')?'good':'bad';return <div key={key} className="owner-kpi"><Spark values={timeline.map(p=>p[key])}/><p>{text(d.label)}</p><strong>{value(current[key],d.unit)}</strong><span data-trend={favorable}>{delta(key,d.unit)}</span><small>{text(d.formula)}</small></div>;});
  const series=(keys:MetricKey[])=>keys.map((key,i)=>({label:text(groupLabel(key)),values:timeline.map(p=>p[key]),color:palette[i%palette.length]}));
  const be=analysis.breakEven;
  const breakEvenStep=be?Math.max(be.sales,(current.revenue??0)/2,1):1;
  const detail=rows(analysis.periods[0].income,'income-ledger-detail').filter(r=>r.id.startsWith('exp-'));
  const costRows=detail.map(r=>({label:text(String(r.values.label||r.label)),amount:Number(r.values.amount)})).filter(r=>Number.isFinite(r.amount));
  const maxCost=Math.max(1,...costRows.map(r=>Math.abs(r.amount)));
  const logo=settings.logoSource==='none'?null:settings.logoSource==='main'?report.org.logoUrl:report.org.printLogoUrl||report.org.logoUrl;
  const styles={...reportAppearance(settings),'--owner-accent':palette[0],'--owner-scale':settings.fontScale==='large'?'1.15':settings.fontScale==='compact'?'1':'1.05','--report-font-size':settings.fontScale==='large'?'12px':settings.fontScale==='compact'?'10px':'11px','--report-cell-padding':settings.density==='comfortable'?'4px 5px':'2px 4px'} as CSSProperties;
  const missing=accountGroups.filter(([key])=>!opts.mapping[key]);
  const unitCount=Number(opts.units), hasUnits=opts.units.trim()!==''&&unitCount>0&&Number.isFinite(unitCount)&&opts.unitName.trim();
  const gap=current.balanceGap;
  return <article className={`entix-report-paper document-paper report-condensed owner-report ${reportTheme(settings)}`} dir={language==='ar'?'rtl':'ltr'} style={styles}>
    <header className="owner-page-heading"><div className="owner-company">{report.org.legalName||report.org.name}{settings.showCompanyInfo!==false&&<small>{[report.org.email,report.org.website].filter(Boolean).join(' · ')}</small>}</div><div><small>{t('تقرير الإدارة المالي','FINANCIAL MANAGEMENT REVIEW')}</small><h1>{language==='ar'?report.title:report.englishTitle}</h1><p><bdi>{report.period.from} — {report.period.to}</bdi> · {report.currency}</p></div><div>{logo&&<img src={logo} alt={report.org.name}/>}</div></header>
    <main className="owner-body">
      {id==='summary'&&<>
        <div className="owner-lead"><span>{t('قراءة في الأرقام المسجلة','A REVIEW OF RECORDED RESULTS')}</span><h2>{current.net===null?t('الصورة المالية تحتاج بيانات','Financial data is not available'):current.net>=0?t('نتيجة الفترة: صافي ربح','Period result: net profit'):t('نتيجة الفترة: صافي خسارة','Period result: net loss')}</h2><p>{t('الإيرادات','Revenue')} {money(current.revenue)} · {t('المصروفات','Expenses')} {money(current.expenses)} · {t('صافي النتيجة','Net result')} {money(current.net)}.</p><p>{t('هذه قراءة للقيود المرحلة خلال الفترة، وليست شهادة باكتمال الدفاتر أو مراجعتها. لا تضاف المسودات إلى الربح.', 'This review uses posted entries in the period and does not certify completeness or audit. Drafts are not added to profit.')}</p></div>
        {[['revenue','net','netMargin'],['grossMargin','ebitda','expenseRatio'],['currentRatio','liabilitiesRatio','roa']].map((ks,i)=><section className="owner-kpi-grid" key={i}>{metricsCards(ks as MetricKey[])}</section>)}
        <p className="owner-note">{t('الأسهم مقارنة بالفترة المناظرة السابقة. الشرطـة تعني أن الحساب يحتاج بيانات أو تصنيفًا؛ ليست صفرًا. التحسن لا يعني بلوغ هدف معتمد.', 'Arrows compare the equivalent prior period. A dash means data or classification is needed, not zero. Improvement does not mean an approved target was met.')}</p>
      </>}
      {id==='performance'&&<>
        <section className="owner-chart-panel"><h2>{t('الإيرادات والمصروفات عبر الفترات','Revenue and expenses across periods')}</h2><Chart labels={labels} series={series(['revenue','expenses'])}/><p>{t('نفس نطاق الأشهر لكل سنة؛ لا تُقارن الفترة الجزئية بسنة كاملة.', 'The same date window is used each year; partial periods are not compared with full years.')}</p></section>
        <section className="owner-chart-panel"><h2>{t('الربح وما قبل التمويل والضريبة والإهلاك','Profit and earnings before finance, tax and depreciation')}</h2><Chart labels={labels} series={series(['net','ebitda'])} bars/><p>{t('EBITDA مؤشر أرباح، وليس رصيد النقد أو التدفق التشغيلي.', 'EBITDA is an earnings measure, not cash on hand or operating cash flow.')}</p></section>
        <Table title={t('جسر النتيجة','Profit bridge')} heads={[t('البند','Item'),report.currency]} body={([['revenue','الإيرادات','Revenue'],['expenses','المصروفات','Expenses'],['net','صافي الربح / الخسارة','Net profit / loss'],['finance','تكلفة التمويل المضافة','Finance expense added back'],['financeIncome','إيراد التمويل المستبعد','Financing income deducted'],['tax','ضريبة الدخل المضافة','Income tax added back'],['depreciation','الإهلاك والإطفاء المضاف','Depreciation added back'],['ebitda','EBITDA','EBITDA']] as const).map(([key,ar,en])=>[t(ar,en),money(current[key])])}/>
      </>}
      {id==='costs'&&<>
        <div className="owner-lead"><h2>{t('من كل 100 من الإيراد','FOR EVERY 100 OF REVENUE')}</h2><strong>{signed(current.expenseRatio)} <small>{t('مصروفات','expenses')}</small> · {signed(current.netMargin)} <small>{t('نتيجة صافية','net result')}</small></strong></div>
        <Table title={t('توزيع المصروفات حسب الحساب','Expenses by account')} heads={[t('الحساب','Account'),t('التوزيع','Distribution'),report.currency,t('لكل 100 إيراد','Per 100 revenue')]} body={costRows.map(r=>[r.label,<div className="owner-bar-track"><i style={{width:`${Math.abs(r.amount)/maxCost*100}%`}}/></div>,money(r.amount),current.revenue!==null&&current.revenue>0?<bdi>{signed(r.amount/current.revenue*100)}</bdi>:'—'])}/>
        <p className="owner-note">{t('كل حساب ظاهر مرة واحدة؛ القيم السالبة معروضة بين قوسين. قد تتجاوز المصروفات 100 عند الخسارة.', 'Every account appears once; negative values use parentheses. Costs can exceed 100 when the period has a loss.')}</p>
        {hasUnits&&<Table title={t('مؤشرات الوحدة التشغيلية','Operating unit metrics')} heads={[opts.unitName,t('العدد المدخل','Author-entered count'),t('الإيراد للوحدة','Revenue per unit'),t('النتيجة للوحدة','Net result per unit')]} body={[[opts.unitName,unitCount,money(current.revenue===null?null:current.revenue/unitCount),money(current.net===null?null:current.net/unitCount)]]}/>}
      </>}
      {id==='position'&&<>
        <section className="owner-chart-panel"><h2>{t('ما تملكه الشركة وما عليها','Assets and how they are financed')}</h2><Chart labels={labels} series={(['assets','liabilities','equity'] as const).map((key,i)=>({label:text(({assets:'الأصول␟Assets',liabilities:'الالتزامات␟Liabilities',equity:'حقوق الملكية␟Equity'})[key]),values:timeline.map(p=>p[key]),color:palette[i]}))} bars/></section>
        <Table title={t('ملخص المركز المالي','Financial position')} heads={[t('البند','Item'),report.currency]} body={([['assets','إجمالي الأصول','Total assets'],['liabilities','إجمالي الالتزامات','Total liabilities'],['equity','حقوق الملكية','Equity'],['cash','النقد وما يعادله','Cash and equivalents'],['debt','ديون التمويل','Financing debt'],['netDebt','صافي ديون التمويل','Net financing debt'],['workingCapital','رأس المال العامل','Working capital']] as const).map(([key,ar,en])=>[t(ar,en),money(current[key])])}/>
        <p className="owner-note">{gap===null?t('تعذر حساب اختبار توازن المركز المالي.', 'Balance-sheet reconciliation is unavailable.'):Math.abs(gap)<.02?t('اختبار الاتزان: الأصول = الالتزامات + حقوق الملكية. هذا لا يثبت اكتمال الدفاتر.', 'Reconciliation: assets equal liabilities plus equity. This does not establish completeness.'):t('فرق في اتزان المركز المالي يحتاج مراجعة: ', 'Balance-sheet reconciliation difference requiring review: ')}{gap!==null&&Math.abs(gap)>=.02&&money(gap)}</p>
        <p className="owner-note">{t('التدفقات النقدية في الملحق حسب مصدرها المعروض. حركة سندات القبض والصرف لا تُسمّى تدفقًا تشغيليًا دون تصنيف.', 'Appendix cash movements retain their stated source. Receipt/payment voucher movements are not labelled operating cash flow without classification.')}</p>
      </>}
      {id==='ratios'&&<Table title={t('جدول المؤشرات: القيمة والتغير والمعادلة','Metric table: value, change and formula')} heads={[t('المؤشر','Metric'),t('الحالي','Current'),t('السابق','Previous'),t('التغير','Change'),t('طريقة الحساب','Formula')]} body={metricDefinitions.map(d=>[text(d.label),value(current[d.key],d.unit),value(prior?.[d.key]??null,d.unit),delta(d.key,d.unit),text(d.formula)])}/>}
      {id==='breakeven'&&<>
        <div className="owner-lead"><h2>{t('كم نحتاج من الإيراد لتغطية التكلفة؟','HOW MUCH REVENUE COVERS THE COST?')}</h2><p>{t('محاكاة من افتراضات معدّ التقرير للفترة نفسها؛ لا تغيّر الدفاتر.', 'A scenario based on author assumptions for the same period; it does not change the ledger.')}</p></div>
        {be?<>
          <section className="owner-kpi-grid">{[[t('إيراد التعادل','Break-even revenue'),be.sales],[t('الإيراد المسجل','Recorded revenue'),current.revenue],[t('الفائض / العجز عن التعادل','Surplus / shortfall to break even'),be.gap]].map(([label,v],i)=><div className="owner-kpi" key={i}><p>{label}</p><strong>{money(v as number|null)}</strong></div>)}</section>
          <section className="owner-chart-panel"><h2>{t('الإيرادات مقابل التكاليف الكلية','Revenue versus total costs')}</h2><Chart labels={[0,.5,1,1.5,2].map(f=>n(breakEvenStep*f,0))} series={[{label:t('الإيرادات','Revenue'),values:[0,.5,1,1.5,2].map(f=>breakEvenStep*f),color:palette[0]},{label:t('التكاليف','Costs'),values:[0,.5,1,1.5,2].map(f=>be.fixed+breakEvenStep*f*be.variable/100),color:palette[1]}]}/></section>
          <Table title={t('الافتراضات والحساسية','Assumptions and sensitivity')} heads={[t('البند','Item'),t('القيمة','Value')]} body={[[t('المصدر / المبرر','Source / rationale'),be.source],[t('التكلفة الثابتة للفترة','Period fixed cost'),money(be.fixed)],[t('التكلفة المتغيرة من الإيراد','Variable cost as share of revenue'),`${n(be.variable)}%`],[t('هامش المساهمة','Contribution margin'),`${n(be.contribution*100)}%`],[t('المعادلة','Formula'),t('التكلفة الثابتة ÷ نسبة هامش المساهمة','Fixed costs ÷ contribution margin ratio')],[t('هامش الأمان','Margin of safety'),`${signed(be.safety)}%`],[t('إيراد تحقيق الربح المستهدف','Revenue for target profit'),money(be.targetSales)],...[-10,0,10].map(change=>[t(`تغير الإيراد ${change}% · النتيجة المتوقعة`,`Revenue change ${change}% · scenario result`),money(current.revenue===null?null:current.revenue*(1+change/100)*be.contribution-be.fixed)])]}/>
        </>:<p className="owner-note">{t('أدخل التكلفة الثابتة ونسبة التكلفة المتغيرة ومصدر الافتراضات في إعداد التقرير لإظهار التعادل والرسم والحساسية. لا يُفترض أن كل المصروفات ثابتة.', 'Enter fixed costs, the variable cost percentage and an assumption source in report settings to show break-even, chart and sensitivity. Expenses are not assumed to be fixed.')}</p>}
      </>}
      {id==='history'&&<>
        <Table title={t('ملخص مالي للفترات المناظرة','Financial summary for equivalent periods')} heads={[t('المؤشر','Metric'),...periods.map(p=>`${p.income.period.from} — ${p.income.period.to}`)]} body={(['revenue','expenses','net','gross','ebitda','assets','liabilities','equity'] as const).map(key=>[text(metricDefinitions.find(m=>m.key===key)?.label||({gross:biText('مجمل الربح','Gross profit'),assets:biText('الأصول','Assets'),liabilities:biText('الالتزامات','Liabilities'),equity:biText('حقوق الملكية','Equity')} as Record<string,string>)[key]),...timeline.map(m=>money(m[key]))])}/>
        <p className="owner-note">{t('المبالغ من القيود المسجلة في Entix. عدم وجود حركة مسجلة في سنة سابقة لا يثبت أن الشركة لم تمارس نشاطًا. لا تُخلط قوائم خارجية غير مستوردة مع هذه الأرقام.', 'Amounts come from entries recorded in Entix. No recorded activity in an earlier year does not prove the company had no activity. Unimported external statements are not mixed with these figures.')}</p>
      </>}
      {id==='method'&&<>
        <Table title={t('الفترة والمصدر وحالة البيانات','Period, source and data status')} heads={[t('التقرير','Report'),t('الفترة','Period'),t('الحالة','Status'),t('وقت القراءة','Read time')]} body={analysis.periods.flatMap(p=>[p.income,p.balance,p.opening]).map(r=>[language==='ar'?r.title:r.englishTitle,`${r.period.from||'—'} — ${r.period.to}`,r.status==='unavailable'||r.dataBasis?.status==='unavailable'?t('غير متاح','Unavailable'):r.dataBasis?.status==='no_activity'?t('لا توجد حركة مسجلة','No recorded activity'):t('قيود مسجلة؛ غير مدققة','Recorded entries; unaudited'),r.generatedAt.slice(0,19).replace('T',' ')+' UTC'])}/>
        <Table title={t('تصنيف الحسابات المستخدم للتحليل','Account classifications used for analysis')} heads={[t('المجموعة','Group'),t('الحسابات التي اختارها معدّ التقرير','Accounts selected by the author')]} body={accountGroups.map(([key,ar,en,type])=>[t(ar,en),opts.mapping[key]===undefined?t('لم تُحدد','Not configured'):opts.mapping[key]!.length===0?t('أكد معدّ التقرير عدم وجود حسابات','Author confirmed no accounts'):opts.mapping[key]!.map(id=>text(availableAccounts(analysis.periods,type).find(r=>r.id===id)?.label||id)).join(' · ')])}/>
        <Table title={t('قواعد القراءة','Reading rules')} heads={[t('القاعدة','Rule')]} body={[
          [t('مؤشرات الفترة ليست سنوية إلا إذا كانت الفترة سنة كاملة. الفترات المقارنة تستخدم نفس تاريخ البداية والنهاية في السنوات السابقة.', 'Period ratios are not annualised unless the period is a full year. Comparison windows use the same start and end dates in prior years.')],
          [t('مقام صفر أو سالب، أو مصدر غير متاح: النسبة لا تُحسب. التحول من خسارة أو أساس صفري يُعرض كفرق بالقيمة، لا كنمو مضلل.', 'Ratios are not computed for zero/negative denominators or unavailable data. Changes from a loss or zero base are shown as absolute differences, not misleading growth.')],
          [t('النمو في الهامش يُعرض بالنقاط المئوية. ألوان التغير تعني اتجاه المقارنة فقط؛ لا توجد عتبات نجاح مفترضة.', 'Margin changes use percentage points. Trend colours indicate comparison direction only; no success thresholds are assumed.')],
          [t('التعادل: التكلفة الثابتة ÷ (1 − نسبة التكلفة المتغيرة). المرجع: OpenStax، Principles of Accounting Volume 2، القسم 3.2.', 'Break-even: fixed costs ÷ (1 − variable cost ratio). Reference: OpenStax, Principles of Accounting Volume 2, section 3.2.')],
          [t('التقييم الاستثماري والشروط القانونية والتمويلية تحتاج افتراضات وأدلة مستقلة؛ لا يستنتج هذا التقرير قيمة عادلة أو موافقة استثمارية.', 'Investment valuation, legal terms and financing conditions require separate assumptions and evidence; this report does not infer a fair value or investment approval.')],
        ]}/>
        {analysis.periods[0].income.notices?.map((notice,i)=><p key={i} className="owner-note">{text(notice)}</p>)}
      </>}
      {id==='actions'&&<>
        <Table title={t('نقاط المتابعة المستخرجة من البيانات','Follow-up from recorded data')} heads={[t('الملاحظة','Observation'),t('الإجراء','Action')]} body={[
          [t('مراجعة اكتمال الدفاتر','Ledger completeness'),t('طابق المستندات والقيود والأرصدة البنكية قبل اعتماد التقرير.', 'Reconcile documents, journals and bank balances before approving the report.')],
          ...(gap!==null&&Math.abs(gap)>=.02?[[t('فرق اتزان المركز المالي','Balance-sheet difference'),money(gap)]]:[]),
          ...(current.net!==null&&current.net<0?[[t('خسارة مسجلة خلال الفترة','Recorded period loss'),t('راجع مصادر الإيراد وهيكل التكلفة في قائمة الدخل المرفقة.', 'Review revenue sources and costs in the appended income statement.')]]:[]),
          ...(missing.length?[[t('مؤشرات تحتاج تصنيفًا','Ratios needing classification'),missing.map(([,ar,en])=>t(ar,en)).join(' · ')]]:[]),
          ...(!be?[[t('التعادل يحتاج افتراضات','Break-even needs assumptions'),t('أكمل تكلفة الفترة الثابتة ونسبة التكلفة المتغيرة ومصدرهما.', 'Complete period fixed costs, variable cost percentage and their source.')]]:[]),
        ]}/>
        <Table title={t('ملاحظات معدّ التقرير','Author commentary')} heads={[t('التفسير والتوصيات المدخلة يدويًا','Manually entered interpretation and recommendations')]} body={opts.notes.trim()?opts.notes.split('\n').filter(Boolean).flatMap(line=>(line.match(/[\s\S]{1,350}(?:\s|$)|[\s\S]{1,350}/g)||[line]).map(part=>[part])):[[t('لم تُضف ملاحظات.', 'No commentary added.')]]}/>
      </>}
    </main>
    <footer className="report-condensed-footer"><span>{report.org.name} · {t('خاص بالإدارة · غير مدقق','Management use · unaudited')}</span><span>{report.id} · {report.generatedAt.slice(0,10)}</span></footer>
  </article>;
}
const biText=(ar:string,en:string)=>`${ar}␟${en}`;
