import { displayName } from './display-name';
import { api, getOrgId, type Account, type JournalEntryInput, type JournalEntryRow, type Org, type ReportPayload } from './api';

export const journalHeaders = ['EntryKey', 'Date', 'Description', 'Reference', 'AccountCode', 'Debit', 'Credit', 'LineDescription', 'Status', 'Source', 'EntryId', 'OrganizationId', 'BranchId', 'ProjectId', 'CostCenterId', 'LineProjectId'];
export function assertJournalScope(orgId: string) { if (getOrgId() !== orgId) throw new Error('Company changed. Reopen journal transfer. / تغيّرت الشركة؛ أعد فتح نقل القيود.'); }

export async function loadAllJournals(orgId: string, status?: 'POSTED' | 'DRAFT') {
  const entries = new Map<string, JournalEntryRow>();
  let offset = 0, expected: number | undefined;
  while (true) {
    assertJournalScope(orgId);
    const page = await api.journals.list(status, { limit: 500, offset });
    assertJournalScope(orgId);
    if (expected !== undefined && expected !== page.total) throw new Error('Journal list changed; retry. / تغيّر سجل القيود؛ أعد المحاولة.');
    expected = page.total;
    for (const entry of page.items) {
      if (entries.has(entry.id)) throw new Error('Journal list changed; retry. / تغيّر سجل القيود؛ أعد المحاولة.');
      entries.set(entry.id, entry);
    }
    offset += page.items.length;
    if (!page.hasMore) break;
    if (!page.items.length) throw new Error('Incomplete journal export / تصدير غير مكتمل');
  }
  if (entries.size !== expected) throw new Error('Incomplete journal export / تصدير غير مكتمل');
  return [...entries.values()];
}

