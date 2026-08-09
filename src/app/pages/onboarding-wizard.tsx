/**
 * Onboarding Wizard · /app/onboarding · 4-step first-run data migration.
 *  1) Opening balances (cash/bank/inventory/AR/AP → balanced journal, capital plug)
 *  2) Items import (CSV preview → bulk import · optional opening stock · or AI extract)
 *  3) Customers & suppliers import (CSV preview → bulk import)
 *  4) Done — summary + next actions
 * Bilingual AR/EN · no popups (UX-1) · every step skippable.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Upload, Sparkles, FileText,
  Landmark, Package, Users, PartyPopper, AlertCircle, Download, SkipForward,
} from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../components/LanguageContext";

type ProductRow = { name: string; nameAr?: string; sku?: string; type?: "GOOD" | "SERVICE" | "INVENTORY"; unitPrice?: number; costPrice?: number; openingQty?: number };
type ContactRow = { name: string; type?: "CUSTOMER" | "SUPPLIER" | "BOTH"; email?: string; phone?: string; taxId?: string };

// ── tiny CSV parser (handles quoted cells + commas) ─────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { cur.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(cell); cell = "";
      if (cur.some((x) => x.trim() !== "")) rows.push(cur);
      cur = [];
    } else cell += ch;
  }
  cur.push(cell);
  if (cur.some((x) => x.trim() !== "")) rows.push(cur);
  return rows;
}

function headerIndex(header: string[], keys: string[]): number {
  // Normalize: strip spaces/underscores/hyphens so "Unit Price" = "unit_price" = "unitprice"
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "");
  const h = header.map(norm);
  for (const k of keys) {
    const i = h.indexOf(norm(k));
    if (i >= 0) return i;
  }
  return -1;
}

/** Drop instruction/comment rows (first cell starts with #) so the real header becomes row 0 */
function dataRows(rows: string[][]): string[][] {
  return rows.filter((r) => !(r[0] || "").trim().startsWith("#"));
}

function csvToProducts(allRows: string[][]): ProductRow[] {
  const rows = dataRows(allRows);
  if (rows.length < 2) return [];
  const h = rows[0];
  const iName = headerIndex(h, ["name", "الاسم", "الصنف", "اسم الصنف", "item", "item name", "product or service name", "product name"]);
  const iSku = headerIndex(h, ["sku", "باركود", "الكود", "code", "item code", "barcode"]);
  const iPrice = headerIndex(h, ["price", "unit price", "unitprice", "unit_price", "السعر", "سعر البيع", "sales price", "selling price", "sale price"]);
  const iCost = headerIndex(h, ["cost", "cost price", "costprice", "cost_price", "التكلفة", "purchase price"]);
  const iQty = headerIndex(h, ["qty", "quantity", "الكمية", "الرصيد", "stock qty", "stock_qty", "opening qty", "on hand", "stock"]);
  const iType = headerIndex(h, ["type", "النوع", "item type"]);
  const out: ProductRow[] = [];
  for (const r of rows.slice(1)) {
    const name = (iName >= 0 ? r[iName] : r[0])?.trim();
    if (!name) continue;
    const num = (i: number) => (i >= 0 && r[i] ? Number(String(r[i]).replace(/[^\d.\-]/g, "")) || 0 : 0);
    const rawType = (iType >= 0 ? r[iType] : "")?.trim().toLowerCase() || "";
    out.push({
      name,
      sku: iSku >= 0 ? r[iSku]?.trim() || undefined : undefined,
      unitPrice: num(iPrice),
      costPrice: num(iCost),
      openingQty: num(iQty),
      type: rawType.includes("serv") || rawType.includes("خدمة") ? "SERVICE" : "GOOD",
    });
  }
  return out;
}

