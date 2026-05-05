/**
 * BarcodeScanner · UX-76 · مسح باركود من الكاميرا أو إدخال يدوي
 *
 * Uses BarcodeDetector API (Chrome 88+ · Edge · Safari 17+)
 * Fallback: opens manual SKU input if API unavailable.
 *
 * Per طارق · "في شي قبل صف المنتج · إذا في قارئ باركود خليه يتفعل"
 *
 * Usage:
 *   <BarcodeScannerButton onScanned={(code) => findProductBySku(code)} />
 */
import { useState, useRef, useEffect } from "react";
import { Barcode, X, Loader2, Camera } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

interface Props {
  onScanned: (code: string) => void;
  className?: string;
}

export function BarcodeScannerButton({ onScanned, className = "" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="مسح باركود (Cmd+B)"
        className={`rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1276E3] transition-colors ${className}`}
      >
        <Barcode className="h-4 w-4" />
      </button>
      {open && <BarcodeScannerModal onClose={() => setOpen(false)} onScanned={(code) => { onScanned(code); setOpen(false); }} />}
    </>
  );
}

function BarcodeScannerModal({ onClose, onScanned }: { onClose: () => void; onScanned: (code: string) => void }) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const stopFlagRef = useRef(false);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (mode !== "camera") return;
    let cancelled = false;

    async function start() {
      // Check BarcodeDetector support
      const BarcodeDetector = (window as any).BarcodeDetector;
      if (!BarcodeDetector) {
        setError("متصفحك لا يدعم قارئ الباركود · جرب Chrome أو Edge أو استخدم الإدخال اليدوي");
        return;
      }
      try {
        detectorRef.current = new BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code", "upc_a", "upc_e"],
        });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScanning(true);
        scanLoop();
      } catch (e: any) {
        setError(e?.message || "تعذّر تشغيل الكاميرا");
      }
    }

    async function scanLoop() {
      if (stopFlagRef.current || !videoRef.current || !detectorRef.current) return;
      try {
        const results = await detectorRef.current.detect(videoRef.current);
        if (results && results.length > 0) {
          const code = results[0].rawValue;
          if (code) {
            stopFlagRef.current = true;
            stopCamera();
            onScanned(code);
            return;
          }
        }
      } catch (e) { /* ignore frame errors */ }
      requestAnimationFrame(scanLoop);
    }

    function stopCamera() {
      stopFlagRef.current = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setScanning(false);
    }

    start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [mode, onScanned]);

  const submitManual = () => {
    if (!manualCode.trim()) {
      setError("أدخل الباركود");
      return;
    }
    onScanned(manualCode.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-[#0B1B49]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#F3F4F6]">
          <div>
            <h2 className="text-[#0B1B49]" style={{ fontSize: "1rem", fontWeight: 700 }}>
              <Barcode className="inline h-4 w-4 me-2" /> مسح باركود
            </h2>
            <p className="text-xs text-[#6B7280] mt-1">امسح باركود المنتج لتعبئة البند تلقائياً</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-[#F3F4F6] bg-[#F9FAFB]">
          <button
            onClick={() => setMode("camera")}
            className={`flex-1 px-4 py-2 text-sm flex items-center justify-center gap-2 transition-colors ${
              mode === "camera" ? "bg-white text-[#1276E3] border-b-2 border-[#1276E3]" : "text-[#6B7280]"
            }`}
          >
            <Camera className="h-3.5 w-3.5" /> الكاميرا
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 px-4 py-2 text-sm flex items-center justify-center gap-2 transition-colors ${
              mode === "manual" ? "bg-white text-[#1276E3] border-b-2 border-[#1276E3]" : "text-[#6B7280]"
            }`}
          >
            <Barcode className="h-3.5 w-3.5" /> إدخال يدوي
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
              {error}
            </div>
          )}

          {mode === "camera" ? (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-square">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Scanning frame overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-1/3 border-2 border-[#1276E3] rounded-lg shadow-lg" />
              </div>
              {scanning && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" /> جارٍ المسح...
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs text-[#374151]">الباركود / SKU</label>
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="ابحث بـSKU أو الباركود"
                  dir="ltr"
                  className="border-[#E5E7EB] font-english"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitManual();
                  }}
                  autoFocus
                />
              </div>
              <Button onClick={submitManual} className="w-full bg-[#1276E3] hover:bg-[#0B5FBF]">
                بحث وتعبئة
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
