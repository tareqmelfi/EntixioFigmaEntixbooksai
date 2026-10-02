import {API_BASE_URL, ApiError, type AdminPlanRecord} from './api';
export async function adminManagementRequest<T>(path:string, method='GET', body?:unknown):Promise<T>{
 const response=await fetch(`${API_BASE_URL}/api/admin${path}`,{method,credentials:'include',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new ApiError(response.status,data.message||data.error||'admin_request_failed');
 return data;
}
export const adminManagement={
 importPlan:(body:{stripePriceId:string;tier:string;nameAr?:string})=>adminManagementRequest<{plan:AdminPlanRecord;existing?:boolean}>('/plans/import','POST',body),
 deletePlan:(id:string)=>adminManagementRequest(`/plans/${encodeURIComponent(id)}`,'DELETE'),
};
