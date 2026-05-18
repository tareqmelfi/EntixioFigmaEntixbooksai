/**
 * InvoicePreviewPane · split-view preview that shows when a row is clicked.
 *
 * Product requirement UX request (Wafeq pattern):
 * - Click row in list → preview pane opens on the left (RTL: end side)
 * - List collapses to narrow column on the right
 * - Click X or click another row to switch
 *
 * Reusable for: Invoice · Quote · Bill (any document with lines + totals)
 *
 * Usage:
 *   <InvoicePreviewPane
 *     invoice={selectedInvoice}
 *     customer={customer}
 *     onClose={() => setSelectedId(null)}
 *     onSign={() => openSign(invoice)}
 *     onApprove={() => handleApprove(invoice)}
 *     onDelete={() => setPendingDelete(invoice.id)}
 *   />
 */
import { ReactNode } from "react";
import { X, FileSignature, Mail, Download, Printer, Edit3 } from "lucide-react";
import { Button } from "./ui/button";

interface DocumentLike {
  id: string;
  /** Invoice / Quote / Bill number */
  number: string;
  status: string;
  issueDate?: string;
  dueDate?: string;
  validUntil?: string;
  total: string | number;
  amountPaid?: string | number;
  currency?: string;
  notes?: string | null;
  lines?: Array<{
    id?: string;
    description: string;
    quantity: number | string;
    unitPrice: number | string;
    total?: number | string;
  }>;
}

interface ContactLike {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address?: string | null;
}

interface Props {
  doc: DocumentLike;
  customer?: ContactLike | null;
  /** Status label map · e.g. { DRAFT: "مسودة", SENT: "مرسلة" } */
  statusLabels?: Record<string, string>;
  /** Status color map · Tailwind class string */
  statusColors?: Record<string, string>;
  docTypeLabel?: string; // "فاتورة" | "عرض سعر" | "فاتورة شراء"
  onClose: () => void;
  onApprove?: () => void;
  onSign?: () => void;
  onRecordPayment?: () => void;
  onSendEmail?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Optional extra action slot in the toolbar */
  extraActions?: ReactNode;
}

