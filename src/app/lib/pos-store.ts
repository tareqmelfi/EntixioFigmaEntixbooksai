/**
 * POS v2 · device store + offline sync engine (CEO 2026-08-25)
 *
 * «ما تتأثر بانقطاع النت» — the cashier never waits for the network:
 *   1. Every sale is written to the local queue FIRST (localStorage · per company).
 *   2. If online and sync mode is «instant», it is uploaded right away.
 *   3. Otherwise it is uploaded later — automatically when the connection returns,
 *      every 45 s while items are pending, or manually («رفع الآن») for shops that
 *      prefer a daily/weekly upload.
 *
 * Accounting truth (accountant requirement): each sale carries `occurredAt` = the
 * device time when the customer paid. The API books the invoice / payment /
 * stock movement on THAT time, not the upload time. `clientSaleId` makes every
 * upload idempotent — a retried upload can never create a second invoice.
 *
 * Reprint: synced sales stay on the device for 7 days (max 300) so a receipt can
 * be reprinted with its final invoice number.
 */
import { api, getOrgId } from "./api";

export type PosProduct = {
  id: string; sku: string | null; name: string; nameAr: string | null; imageUrl: string | null;
  type: string; unitPrice: string; stockQty: string; category: string | null;
  taxRate: { rate: string; type: string } | null;
  /** B3.2 · alias scan codes (carton = 12 units …) */
  barcodes?: Array<{ barcode: string; unitMultiplier: string | number; label: string | null }>;
};
export type PosStore = {
  name: string | null; legalName: string | null; vatNumber: string | null; crNumber: string | null; phone: string | null;
  addressLine: string | null; city: string | null; country: string | null; baseCurrency: string | null;
  logoUrl: string | null; printLogoUrl: string | null;
};
export type PosBranch = { id: string; name: string; code: string | null; warehouseId?: string | null };
export type PosCashier = { id: string; name: string; hasPin: boolean; pinHash: string | null };
export type PosCatalog = { items: PosProduct[]; orgVatRate: number; store: PosStore | null; branches: PosBranch[]; cashiers?: PosCashier[]; fetchedAt: string };

export type PaymentMethod = "CASH" | "CARD" | "MADA";
export type QueuedLine = { productId: string; qty: number; unitPrice: number; name: string; nameAr: string | null; sku: string | null; taxRate: number };
export type QueuedSale = {
  clientSaleId: string;
  occurredAt: string;          // device time · accounting date
  provisionalNumber: string;   // printed while offline · e.g. OFF-K7Q2-0031
  lines: QueuedLine[];
  paymentMethod: PaymentMethod;
  amountTendered: number;
  shiftId: string | null;
  branchId: string | null;
  customerId: string | null;
  customerName: string | null;
  cashierName: string | null;
  totals: { net: number; vat: number; grand: number; change: number };
  status: "pending" | "synced" | "failed";
  attempts: number;
  lastError: string | null;
  invoiceNumber: string | null;
  invoiceId: string | null;
  syncedAt: string | null;
};
export type PosSettings = {
  paper: "58" | "80";
  autoPrint: boolean;
  syncMode: "instant" | "manual";
  branchId: string | null;
  cashierName: string;
  footerText: string;
  showLogo: boolean;
  soundOn: boolean;
  tileSize: "compact" | "comfortable";
};
export type Hold = { id: string; at: string; lines: Array<{ productId: string; qty: number }>; note?: string };

const DEFAULT_SETTINGS: PosSettings = {
  paper: "80", autoPrint: true, syncMode: "instant", branchId: null, cashierName: "",
  footerText: "", showLogo: true, soundOn: true, tileSize: "comfortable",
};

const org = () => getOrgId() || localStorage.getItem("entix_org_id") || "x";
const K = (name: string) => `entix_pos_v2_${org()}_${name}`;
const KEEP_SYNCED_DAYS = 7;
const MAX_KEPT = 300;

