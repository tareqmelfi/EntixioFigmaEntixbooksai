export type ApprovalContent = {
  title:string; client:string; project:string; number:string; reference:string; revision:string; date:string;
  introduction:string; terms:string[]; companySigner:string; companyRole:string;
  drawings:Array<{code:string;title:string;revision:string;image:string}>;
};
export type ApprovalIdentity = {company:string;logo:string;logoLight:string;coverImage:string;watermark:string;coverColor:string;accent:string;footer:string};
export type ApprovalRecord = {id:string;name:string;isTemplate:boolean;identityTemplateId:string|null;identity:ApprovalIdentity;content:ApprovalContent;version:number;updatedAt:string};
export function blankApproval():ApprovalContent {
  return {title:'اعتماد المخططات ثنائية الأبعاد',client:'',project:'',number:'',reference:'',revision:'V01',date:new Date().toISOString().slice(0,10),
    introduction:'اعتماد المخططات والتعديلات المعمارية تمهيدًا للانتقال إلى مرحلة التصميم ثلاثي الأبعاد ضمن نطاق العمل المتفق عليه.',
    terms:[
      'أقر بأنني اطلعت على المخططات المدرجة في هذا المستند وراجعت توزيع المساحات والتعديلات والملاحظات، وأعتمدها أساسًا للانتقال إلى مرحلة التصميم ثلاثي الأبعاد ضمن النطاق المتفق عليه.',
      'يرتبط هذا الاعتماد بأرقام المخططات وإصداراتها المدرجة أدناه. أي تعديل لاحق يوثّق كتابيًا ويُتفق على أثره في المدة والتكلفة قبل التنفيذ.',
      'يقتصر هذا المستند على اعتماد المخططات ثنائية الأبعاد. يعتمد التصميم ثلاثي الأبعاد لاحقًا بصورة مستقلة، ولا يعد هذا المستند اعتمادًا للمخططات التنفيذية أو تصريحًا لبدء الأعمال.'
    ],companySigner:'',companyRole:'',drawings:[{code:'2D-01',title:'مخطط الدور الأرضي',revision:'V01',image:''},{code:'2D-02',title:'مخطط الدور الأول',revision:'V01',image:''}]};
}