export function InvoicePreviewPane({
  doc,
  customer,
  statusLabels = {},
  statusColors = {},
  docTypeLabel = "مستند",
  onClose,
  onApprove,
  onSign,
  onRecordPayment,
  onSendEmail,
  onEdit,
  onDelete,
  extraActions,
}: Props) {
  const total = Number(doc.total);
  const paid = Number(doc.amountPaid || 0);
  const outstanding = total - paid;
  const statusLabel = statusLabels[doc.status] || doc.status;
  const statusColor = statusColors[doc.status] || "bg-gray-100 text-gray-700";

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden flex flex-col h-[calc(100vh-10rem)]">
      {/* Header bar · sticky */}
      <div className="border-b border-[#E5E7EB] bg-white px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]"
            aria-label="إغلاق المعاينة"
            title="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[#0B1B49] truncate" style={{ fontSize: "1rem", fontWeight: 700 }}>
                {docTypeLabel} <span className="font-english">{doc.number}</span>
              </h2>
              <span className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>{statusLabel}</span>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5 truncate">{customer?.displayName || "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {extraActions}
          {onApprove && doc.status === "DRAFT" && (
            <button onClick={onApprove} className="rounded-md px-2 py-1 text-xs text-green-700 hover:bg-green-50 border border-green-200" title="اعتماد">
              ✓ اعتماد
            </button>
          )}
          {onRecordPayment && doc.status !== "PAID" && doc.status !== "CANCELLED" && (
            <button onClick={onRecordPayment} className="rounded-md px-2 py-1 text-xs text-green-700 hover:bg-green-50 flex items-center gap-1 border border-green-200" title="تسجيل دفعة على الفاتورة">
              💰 دفعة
            </button>
          )}
          {onSign && doc.status !== "DRAFT" && doc.status !== "PAID" && doc.status !== "CANCELLED" && doc.status !== "CONVERTED" && (
            <button onClick={onSign} className="rounded-md px-2 py-1 text-xs text-[#1276E3] hover:bg-blue-50 flex items-center gap-1" title="إرسال للتوقيع">
              <FileSignature className="h-3.5 w-3.5" /> توقيع
            </button>
          )}
          {onSendEmail && (
            <button onClick={onSendEmail} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]" title="إرسال بالبريد">
              <Mail className="h-4 w-4" />
            </button>
          )}
          <div className="inline-flex rounded-md border border-[#E5E7EB] overflow-hidden">
            <button onClick={() => window.open(`/print/invoice/${doc.id}?lang=ar`, '_blank')}
              className="px-2 py-1.5 text-[#6B7280] hover:bg-[#F3F4F6] flex items-center gap-1 text-xs"
              title="طباعة بالعربي">
              <Printer className="h-3.5 w-3.5" /> عربي
            </button>
            <span className="w-px bg-[#E5E7EB]" />
            <button onClick={() => window.open(`/print/invoice/${doc.id}?lang=en`, '_blank')}
              className="px-2 py-1.5 text-[#6B7280] hover:bg-[#F3F4F6] flex items-center gap-1 text-xs font-english"
              title="Print in English">
              <Printer className="h-3.5 w-3.5" /> EN
            </button>
          </div>
          {onEdit && (
            <button onClick={onEdit} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]" title="تعديل">
              <Edit3 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body · scrollable preview */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#F4FCFF]">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 max-w-3xl mx-auto">
          {/* Document head */}
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-[#E5E7EB]">
            <div>
              <h3 className="text-[#0B1B49]" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                {docTypeLabel} <span className="font-english">{doc.number}</span>
              </h3>
              {doc.issueDate && (
                <p className="text-xs text-[#6B7280] mt-1">تاريخ الإصدار: <span className="font-english">{doc.issueDate.slice(0, 10)}</span></p>
              )}
              {doc.dueDate && (
                <p className="text-xs text-[#6B7280] mt-0.5">تاريخ الاستحقاق: <span className="font-english">{doc.dueDate.slice(0, 10)}</span></p>
              )}
              {doc.validUntil && (
                <p className="text-xs text-[#6B7280] mt-0.5">صالح حتى: <span className="font-english">{doc.validUntil.slice(0, 10)}</span></p>
              )}
            </div>
            <div className="text-end">
              <span className={`text-xs px-2 py-1 rounded ${statusColor}`}>{statusLabel}</span>
            </div>
          </div>

          {/* Customer block */}
          {customer && (
            <div className="mb-6 pb-4 border-b border-[#E5E7EB]">
              <p className="text-xs text-[#6B7280] mb-1">إلى:</p>
              <p className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{customer.displayName}</p>
              {customer.email && <p className="text-xs text-[#6B7280] font-english mt-0.5">{customer.email}</p>}
              {customer.phone && <p className="text-xs text-[#6B7280] font-english">{customer.phone}</p>}
              {customer.taxId && <p className="text-xs text-[#6B7280]">الرقم الضريبي: <span className="font-english">{customer.taxId}</span></p>}
              {customer.address && <p className="text-xs text-[#6B7280] mt-0.5">{customer.address}</p>}
            </div>
          )}

          {/* Lines */}
          {doc.lines && doc.lines.length > 0 && (
            <table className="w-full mb-6">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs text-[#6B7280]">
                  <th className="py-2 px-3 text-start" style={{ fontWeight: 600 }}>الوصف</th>
                  <th className="py-2 px-3 text-start w-20" style={{ fontWeight: 600 }}>الكمية</th>
                  <th className="py-2 px-3 text-start w-28" style={{ fontWeight: 600 }}>السعر</th>
                  <th className="py-2 px-3 text-start w-28" style={{ fontWeight: 600 }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l, i) => (
                  <tr key={l.id || i} className="border-b border-[#F3F4F6]">
                    <td className="py-2 px-3 text-sm text-[#374151]">{l.description}</td>
                    <td className="py-2 px-3 font-english text-sm text-[#374151]">{Number(l.quantity).toLocaleString()}</td>
                    <td className="py-2 px-3 font-english text-sm text-[#374151]">{Number(l.unitPrice).toFixed(2)}</td>
                    <td className="py-2 px-3 font-english text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>
                      {(l.total !== undefined ? Number(l.total) : Number(l.quantity) * Number(l.unitPrice)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-full max-w-xs space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6B7280]">الإجمالي:</span>
                <span className="font-english text-[#0B1B49]" style={{ fontWeight: 700, fontSize: "1rem" }}>
                  {total.toLocaleString()} {doc.currency || "SAR"}
                </span>
              </div>
              {paid > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6B7280]">المُحصَّل:</span>
                    <span className="font-english text-green-600" style={{ fontWeight: 600 }}>{paid.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-[#E5E7EB]">
                    <span className="text-[#6B7280]">المتبقي:</span>
                    <span className="font-english text-amber-600" style={{ fontWeight: 600 }}>{outstanding.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {doc.notes && (
            <div className="pt-4 border-t border-[#E5E7EB]">
              <p className="text-xs text-[#6B7280] mb-1">ملاحظات:</p>
              <p className="text-sm text-[#374151] whitespace-pre-wrap">{doc.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