function read<T>(name: string, fallback: T): T {
  try { const raw = localStorage.getItem(K(name)); return raw ? { ...(fallback as any), ...JSON.parse(raw) } as T : fallback; } catch { return fallback; }
}
function readArr<T>(name: string): T[] {
  try { const raw = localStorage.getItem(K(name)); const v = raw ? JSON.parse(raw) : []; return Array.isArray(v) ? v : []; } catch { return []; }
}
function write(name: string, v: unknown) { try { localStorage.setItem(K(name), JSON.stringify(v)); } catch { /* quota */ } }

// ── device identity ────────────────────────────────────────────────────────
export function deviceId(): string {
  try {
    let id = localStorage.getItem("entix_pos_device_id");
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(3))).map((b) => b.toString(36).toUpperCase().padStart(2, "0")).join("").slice(0, 4);
      localStorage.setItem("entix_pos_device_id", id);
    }
    return id;
  } catch { return "DEV"; }
}
export function uuid(): string {
  try { return crypto.randomUUID(); } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); });
  }
}
export function nextProvisionalNumber(): string {
  const seq = (Number(localStorage.getItem(K("seq")) || 0) + 1);
  localStorage.setItem(K("seq"), String(seq));
  return `OFF-${deviceId()}-${String(seq).padStart(4, "0")}`;
}

// ── settings ───────────────────────────────────────────────────────────────
export function loadSettings(): PosSettings { return read<PosSettings>("settings", DEFAULT_SETTINGS); }
export function saveSettings(s: PosSettings) { write("settings", s); }

