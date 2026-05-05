/**
 * Notifications · full feed page · /app/notifications
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { SidePanel, ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError, NotificationItem } from "../lib/api";

const TYPE_LABELS: Record<string, string> = {
  INVOICE_PAID: "💰 سند قبض",
  EXPENSE_CREATED: "💸 سند صرف",
  QUOTE_ACCEPTED: "✅ عرض سعر",
  QUOTE_SIGNED: "✍️ عرض موقّع",
  INVOICE_OVERDUE: "⏰ فاتورة متأخرة",
  OCR_LOW_CONFIDENCE: "📷 OCR",
  SIGN_REQUESTED: "📨 طلب توقيع",
  SIGN_COMPLETED: "✍️ توقيع مكتمل",
  SYSTEM: "🔧 النظام",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  return `منذ ${d} يوم`;
}

export function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.notifications.list({ unread: filter === "UNREAD", limit: 200 });
      setItems(r.items);
    } catch (e: any) { setError(e instanceof ApiError ? e.message : "فشل التحميل"); }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { refresh(); }, [refresh]);

  const handleClick = async (n: NotificationItem) => {
    if (!n.readAt) {
      try {
        await api.notifications.markRead(n.id);
        setItems(arr => arr.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x));
      } catch {}
    }
    if (n.link) navigate(n.link);
  };

  const handleDelete = async (id: string) => {
    /* TODO-UX1: was confirm("حذف الإشعار؟") — replace with InlineConfirm */ 
try {
      await api.notifications.remove(id);
      setItems(arr => arr.filter(x => x.id !== id));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : "فشل الحذف"); }
  };

  const handleMarkAll = async () => {
    try {
      await api.notifications.markAllRead();
      setItems(arr => arr.map(x => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    } catch {}
  };

  const unreadCount = items.filter(n => !n.readAt).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.75rem", fontWeight: 700 }}>الإشعارات</h1>
          <p className="text-[#6B7280] mt-1">{items.length} إشعار · {unreadCount} غير مقروء</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFilter(filter === "ALL" ? "UNREAD" : "ALL")} className="border-[#E5E7EB]">
            {filter === "ALL" ? "غير المقروءة فقط" : "كل الإشعارات"}
          </Button>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAll} className="bg-[#1276E3] hover:bg-[#1060C0]">
              <CheckCheck className="me-2 h-4 w-4" /> تحديد الكل كمقروء
            </Button>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card className="border-[#E5E7EB]">
        <CardHeader><CardTitle className="text-[#0B1B49]">آخر الإشعارات</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#1276E3]" /></div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="h-12 w-12 mx-auto text-[#9CA3AF] mb-3" />
              <p className="text-sm text-[#6B7280]">{filter === "UNREAD" ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات بعد"}</p>
            </div>
          ) : (
            <div>
              {items.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 px-6 py-4 border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] cursor-pointer transition-colors ${!n.readAt ? "bg-[#EFF6FF]/30" : ""}`}
                  onClick={() => handleClick(n)}
                >
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.readAt ? "bg-[#1276E3]" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs px-2 py-0.5 rounded bg-[#F4FCFF] text-[#1276E3]">{TYPE_LABELS[n.type] || n.type}</span>
                      <span className="text-xs text-[#9CA3AF]">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[#0B1B49]" style={{ fontWeight: !n.readAt ? 600 : 500 }}>{n.title}</p>
                    {n.body && <p className="text-sm text-[#6B7280] mt-1">{n.body}</p>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                    className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                  ><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
