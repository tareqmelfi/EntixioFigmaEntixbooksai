/**
 * Notifications · full feed page · /app/notifications
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ToastStack, InlineConfirm, useToasts } from "../components/side-panel";
import { api, ApiError, NotificationItem } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

const TYPE_LABELS_AR: Record<string, string> = {
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
const TYPE_LABELS_EN: Record<string, string> = {
  INVOICE_PAID: "💰 Receipt voucher",
  EXPENSE_CREATED: "💸 Payment voucher",
  QUOTE_ACCEPTED: "✅ Quote",
  QUOTE_SIGNED: "✍️ Signed quote",
  INVOICE_OVERDUE: "⏰ Overdue invoice",
  OCR_LOW_CONFIDENCE: "📷 OCR",
  SIGN_REQUESTED: "📨 Signature request",
  SIGN_COMPLETED: "✍️ Signature completed",
  SYSTEM: "🔧 System",
};

function timeAgo(iso: string, lang: "ar" | "en"): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const en = lang === "en";
  if (m < 1) return en ? "just now" : "الآن";
  if (m < 60) return en ? `${m}m ago` : `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return en ? `${h}h ago` : `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  return en ? `${d}d ago` : `منذ ${d} يوم`;
}

export function Notifications() {
  const { t, language } = useLanguage();
  const TYPE_LABELS = language === "en" ? TYPE_LABELS_EN : TYPE_LABELS_AR;
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const { toasts, push, dismiss } = useToasts();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.notifications.list({ unread: filter === "UNREAD", limit: 200 });
      setItems(r.items);
    } catch (e: any) { setError(e instanceof ApiError ? e.message : t("فشل التحميل", "Failed to load")); }
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
    setPendingDelete(null);
    try {
      await api.notifications.remove(id);
      setItems(arr => arr.filter(x => x.id !== id));
    } catch (e: any) { push("error", e instanceof ApiError ? e.message : t("فشل الحذف", "Delete failed")); }
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
          <h1 className="text-foreground" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{t("الإشعارات", "Notifications")}</h1>
          <p className="text-muted-foreground mt-1">{items.length} {t("إشعار", "notifications")} · {unreadCount} {t("غير مقروء", "unread")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setFilter(filter === "ALL" ? "UNREAD" : "ALL")} className="border-border">
            {filter === "ALL" ? t("غير المقروءة فقط", "Unread only") : t("كل الإشعارات", "All notifications")}
          </Button>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAll} className="bg-primary hover:bg-primary/90">
              <CheckCheck className="me-2 h-4 w-4" /> {t("تحديد الكل كمقروء", "Mark all as read")}
            </Button>
          )}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card className="border-border">
        <CardHeader><CardTitle className="text-foreground">{t("آخر الإشعارات", "Latest notifications")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" />
              <p className="text-sm text-muted-foreground">{filter === "UNREAD" ? t("لا توجد إشعارات غير مقروءة", "No unread notifications") : t("لا توجد إشعارات بعد", "No notifications yet")}</p>
            </div>
          ) : (
            <div>
              {items.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 px-6 py-4 border-b border-border/50 last:border-0 hover:bg-muted cursor-pointer transition-colors ${!n.readAt ? "bg-primary/5/30" : ""}`}
                  onClick={() => handleClick(n)}
                >
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.readAt ? "bg-primary" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/5 text-primary">{TYPE_LABELS[n.type] || n.type}</span>
                      <span className="text-xs text-muted-foreground/60">{timeAgo(n.createdAt, language)}</span>
                    </div>
                    <p className="text-sm text-foreground" style={{ fontWeight: !n.readAt ? 600 : 500 }}>{n.title}</p>
                    {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                  </div>
                  {pendingDelete === n.id ? (
                    <InlineConfirm
                      onConfirm={() => handleDelete(n.id)}
                      onCancel={() => setPendingDelete(null)}
                    />
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(n.id); }}
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                    ><Trash2 className="h-4 w-4" /></button>
                  )}
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
