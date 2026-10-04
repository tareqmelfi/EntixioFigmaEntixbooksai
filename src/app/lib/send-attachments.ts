import { api, getOrgId, type DocumentSendEntityType } from './api';
import { loadDocumentPdfFrame, loadReceiptPdfFrame, prepareDocumentPdf } from './document-pdf';

export type EmailFile = { filename:string; content:string };
export const EMAIL_ATTACHMENT_LIMIT = 20 * 1024 * 1024;
export async function emailFile(blob:Blob, filename:string): Promise<EmailFile> {
  if (blob.size > EMAIL_ATTACHMENT_LIMIT) throw Error('email_attachments_too_large');
  const data = await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]); reader.onerror=()=>reject(Error('attachment_read_failed'));reader.readAsDataURL(blob);
  });
  return {filename,content:data};
}
export async function prepareSendPdf(entityType:DocumentSendEntityType, entityId:string, documentNumber:string, includeReceipts:boolean) {
  const orgId=getOrgId();
  if (!orgId || entityType === 'creditNote') throw Error('document_not_ready');
  const doc=entityType === 'invoice' ? await api.invoices.get(entityId) : await api.quotes.get(entityId);
  const org=await api.orgs.get(orgId);
  const language=(doc as {language?:string}).language || org.defaultInvoiceLanguage || (org.country === 'SA' ? 'ar' : 'en');
  const frames:Awaited<ReturnType<typeof loadDocumentPdfFrame>>[]=[];
  try {
    frames.push(await loadDocumentPdfFrame(entityType === 'invoice' ? 'invoice' : 'proposal',entityId,orgId,language));
    if (includeReceipts && entityType === 'invoice') {
      for (const receipt of (doc as {receipts?:{id:string}[]}).receipts || []) frames.push(await loadReceiptPdfFrame(receipt.id,orgId,language));
    }
    if (getOrgId() !== orgId) throw Error('organization_changed');
    const pdf=await prepareDocumentPdf(frames[0].root,frames[0].selector,documentNumber+(includeReceipts ? '-with-receipts' : ''),frames.slice(1));
    return {...await emailFile(pdf.blob,pdf.filename),sizeBytes:pdf.blob.size};
  } finally { frames.forEach(frame=>frame.dispose()); }
}