export function journalMatrix(entries: JournalEntryRow[], orgId: string) {
  return [journalHeaders, ...entries.flatMap(e => e.lines.map(l => [e.number, e.date.slice(0, 10), e.description, e.reference || '', l.accountCode || '', l.debit, l.credit, l.description || '', e.status, e.source || '', e.id, orgId, e.branchId || '', e.projectId || '', l.costCenterId || '', l.projectId || '']))];
}
export function saveJournalFile(bytes: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function downloadJournals(matrix: (string | number)[][], format: 'xlsx' | 'csv', filename: string, orgId: string) {
  if (format === 'csv') {
    // Spreadsheet applications must not execute descriptions as formulas.
    const csv = matrix.map(row => row.map(v => `"${(typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : String(v)).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    assertJournalScope(orgId); saveJournalFile('\uFEFF' + csv, filename + '.csv', 'text/csv;charset=utf-8'); return;
  }
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet('Journal lines');
  sheet.addRows(matrix); sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D204E' } };
  sheet.columns.forEach((column, i) => { column.width = i === 2 || i === 7 ? 48 : 22; });
  sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = { from: 'A1', to: 'P1' };
  const buffer = await book.xlsx.writeBuffer(); assertJournalScope(orgId);
  saveJournalFile(buffer as BlobPart, filename + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export function parseJournalCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(value); value = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = ''; }
    else value += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote / اقتباس غير مغلق في الملف');
  row.push(value); if (row.some(Boolean)) rows.push(row); return rows;
}
export async function readJournalFile(file: File): Promise<string[][]> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Maximum 10 MB / الحد الأقصى 10 ميجابايت');
  if (/\.csv$/i.test(file.name)) return parseJournalCsv(await file.text());
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Use XLSX or CSV / استخدم XLSX أو CSV');
  const { default: ExcelJS } = await import('exceljs'); const book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  const sheet = book.getWorksheet('Journal lines') || book.worksheets[0];
  if (!sheet) throw new Error('Empty workbook / الملف فارغ');
  const rows: string[][] = [];
  sheet.eachRow(row => {
    const values: string[] = [];
    for (let i = 1; i <= Math.max(sheet.columnCount, journalHeaders.length); i++) {
      const cell = row.getCell(i);
      if (cell.formula || cell.type === ExcelJS.ValueType.Error) throw new Error('Use values, not formulas / استبدل المعادلات بقيم');
      values.push(cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text);
    }
    rows.push(values);
  }); return rows;
}

export type JournalImport = { key: string; data: JournalEntryInput; existingId?: string; error?: string; saved?: string };
export function validateJournalImport(matrix: string[][], accounts: Account[], orgId: string): JournalImport[] {
  if (matrix.length < 2 || matrix.length > 10001) throw new Error('Use 1–10,000 lines / استخدم من سطر إلى 10,000 سطر');
  const headers = matrix[0].map(v => v.trim());
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new Error('Duplicate columns / أعمدة مكررة');
  for (const key of journalHeaders.slice(0, 7)) if (!headers.includes(key)) throw new Error(`Missing column / عمود مفقود: ${key}`);
  const groups = new Map<string, JournalImport>();
  for (const [index, row] of matrix.slice(1).entries()) {
    const get = (key: string) => (row[headers.indexOf(key)] || '').trim();
    const key = get('EntryKey');
    if (!key || key.length > 200) throw new Error(`Row ${index + 2}: EntryKey required (max 200) / رمز القيد مطلوب`);
    const date = get('Date'), description = get('Description');
    const group = groups.get(key) || { key, data: { date, description, reference: get('Reference'), importKey: key, postOnSave: false, branchId: get('BranchId') || null, projectId: get('ProjectId') || null, lines: [] }, existingId: get('EntryId') || undefined };
    groups.set(key, group);
    const fail = (error: string) => { group.error ||= `Row ${index + 2}: ${error}`; };
    const parsedDate = new Date(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) fail('Invalid date / تاريخ غير صالح');
    if (!description) fail('Description required / الوصف مطلوب');
    if (get('OrganizationId') && get('OrganizationId') !== orgId) fail('Different company / شركة مختلفة');
    if (date !== group.data.date || description !== group.data.description || get('Reference') !== group.data.reference || (get('BranchId') || null) !== group.data.branchId || (get('ProjectId') || null) !== group.data.projectId || (get('EntryId') || undefined) !== group.existingId) fail('Inconsistent entry fields / بيانات القيد غير متطابقة');
    const account = accounts.find(a => a.code === get('AccountCode'));
    if (!account || !account.isActive || account.allowPosting === false) fail('Unknown or inactive posting account / حساب غير صالح للترحيل');
    const amount = (key: string) => { const v = get(key) || '0'; if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) > 1e9) fail('Use non-negative amounts, up to 2 decimals / مبلغ غير صالح'); return Number(v); };
    const debit = amount('Debit'), credit = amount('Credit');
    if ((debit > 0) === (credit > 0)) fail('Exactly one debit or credit per line / مدين أو دائن لكل سطر');
    group.data.lines.push({ accountId: account?.id || '', debit, credit, description: get('LineDescription'), costCenterId: get('CostCenterId') || null, projectId: get('LineProjectId') || null });
  }
  for (const group of groups.values()) {
    if (group.data.lines.length < 2 || group.data.lines.reduce((s, l) => s + Math.round((l.debit || 0) * 100) - Math.round((l.credit || 0) * 100), 0) !== 0) group.error ||= 'Unbalanced entry / القيد غير متوازن';
  }
  return [...groups.values()];
}

export function journalReport(entries: JournalEntryRow[], org: Org, language: string, accounts: Account[] = []): ReportPayload {
  const name = (id: string, fallback?: string) => { const account = accounts.find(a => a.id === id); return account ? displayName(account, language) : fallback || id; };
  const ar = language === 'ar'; const dates = entries.map(e => e.date.slice(0, 10)).sort();
  return { id: 'journal-entries', title: 'سجل القيود اليومية', englishTitle: 'Journal entries', description: '', category: 'ledger', status: entries.length ? 'live' : 'empty', generatedAt: new Date().toISOString(), org, currency: org.baseCurrency || 'USD', period: { from: dates[0] || null, to: dates[dates.length - 1] || new Date().toISOString().slice(0, 10) }, summary: {},
    notices: [ar ? 'تظهر حالة كل قيد بجانبه. المسودات غير مرحّلة.' : 'Each entry shows its status. Drafts are not posted.'],
    sections: entries.map(e => ({ id: e.id, title: `${e.number} · ${e.date.slice(0, 10)} · ${e.status === 'POSTED' ? (ar ? 'مرحّل' : 'Posted') : (ar ? 'مسودة' : 'Draft')}`, description: `${e.description}${e.reference ? ` · ${e.reference}` : ''}`, columns: [{ key: 'label', label: ar ? 'الحساب' : 'Account' }, { key: 'description', label: ar ? 'الشرح' : 'Description' }, { key: 'debit', label: ar ? 'مدين' : 'Debit', kind: 'money' }, { key: 'credit', label: ar ? 'دائن' : 'Credit', kind: 'money' }], rows: e.lines.map((l, i) => ({ id: `${e.id}-${i}`, label: `${l.accountCode || l.accountId} · ${name(l.accountId, l.accountName)}`, values: { label: `${l.accountCode || l.accountId} · ${name(l.accountId, l.accountName)}`, description: l.description || '', debit: l.debit, credit: l.credit }, link: { label: e.number, href: `/app/journal-entries?entryId=${encodeURIComponent(e.id)}`, type: 'journal' } })) })) };
}