function csvToContacts(allRows: string[][]): ContactRow[] {
  const rows = dataRows(allRows);
  if (rows.length < 2) return [];
  const h = rows[0];
  const iName = headerIndex(h, ["name", "الاسم", "العميل", "المورد", "customer name", "vendor name", "contact name", "display name", "customer", "vendor"]);
  const iType = headerIndex(h, ["type", "النوع", "contact type"]);
  const iEmail = headerIndex(h, ["email", "البريد", "البريد الإلكتروني", "e-mail", "email address"]);
  const iPhone = headerIndex(h, ["phone", "جوال", "الجوال", "هاتف", "mobile", "phone number", "telephone"]);
  const iTax = headerIndex(h, ["tax id", "taxid", "tax_id", "vat", "الرقم الضريبي", "vat number", "tax number"]);
  const out: ContactRow[] = [];
  for (const r of rows.slice(1)) {
    const name = (iName >= 0 ? r[iName] : r[0])?.trim();
    if (!name) continue;
    const rawType = (iType >= 0 ? r[iType] : "")?.trim().toLowerCase() || "";
    const type: ContactRow["type"] =
      rawType.includes("supp") || rawType.includes("مورد") ? "SUPPLIER"
      : rawType.includes("both") || rawType.includes("كلاهما") ? "BOTH" : "CUSTOMER";
    out.push({
      name,
      type,
      email: iEmail >= 0 ? r[iEmail]?.trim() || undefined : undefined,
      phone: iPhone >= 0 ? r[iPhone]?.trim() || undefined : undefined,
      taxId: iTax >= 0 ? r[iTax]?.trim() || undefined : undefined,
    });
  }
  return out;
}

