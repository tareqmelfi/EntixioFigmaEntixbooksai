import {useEffect,useState} from "react";
import {useNavigate,useParams} from "react-router";
import {useAuthState} from "../components/use-auth-state";
import {useLanguage} from "../components/LanguageContext";
import {Button} from "../components/ui/button";
import {api} from "../lib/api";
export function ProjectGuest() {
 const {id,token}=useParams(), navigate=useNavigate(), auth=useAuthState(), {t}=useLanguage();const [data,setData]=useState<any>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{setData(null);setError("");if(auth.isAuthenticated && id)api.projectAccess.get(id).then(setData).catch(()=>setError(t("المشروع غير متاح أو ألغي وصولك إليه","Project unavailable or access revoked")));},[id,auth.isAuthenticated]);
 const accept=async()=>{setBusy(true);try{const d=await api.projectAccess.accept(token!);navigate(`/project-space/${d.projectId}`,{replace:true});}catch{setError(t("تأكد من توثيق بريدك ومطابقته للدعوة. قد يكون الرابط انتهى أو أُلغي.","Use the invited, verified email. The link may have expired or been revoked."));}finally{setBusy(false);}};
 return <main className="mx-auto max-w-4xl space-y-5 p-6" dir={t("rtl","ltr")}><h1 className="text-2xl font-semibold">{data?.project.name || t("مساحة المشروع","Project workspace")}</h1>{auth.loading ? <p>{t("جار التحميل","Loading")}</p> : !auth.isAuthenticated ? <Button onClick={()=>navigate('/login',{state:{from:token?`/project-invite/${token}`:`/project-space/${id}`}})}>{t("تسجيل الدخول بالبريد المدعو","Sign in with invited email")}</Button> : token ? <><p>{t("بقبول الدعوة يمكنك الاطلاع على المشروع ومواعيده والمهام فقط.","Accept to view this project's schedule and tasks only.")}</p><Button disabled={busy} onClick={accept}>{t("قبول الدعوة","Accept invitation")}</Button></> : data && <><p>{data.project.code} · {data.project.endDate?.slice(0,10)||t("لم يحدد موعد","No deadline")}</p>{data.tasks.map((task:any)=><div key={task.id} className="flex flex-wrap justify-between gap-3 border-b border-border py-3"><span>{task.title}</span><span>{task.dueDate?.slice(0,10)||"—"}</span><span>{Number(task.progressPct)}%</span></div>)}</>}{error && <p role="alert" className="text-danger">{error}</p>}</main>;
}
