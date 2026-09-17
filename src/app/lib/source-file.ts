export type SourceFile = { name: string; contentType: string; base64: string };
export const SOURCE_FILE_LIMIT = 10 * 1024 * 1024;
export async function readSourceFile(file: File): Promise<SourceFile> {
  if (!file.size || file.size > SOURCE_FILE_LIMIT) throw new Error("اختر ملفًا غير فارغ لا يتجاوز 10MB / Choose a non-empty file up to 10MB");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة الملف / Could not read file"));
    reader.onload = () => resolve({ name:file.name, contentType:file.type || "application/octet-stream", base64:String(reader.result).split(",")[1] });
    reader.readAsDataURL(file);
  });
}