const STEPS = [
  { id: 1, icon: Landmark, ar: "الأرصدة الافتتاحية", en: "Opening balances" },
  { id: 2, icon: Package, ar: "الأصناف", en: "Items" },
  { id: 3, icon: Users, ar: "العملاء والموردون", en: "Contacts" },
  { id: 4, icon: PartyPopper, ar: "تم", en: "Done" },
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<{ openingBalancesDone: boolean; productsCount: number; contactsCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.onboarding.status().then(setStatus).catch(() => {});
  }, []);

  const refresh = () => api.onboarding.status().then(setStatus).catch(() => {});

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" dir={isAr ? "rtl" : "ltr"}>
      <div className="text-center mb-8">
        <h1 className="text-foreground mb-2" style={{ fontSize: "26px", fontWeight: 800 }}>
          {t("لننقل بياناتك في دقائق", "Let's move your data in minutes")}
        </h1>
        <p className="text-muted-foreground" style={{ fontSize: "14px", lineHeight: 1.8 }}>
          {t("أرصدة افتتاحية + أصناف + عملاء وموردون من برنامجك السابق — بدون إدخال يدوي", "Opening balances, items, customers and suppliers from your previous software — no manual entry")}
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-3 mb-8">
        {STEPS.map((s, i) => {
          const done = step > s.id || (s.id === 1 && status?.openingBalancesDone) || (s.id === 4 && step === 4);
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-1.5 sm:gap-3">
              {i > 0 && <div className={`w-6 sm:w-10 h-[2px] rounded ${step > s.id - 1 ? "bg-green-500" : "bg-gray-200"}`} />}
              <div className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl border transition-all ${
                active ? "border-primary bg-primary/5 text-primary" : done ? "border-green-500/40 bg-green-50 text-green-700" : "border-gray-200 text-muted-foreground"
              }`} style={{ fontSize: "12px", fontWeight: 600 }}>
                {done && !active ? <CheckCircle2 className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                <span className="hidden sm:inline">{t(s.ar, s.en)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3" role="alert">
          <AlertCircle className="w-4.5 h-4.5 shrink-0" />
          <p style={{ fontSize: "13px" }}>{error}</p>
        </div>
      )}

      {step === 1 && (
        <StepBalances
          alreadyDone={status?.openingBalancesDone ?? false}
          onDone={() => { refresh(); setStep(2); }}
          onSkip={() => setStep(2)}
          setError={setError}
        />
      )}
      {step === 2 && <StepProducts onDone={() => { refresh(); setStep(3); }} onSkip={() => setStep(3)} setError={setError} />}
      {step === 3 && <StepContacts onDone={() => { refresh(); setStep(4); }} onSkip={() => setStep(4)} setError={setError} />}
      {step === 4 && <StepDone status={status} onGo={(to) => navigate(to)} />}

      {step > 1 && step < 4 && (
        <button onClick={() => setStep(step - 1)} className="mt-5 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" style={{ fontSize: "13px" }}>
          {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {t("رجوع", "Back")}
        </button>
      )}
    </div>
  );
}

// ── Step 1 · Opening balances ────────────────────────────────────────────────
function StepBalances({ alreadyDone, onDone, onSkip, setError }: { alreadyDone: boolean; onDone: () => void; onSkip: () => void; setError: (e: string | null) => void }) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const [form, setForm] = useState({ cash: "", bank: "", inventory: "", receivables: "", payables: "" });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // opening-balances.csv (bucket,amount) — fills the form from the master template or a trial-balance export
  const BUCKET_ALIASES: Record<keyof typeof form, string[]> = {
    cash: ["cash", "الصندوق", "نقد", "cash on hand", "cashbox"],
    bank: ["bank", "البنك", "bank account", "bank balance", "البنك الرئيسي"],
    inventory: ["inventory", "المخزون", "stock", "stock value", "قيمة المخزون"],
    receivables: ["receivables", "ذمم العملاء", "accounts receivable", "ar", "عملاء", "customer balances"],
    payables: ["payables", "ذمم الموردين", "accounts payable", "ap", "موردين", "supplier balances"],
  };
  const onCsv = async (f: File) => {
    const rows = dataRows(parseCSV(await f.text()));
    if (rows.length < 2) { setError(t("تعذّر قراءة الملف — تأكد من القالب", "Could not read the file — check the template")); return; }
    const h = rows[0];
    const iBucket = headerIndex(h, ["bucket", "الحساب", "البند", "account", "item"]);
    const iAmount = headerIndex(h, ["amount", "المبلغ", "الرصيد", "balance", "value"]);
    if (iBucket < 0 || iAmount < 0) { setError(t("الملف يحتاج عمودَي bucket و amount", "File needs bucket and amount columns")); return; }
    const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "");
    const next = { ...form };
    let filled = 0;
    for (const r of rows.slice(1)) {
      const bucket = norm(r[iBucket] || "");
      const amt = Number(String(r[iAmount] || "").replace(/[^\d.\-]/g, "")) || 0;
      for (const key of Object.keys(BUCKET_ALIASES) as (keyof typeof form)[]) {
        if (BUCKET_ALIASES[key].some((a) => norm(a) === bucket)) { next[key] = String(amt); filled++; break; }
      }
    }
    if (filled === 0) setError(t("لم تُطابق أي بنود معروفة — راجع القالب", "No known buckets matched — check the template"));
    else { setError(null); setForm(next); }
  };

  const fields: { key: keyof typeof form; ar: string; en: string; hintAr: string; hintEn: string }[] = [
    { key: "cash", ar: "الصندوق (النقد)", en: "Cash on hand", hintAr: "رصيد الكاش الحالي", hintEn: "Current cash balance" },
    { key: "bank", ar: "البنك", en: "Bank", hintAr: "رصيد الحساب البنكي", hintEn: "Bank account balance" },
    { key: "inventory", ar: "المخزون", en: "Inventory", hintAr: "قيمة البضاعة بالتكلفة", hintEn: "Stock value at cost" },
    { key: "receivables", ar: "ذمم العملاء (لنا)", en: "Customer balances (owed to you)", hintAr: "مبالغ مستحقة لك على العملاء", hintEn: "Amounts customers owe you" },
    { key: "payables", ar: "ذمم الموردين (علينا)", en: "Supplier balances (you owe)", hintAr: "مبالغ مستحقة عليك للموردين", hintEn: "Amounts you owe suppliers" },
  ];
  const num = (v: string) => Number(v.replace(/[^\d.\-]/g, "")) || 0;
  const total = num(form.cash) + num(form.bank) + num(form.inventory) + num(form.receivables);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await api.onboarding.openingBalances({
        cash: num(form.cash), bank: num(form.bank), inventory: num(form.inventory),
        receivables: num(form.receivables), payables: num(form.payables),
      });
      onDone();
    } catch (e: any) {
      setError(e instanceof ApiError && isAr && e.messageAr ? e.messageAr : e?.message || t("فشل حفظ الأرصدة", "Failed to save balances"));
    } finally { setBusy(false); }
  };

  if (alreadyDone) {
    return (
      <Card>
        <div className="flex items-center gap-3 text-green-700">
          <CheckCircle2 className="w-5 h-5" />
          <p style={{ fontSize: "14px", fontWeight: 600 }}>{t("الأرصدة الافتتاحية مسجّلة مسبقًا ✓", "Opening balances already posted ✓")}</p>
        </div>
        <NavButtons nextLabel={t("التالي: الأصناف", "Next: items")} onNext={onDone} onSkip={onSkip} hideSkip />
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-foreground mb-1" style={{ fontSize: "17px", fontWeight: 700 }}>{t("الأرصدة الافتتاحية", "Opening balances")}</h2>
      <p className="text-muted-foreground mb-3" style={{ fontSize: "13px", lineHeight: 1.8 }}>
        {t("أدخل أرصدة يوم الانتقال — سننشئ قيدًا واحدًا متوازنًا ونحسب رأس المال المدفوع تلقائيًا (الأصول − الالتزامات).", "Enter your migration-day balances — we create one balanced journal and compute paid-in capital automatically (assets − liabilities).")}
      </p>
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 text-primary px-3.5 py-2 cursor-pointer hover:bg-primary/10 transition-colors"
          style={{ fontSize: "12.5px", fontWeight: 600 }}
        >
          <Upload className="w-3.5 h-3.5" />
          {t("تعبئة من ملف (opening-balances.csv)", "Fill from file (opening-balances.csv)")}
        </button>
        <a
          href="/import-templates/opening-balances.csv" download="ENSIDEX-opening-balances.csv"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
          style={{ fontSize: "12px", fontWeight: 600 }}
        >
          <Download className="w-3.5 h-3.5" />
          {t("تنزيل القالب", "Download template")}
        </a>
        <input ref={fileRef} type="file" className="hidden" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsv(f); e.target.value = ""; }} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3.5">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-foreground mb-1" style={{ fontSize: "13px", fontWeight: 600 }}>{t(f.ar, f.en)}</label>
            <input
              inputMode="decimal" dir="ltr"
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              placeholder="0.00"
              className="w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-muted-foreground/70 mt-0.5" style={{ fontSize: "11px" }}>{t(f.hintAr, f.hintEn)}</p>
          </div>
        ))}
        <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
          <div className="text-muted-foreground" style={{ fontSize: "11px" }}>{t("رأس المال المدفوع (تلقائي)", "Paid-in capital (auto)")}</div>
          <div className="text-primary font-english" style={{ fontSize: "20px", fontWeight: 800 }} dir="ltr">
            {(total - num(form.payables)).toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      <NavButtons
        nextLabel={busy ? t("يُحفظ…", "Saving…") : t("احفظ وتابع", "Save & continue")}
        onNext={submit} onSkip={onSkip} busy={busy}
        skipLabel={t("تخطَّ — أبدأ من الصفر", "Skip — starting fresh")}
      />
    </Card>
  );
}

// ── Step 2 · Items ───────────────────────────────────────────────────────────
function StepProducts({ onDone, onSkip, setError }: { onDone: () => void; onSkip: () => void; setError: (e: string | null) => void }) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [openingStock, setOpeningStock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; stockApplied: number; errors: any[] } | null>(null);

  // Master template lives in /public/import-templates — same file the user fills from Wave/Wafeq exports
  const downloadTemplate = () => {
    const a = document.createElement("a");
    a.href = "/import-templates/products.csv";
    a.download = "ENSIDEX-products.csv";
    a.click();
  };

  const onFile = async (f: File) => {
    const text = await f.text();
    const parsed = csvToProducts(parseCSV(text));
    if (parsed.length === 0) setError(t("تعذّر قراءة الصفوف — تأكد من تنسيق القالب", "Could not read rows — check the template format"));
    else { setError(null); setRows(parsed); setResult(null); }
  };

  const onAiFile = async (f: File) => {
    setAiBusy(true); setError(null);
    try {
      const buf = await f.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const r: any = await api.agent.extractDocument({
        fileBase64: b64, fileName: f.name, mimeType: f.type || "application/octet-stream",
        target: "invoice-lines", hint: "This is a product/price list from our old software — extract every item with its sale price",
      });
      const lines: any[] = r?.lines || [];
      const mapped = lines.filter((l) => l.description).map((l) => ({
        name: String(l.description).slice(0, 180),
        unitPrice: Number(l.unitPrice) || 0,
        type: "GOOD" as const,
      }));
      if (mapped.length === 0) setError(t("لم يُستخرج أي صنف — جرّب ملفًا أوضح أو CSV", "No items extracted — try a clearer file or CSV"));
      else setRows((prev) => [...(prev || []), ...mapped]);
    } catch (e: any) {
      setError(e instanceof ApiError && isAr && e.messageAr ? e.messageAr : e?.message || t("فشل الاستخراج", "Extraction failed"));
    } finally { setAiBusy(false); }
  };

  const doImport = async () => {
    if (!rows?.length) return;
    setBusy(true); setError(null);
    try {
      const r = await api.onboarding.importProducts({ rows, openingStock });
      setResult(r);
      if (r.created > 0) setTimeout(onDone, 1200);
    } catch (e: any) {
      setError(e instanceof ApiError && isAr && e.messageAr ? e.messageAr : e?.message || t("فشل الاستيراد", "Import failed"));
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <h2 className="text-foreground mb-1" style={{ fontSize: "17px", fontWeight: 700 }}>{t("نقل الأصناف", "Import items")}</h2>
      <p className="text-muted-foreground mb-4" style={{ fontSize: "13px", lineHeight: 1.8 }}>
        {t("ارفع CSV من برنامجك السابق (name, sku, price, cost, qty) — أو صورة/ملف قائمة أسعار ويستخرجها الذكاء الاصطناعي.", "Upload a CSV from your old software (name, sku, price, cost, qty) — or a price-list file and let AI extract it.")}
      </p>
      <div className="flex flex-wrap gap-2.5 mb-4">
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl cursor-pointer" style={{ fontSize: "13px", fontWeight: 600 }}>
          <Upload className="w-4 h-4" /> {t("رفع CSV", "Upload CSV")}
        </button>
        <button onClick={downloadTemplate} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-foreground px-4 py-2.5 rounded-xl cursor-pointer" style={{ fontSize: "13px", fontWeight: 600 }}>
          <Download className="w-4 h-4" /> {t("القالب", "Template")}
        </button>
        <label className={`inline-flex items-center gap-2 border border-primary/40 text-primary hover:bg-primary/90/5 px-4 py-2.5 rounded-xl cursor-pointer ${aiBusy ? "opacity-60 pointer-events-none" : ""}`} style={{ fontSize: "13px", fontWeight: 600 }}>
          <Sparkles className="w-4 h-4" /> {aiBusy ? t("يستخرج…", "Extracting…") : t("استخراج AI من ملف", "AI extract from file")}
          <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAiFile(f); e.target.value = ""; }} />
        </label>
        <input ref={fileRef} type="file" className="hidden" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </div>

      {rows && !result && (
        <>
          <PreviewTable
            head={[t("الصنف", "Item"), "SKU", t("السعر", "Price"), t("التكلفة", "Cost"), t("الكمية", "Qty")]}
            rows={rows.slice(0, 8).map((r) => [r.name, r.sku || "—", String(r.unitPrice ?? 0), String(r.costPrice ?? 0), String(r.openingQty ?? 0)])}
            total={rows.length}
          />
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input type="checkbox" checked={openingStock} onChange={(e) => setOpeningStock(e.target.checked)} className="w-4 h-4 rounded accent-[#1276E3]" />
            <span className="text-muted-foreground" style={{ fontSize: "13px" }}>{t("أدخل الكميات كرصيد افتتاحي للمستودع", "Post quantities as opening warehouse stock")}</span>
          </label>
        </>
      )}

      {result && (
        <div className="rounded-xl bg-green-50 border border-green-500/30 px-4 py-3 text-green-700" style={{ fontSize: "13px", lineHeight: 1.8 }}>
          ✓ {t("أُنشئ", "Created")} <b className="font-english">{result.created}</b> · {t("تخطّى (موجود)", "Skipped")} <b className="font-english">{result.skipped}</b> · {t("رصيد مخزون", "Stock posted")} <b className="font-english">{result.stockApplied}</b>
          {result.errors.length > 0 && <span className="text-amber-700 block">{t("أخطاء:", "Errors:")} {result.errors.length}</span>}
        </div>
      )}

      <NavButtons
        nextLabel={busy ? t("يستورد…", "Importing…") : rows?.length ? t(`استورد ${rows.length} صنفًا`, `Import ${rows.length} items`) : t("التالي", "Next")}
        onNext={rows?.length ? doImport : onDone}
        onSkip={onSkip} busy={busy}
        skipLabel={t("تخطَّ — أضيفها لاحقًا", "Skip — add items later")}
      />
    </Card>
  );
}

// ── Step 3 · Contacts ────────────────────────────────────────────────────────
function StepContacts({ onDone, onSkip, setError }: { onDone: () => void; onSkip: () => void; setError: (e: string | null) => void }) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ContactRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: any[] } | null>(null);

  const downloadTemplate = () => {
    const a = document.createElement("a");
    a.href = "/import-templates/contacts.csv";
    a.download = "ENSIDEX-contacts.csv";
    a.click();
  };

  const onFile = async (f: File) => {
    const parsed = csvToContacts(parseCSV(await f.text()));
    if (parsed.length === 0) setError(t("تعذّر قراءة الصفوف — تأكد من القالب", "Could not read rows — check the template"));
    else { setError(null); setRows(parsed); setResult(null); }
  };

  const doImport = async () => {
    if (!rows?.length) return;
    setBusy(true); setError(null);
    try {
      const r = await api.onboarding.importContacts({ rows });
      setResult(r);
      if (r.created > 0) setTimeout(onDone, 1200);
    } catch (e: any) {
      setError(e instanceof ApiError && isAr && e.messageAr ? e.messageAr : e?.message || t("فشل الاستيراد", "Import failed"));
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <h2 className="text-foreground mb-1" style={{ fontSize: "17px", fontWeight: 700 }}>{t("نقل العملاء والموردين", "Import customers & suppliers")}</h2>
      <p className="text-muted-foreground mb-4" style={{ fontSize: "13px", lineHeight: 1.8 }}>
        {t("ارفع CSV (name, type, email, phone, taxId) — type: customer أو supplier أو both.", "Upload a CSV (name, type, email, phone, taxId) — type: customer, supplier or both.")}
      </p>
      <div className="flex flex-wrap gap-2.5 mb-4">
        <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl cursor-pointer" style={{ fontSize: "13px", fontWeight: 600 }}>
          <Upload className="w-4 h-4" /> {t("رفع CSV", "Upload CSV")}
        </button>
        <button onClick={downloadTemplate} className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-foreground px-4 py-2.5 rounded-xl cursor-pointer" style={{ fontSize: "13px", fontWeight: 600 }}>
          <Download className="w-4 h-4" /> {t("القالب", "Template")}
        </button>
        <input ref={fileRef} type="file" className="hidden" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </div>

      {rows && !result && (
        <PreviewTable
          head={[t("الاسم", "Name"), t("النوع", "Type"), t("الجوال", "Phone"), t("الرقم الضريبي", "Tax ID")]}
          rows={rows.slice(0, 8).map((r) => [r.name, r.type || "CUSTOMER", r.phone || "—", r.taxId || "—"])}
          total={rows.length}
        />
      )}

      {result && (
        <div className="rounded-xl bg-green-50 border border-green-500/30 px-4 py-3 text-green-700" style={{ fontSize: "13px", lineHeight: 1.8 }}>
          ✓ {t("أُنشئ", "Created")} <b className="font-english">{result.created}</b> · {t("تخطّى (موجود)", "Skipped")} <b className="font-english">{result.skipped}</b>
          {result.errors.length > 0 && <span className="text-amber-700 block">{t("أخطاء:", "Errors:")} {result.errors.length}</span>}
        </div>
      )}

      <NavButtons
        nextLabel={busy ? t("يستورد…", "Importing…") : rows?.length ? t(`استورد ${rows.length} جهة`, `Import ${rows.length} contacts`) : t("التالي", "Next")}
        onNext={rows?.length ? doImport : onDone}
        onSkip={onSkip} busy={busy}
        skipLabel={t("تخطَّ — أضيفهم لاحقًا", "Skip — add contacts later")}
      />
    </Card>
  );
}

// ── Step 4 · Done ────────────────────────────────────────────────────────────
function StepDone({ status, onGo }: { status: { openingBalancesDone: boolean; productsCount: number; contactsCount: number } | null; onGo: (to: string) => void }) {
  const { t } = useLanguage();
  return (
    <Card>
      <div className="text-center py-4">
        <span className="inline-flex w-16 h-16 rounded-full bg-green-50 items-center justify-center mb-4">
          <PartyPopper className="w-8 h-8 text-green-500" />
        </span>
        <h2 className="text-foreground mb-2" style={{ fontSize: "20px", fontWeight: 800 }}>{t("شركتك جاهزة للعمل 🎉", "Your company is ready 🎉")}</h2>
        <p className="text-muted-foreground mb-5" style={{ fontSize: "14px", lineHeight: 1.8 }}>
          {status?.openingBalancesDone ? t("✓ الأرصدة الافتتاحية مسجّلة", "✓ Opening balances posted") + " · " : ""}
          {t("الأصناف:", "Items:")} <b className="font-english">{status?.productsCount ?? 0}</b> · {t("جهات الاتصال:", "Contacts:")} <b className="font-english">{status?.contactsCount ?? 0}</b>
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button onClick={() => onGo("/app/invoices/new")} className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-3 rounded-xl cursor-pointer" style={{ fontSize: "14px", fontWeight: 700 }}>
            <FileText className="w-4 h-4" /> {t("أنشئ أول فاتورة", "Create your first invoice")}
          </button>
          <button onClick={() => onGo("/app")} className="bg-gray-100 hover:bg-gray-200 text-foreground px-5 py-3 rounded-xl cursor-pointer" style={{ fontSize: "14px", fontWeight: 600 }}>
            {t("لوحة التحكم", "Dashboard")}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-border rounded-2xl shadow-sm p-6 sm:p-7">{children}</div>;
}

function NavButtons({ nextLabel, onNext, onSkip, busy, hideSkip, skipLabel }: {
  nextLabel: string; onNext: () => void; onSkip: () => void; busy?: boolean; hideSkip?: boolean; skipLabel?: string;
}) {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const Arrow = isAr ? ChevronLeft : ChevronRight;
  return (
    <div className="flex items-center gap-2.5 mt-6">
      <button onClick={onNext} disabled={busy} className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-60" style={{ fontSize: "14px", fontWeight: 700 }}>
        {nextLabel} <Arrow className="w-4 h-4" />
      </button>
      {!hideSkip && (
        <button onClick={onSkip} disabled={busy} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" style={{ fontSize: "13px" }}>
          <SkipForward className="w-3.5 h-3.5" /> {skipLabel || t("تخطَّ", "Skip")}
        </button>
      )}
    </div>
  );
}

function PreviewTable({ head, rows, total }: { head: string[]; rows: string[][]; total: number }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border border-border overflow-hidden mb-1">
      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: "12.5px" }}>
          <thead className="bg-gray-50">
            <tr>{head.map((h) => <th key={h} className="text-start px-3 py-2 text-muted-foreground" style={{ fontWeight: 600 }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/60">
                {r.map((c, j) => <td key={j} className="px-3 py-2 text-foreground/90">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > rows.length && (
        <div className="bg-gray-50 px-3 py-1.5 text-muted-foreground border-t border-border/60" style={{ fontSize: "11.5px" }}>
          + {t(`${total - rows.length} صفًا آخر`, `${total - rows.length} more rows`)}
        </div>
      )}
    </div>
  );
}
