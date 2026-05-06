/**
 * CameraCapture · UX-57 · mobile-first receipt scanner
 *
 * Uses <input type="file" accept="image/*" capture="environment"> which on
 * mobile devices opens the native camera. On desktop it falls back to a file
 * picker. Returns the captured image as a Blob via onCapture(blob).
 *
 * Companion: route the blob to /api/ocr for AI extraction (UX-22).
 *
 * Usage:
 *   <CameraCapture onCapture={(blob) => uploadOcr(blob)} label="تصوير الإيصال" />
 */
import { useRef } from "react";
import { Camera, Upload } from "lucide-react";

interface Props {
  onCapture: (blob: Blob) => void | Promise<void>;
  label?: string;
  className?: string;
  disabled?: boolean;
  /** "environment" (rear camera, default for receipts) or "user" (selfie) */
  facingMode?: "environment" | "user";
}

export function CameraCapture({
  onCapture,
  label = "تصوير إيصال",
  className = "",
  disabled,
  facingMode = "environment",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onCapture(file);
    // Reset so re-selecting the same file fires onChange again
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={facingMode}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={`bg-[#1276E3] hover:bg-[#0B5FBF] disabled:opacity-60 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors ${className}`}
        style={{ fontSize: "14px", fontWeight: 600 }}
      >
        <Camera className="h-4 w-4" />
        {label}
      </button>
    </>
  );
}

/**
 * UploadButton · paired sibling for choosing an existing file (gallery / drive).
 */
export function UploadButton({
  onCapture,
  label = "اختيار صورة",
  className = "",
  accept = "image/*,application/pdf",
  multiple = false,
}: {
  onCapture: (files: FileList) => void | Promise<void>;
  label?: string;
  className?: string;
  accept?: string;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onCapture(e.target.files);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`bg-white border border-[#E5E7EB] hover:border-[#1276E3] hover:bg-[#F9FAFB] text-[#0B1B49] px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors ${className}`}
        style={{ fontSize: "14px", fontWeight: 600 }}
      >
        <Upload className="h-4 w-4" />
        {label}
      </button>
    </>
  );
}