// ── catalog cache (so the POS opens with no network) ───────────────────────
export function loadCatalogCache(): PosCatalog | null {
  try { const raw = localStorage.getItem(K("catalog")); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export async function refreshCatalog(): Promise<PosCatalog> {
  const r: any = await api.posCatalog();
  const cat: PosCatalog = { items: r.items || [], orgVatRate: typeof r.orgVatRate === "number" ? r.orgVatRate : 0.15, store: r.store ?? null, branches: r.branches ?? [], cashiers: (r as any).cashiers ?? [], fetchedAt: new Date().toISOString() };
  write("catalog", cat);
  return cat;
}

// ── holds ──────────────────────────────────────────────────────────────────
export function loadHolds(): Hold[] { return readArr<Hold>("holds"); }
export function saveHolds(h: Hold[]) { write("holds", h); }

// ── shift cache (last known open shift · lets offline sales carry the shift id) ──
export function loadShiftCache(): { id: string; openedAt: string; openingFloat: string } | null {
  try { const raw = localStorage.getItem(K("shift")); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function saveShiftCache(s: { id: string; openedAt: string; openingFloat: string } | null) {
  if (s) write("shift", s); else try { localStorage.removeItem(K("shift")); } catch { /* ignore */ }
}

// ── queue ──────────────────────────────────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();
function emit() { listeners.forEach((l) => { try { l(); } catch { /* ignore */ } }); }
export function subscribeQueue(l: Listener): () => void { listeners.add(l); return () => listeners.delete(l); }

export function loadQueue(): QueuedSale[] { return readArr<QueuedSale>("queue"); }
function persistQueue(q: QueuedSale[]) {
  // prune old synced sales
  const cutoff = Date.now() - KEEP_SYNCED_DAYS * 86_400_000;
  let kept = q.filter((s) => s.status !== "synced" || new Date(s.syncedAt || s.occurredAt).getTime() > cutoff);
  if (kept.length > MAX_KEPT) {
    const pending = kept.filter((s) => s.status !== "synced");
    const synced = kept.filter((s) => s.status === "synced").slice(-Math.max(0, MAX_KEPT - pending.length));
    kept = [...pending, ...synced].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
  write("queue", kept);
  emit();
}
export function enqueueSale(sale: QueuedSale) { const q = loadQueue(); q.push(sale); persistQueue(q); }
export function pendingCount(): number { return loadQueue().filter((s) => s.status !== "synced").length; }
export function updateSale(clientSaleId: string, patch: Partial<QueuedSale>) {
  const q = loadQueue(); const i = q.findIndex((s) => s.clientSaleId === clientSaleId);
  if (i >= 0) { q[i] = { ...q[i], ...patch }; persistQueue(q); }
}
export function removeSale(clientSaleId: string) { persistQueue(loadQueue().filter((s) => s.clientSaleId !== clientSaleId)); }

// ── sync engine ────────────────────────────────────────────────────────────
let syncing = false;
export function isSyncing() { return syncing; }

export type SyncOutcome = { sent: number; created: number; duplicate: number; failed: number; error?: string };

/** Upload every pending sale (≤100 per call · loops until the queue is drained or an error stops it). */
export async function syncPending(opts: { force?: boolean } = {}): Promise<SyncOutcome> {
  const out: SyncOutcome = { sent: 0, created: 0, duplicate: 0, failed: 0 };
  if (syncing) return out;
  if (!navigator.onLine && !opts.force) return out;
  syncing = true; emit();
  try {
    for (let round = 0; round < 10; round++) {
      const batch = loadQueue().filter((s) => s.status !== "synced").slice(0, 100);
      if (!batch.length) break;
      const body = {
        deviceId: deviceId(),
        sales: batch.map((s) => ({
          clientSaleId: s.clientSaleId,
          occurredAt: s.occurredAt,
          lines: s.lines.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice })),
          paymentMethod: s.paymentMethod,
          amountTendered: s.amountTendered,
          shiftId: s.shiftId,
          branchId: s.branchId,
          customerId: s.customerId,
          cashierName: s.cashierName || undefined,
          provisionalNumber: s.provisionalNumber,
        })),
      };
      let res: any;
      try {
        res = await api.posSync(body);
      } catch (e: any) {
        // network / auth failure → keep everything pending, report once
        out.error = e?.message || "sync_failed";
        const now = new Date().toISOString();
        for (const s of batch) updateSale(s.clientSaleId, { attempts: s.attempts + 1, lastError: out.error, status: "pending" });
        void now;
        break;
      }
      out.sent += batch.length;
      for (const r of res.results || []) {
        if (!r.clientSaleId) continue;
        if (r.status === "created" || r.status === "duplicate") {
          if (r.status === "created") out.created++; else out.duplicate++;
          updateSale(r.clientSaleId, { status: "synced", invoiceNumber: r.invoice?.number ?? null, invoiceId: r.invoice?.id ?? null, syncedAt: new Date().toISOString(), lastError: null });
        } else {
          out.failed++;
          const cur = loadQueue().find((s) => s.clientSaleId === r.clientSaleId);
          updateSale(r.clientSaleId, { status: "failed", attempts: (cur?.attempts ?? 0) + 1, lastError: r.error || "failed" });
        }
      }
      if (batch.length < 100) break;
    }
  } finally {
    syncing = false; emit();
  }
  return out;
}

/** Background scheduler · call once from the POS page; returns a disposer. */
export function startAutoSync(getMode: () => "instant" | "manual"): () => void {
  const tick = () => { if (getMode() === "instant" && navigator.onLine && pendingCount() > 0) void syncPending(); };
  const onOnline = () => setTimeout(tick, 800);
  window.addEventListener("online", onOnline);
  const timer = window.setInterval(tick, 45_000);
  setTimeout(tick, 1500);
  return () => { window.removeEventListener("online", onOnline); window.clearInterval(timer); };
}

// ── money ──────────────────────────────────────────────────────────────────
export const money = (n: number) => (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function lineTotals(lines: QueuedLine[]) {
  let net = 0, vat = 0;
  for (const l of lines) {
    const gross = l.unitPrice * l.qty;
    const n = l.taxRate > 0 ? gross / (1 + l.taxRate) : gross;
    net += n; vat += gross - n;
  }
  return { net, vat, grand: net + vat };
}
