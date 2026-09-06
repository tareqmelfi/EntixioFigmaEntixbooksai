import { API_BASE_URL, getOrgId } from './api'
export type Field = {key:string;ar:string;en:string;type?:string;required?:boolean;options?:string[];max?:number}
export type Definition = {key:string;ar:string;en:string;fields:Field[]}
export type ManagementRecord = {id:string;kind:string;key:string;title:string;data:Record<string,any>;version:number;updatedAt:string}
export type ManagementDocument = {id:string;recordId:string;revision:number;fileName:string;mimeType:string;sha256:string;issuedAt?:string;expiresAt?:string;status:string;createdAt:string}
export type ManagementState = {org:Record<string,any>;records:ManagementRecord[];documents:ManagementDocument[];counts:Record<string,number>;serverDate:string;catalog:{areas:Definition[];collections:Definition[];requirementTemplates:Record<string,string[]>;filingTemplates:Record<string,string[]>}}
/** Bind each operation to the displayed company; never redirect an old form to a newly selected tenant. */
export async function managementRequest<T>(orgId:string,path='',body?:unknown,method=body?'POST':'GET',signal?:AbortSignal):Promise<T> {
  if(getOrgId()!==orgId) throw new Error('تغيرت المنشأة؛ حدّث الصفحة. / Company changed; reload the page.')
  const response=await fetch(`${API_BASE_URL}/api/management${path}`,{method,credentials:'include',signal,headers:{'Content-Type':'application/json','X-Org-Id':orgId},body:body===undefined?undefined:JSON.stringify(body)})
  const data=await response.json()
  if(!response.ok) throw new Error(data.messageAr || data.message || (response.status===403?'هذه الصفحة متاحة للمالك والمدير فقط. / Owner or administrator access required.':response.status===409?'عُدّل السجل؛ حدّث الصفحة. / Record changed; reload.':'تعذر تنفيذ الطلب. / Request failed.'))
  if(getOrgId()!==orgId) throw new Error('تغيرت المنشأة؛ حدّث الصفحة. / Company changed; reload the page.')
  return data
}
export const fileBase64 = (file:File) => new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('تعذر قراءة الملف / File could not be read'));reader.readAsDataURL(file)})
export function saveDownload(content:Blob,name:string) {const url=URL.createObjectURL(content),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
