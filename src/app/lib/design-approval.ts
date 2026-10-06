export type ApprovalContent = {
  designType?:'2D'|'3D';
  title:string; client:string; project:string; number:string; reference:string; revision:string; date:string;
  introduction:string; terms:string[]; companySigner:string; companyRole:string;
  drawings:Array<{code:string;title:string;revision:string;image:string}>;
};
export type ApprovalIdentity = {company:string;logo:string;logoLight:string;coverImage:string;watermark:string;coverColor:string;accent:string;footer:string};
export type ApprovalRecord = {id:string;name:string;isTemplate:boolean;identityTemplateId:string|null;identity:ApprovalIdentity;content:ApprovalContent;version:number;updatedAt:string};
export function approvalType(content:ApprovalContent):'2D'|'3D' {
  return content.designType || (/(?:\b3D\b|ثلاثي(?:ة)? الأبعاد)/i.test(content.title)?'3D':'2D');
}
export function blankApproval(designType:'2D'|'3D'='2D'):ApprovalContent {
  if(designType==='3D') return {
    designType,title:'اعتماد التصميم ثلاثي الأبعاد',client:'',project:'',number:'',reference:'',revision:'V01',date:new Date().toISOString().slice(0,10),
    introduction:'اعتماد التصاميم ثلاثية الأبعاد والألوان والخامات والتفاصيل البصرية المرفقة وفق إصداراتها، ضمن نطاق العمل المتفق عليه.',
    terms:[
      'أقر بأنني اطلعت على التصاميم ثلاثية الأبعاد المرفقة، وأوافق على الفكرة التصميمية والشكل العام والألوان والخامات والتفاصيل البصرية الموضحة وفق إصدار كل تصميم.',
      'أي تعديل بعد الاعتماد يؤثر في التصميم أو الخامات أو الألوان أو التوزيع أو نطاق الأعمال يُقيّم بصورة مستقلة، وقد يؤثر في التكلفة والمدة، ولا ينفّذ إلا بعد اعتماد الطرفين.',
      'التصاميم تمثيل بصري للتصميم المعتمد. قد تختلف درجات اللون والملمس والإضاءة عند التنفيذ بحسب المواد والموقع والإضاءة، مع الالتزام بالمواصفات والخامات المعتمدة قدر الإمكان.',
      'يرتبط هذا الاعتماد بالتصاميم والإصدارات المرفقة، ويحل محل الإصدارات السابقة لنفس المساحات بعد التوقيع، ويكون مرجعًا للانتقال إلى المرحلة التالية ضمن النطاق المتفق عليه.'
    ],companySigner:'',companyRole:'',drawings:[{code:'3D-01',title:'منظور التصميم',revision:'V01',image:''}]
  };
  return {title:'اعتماد المخططات ثنائية الأبعاد',client:'',project:'',number:'',reference:'',revision:'V01',date:new Date().toISOString().slice(0,10),
    introduction:'اعتماد المخططات والتعديلات المعمارية تمهيدًا للانتقال إلى مرحلة التصميم ثلاثي الأبعاد ضمن نطاق العمل المتفق عليه.',
    terms:[
      'أقر بأنني اطلعت على المخططات المدرجة في هذا المستند وراجعت توزيع المساحات والتعديلات والملاحظات، وأعتمدها أساسًا للانتقال إلى مرحلة التصميم ثلاثي الأبعاد ضمن النطاق المتفق عليه.',
      'يرتبط هذا الاعتماد بأرقام المخططات وإصداراتها المدرجة أدناه. أي تعديل لاحق يوثّق كتابيًا ويُتفق على أثره في المدة والتكلفة قبل التنفيذ.',
      'يقتصر هذا المستند على اعتماد المخططات ثنائية الأبعاد. يعتمد التصميم ثلاثي الأبعاد لاحقًا بصورة مستقلة، ولا يعد هذا المستند اعتمادًا للمخططات التنفيذية أو تصريحًا لبدء الأعمال.'
    ],companySigner:'',companyRole:'',drawings:[{code:'2D-01',title:'مخطط الدور الأرضي',revision:'V01',image:''},{code:'2D-02',title:'مخطط الدور الأول',revision:'V01',image:''}]};
}
