/**
 * ImageCropperModal · lightweight avatar/logo cropper (no external cropper dep)
 *
 * Uses the existing shadcn Dialog + Slider wrappers + a canvas to let the user
 * zoom and reposition an image inside a square viewport, then crops the visible
 * region to a 256×256 PNG data URL. Reused for contact logos (UX-201).
 *
 * Props:
 *   file    — the source File to crop
 *   onCrop  — called with the cropped data URL (image/png) when the user saves
 *   onClose — called when the modal is dismissed
 *   size    — output square side in px (default 256)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Slider } from "./ui/slider";
import { Button } from "./ui/button";
import { Loader2, ZoomIn } from "lucide-react";

interface Props {
  file: File;
  onCrop: (dataUrl: string) => void;
  onClose: () => void;
  size?: number;
}

const VIEWPORT = 240; // square viewport px

export function ImageCropperModal({ file, onCrop, onClose, size = 256 }: Props) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0,
  });
  const viewportRef = useRef<HTMLDivElement>(null);

  // Load the image into memory once.
  useEffect(() => {
    setLoading(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Fit the image so the shorter side fills the viewport (start zoomed to cover).
      const initialZoom = Math.max(VIEWPORT / img.width, VIEWPORT / img.height);
      setZoom(initialZoom);
      setOffset({ x: 0, y: 0 });
      setLoading(false);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setLoading(false);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [file]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offset]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    setOffset({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
    });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current.dragging = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  }, []);

  // Crop the visible viewport region → square PNG data URL.
  const handleSave = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // White background (for transparent PNGs/SVGs)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    // The drawn image is zoomed; offset is in viewport px. Map viewport→source px.
    const scale = zoom / size * VIEWPORT; // source px per viewport px → but we draw at `size`
    // Actually: drawnW = img.width * zoom; drawnH = img.height * zoom.
    // The viewport shows a VIEWPORT×VIEWPORT window of the drawn image at (offset).
    // We want to copy that window scaled up to `size`×`size`.
    const drawnW = img.width * zoom;
    const drawnH = img.height * zoom;
    // Source region (in drawn-image px) = the viewport window.
    const srcW = VIEWPORT * (drawnW / VIEWPORT); // = drawnW when viewport == drawn size... keep it simple:
    // We draw the whole image to a canvas of size (drawnW × drawnH) at offset, then sample.
    // Simpler correct approach: draw the image so the viewport window maps to the output.
    const outScale = size / VIEWPORT;
    ctx.drawImage(
      img,
      // sx, sy, sw, sh — source region in natural image px that corresponds to the viewport:
      -offset.x / zoom,
      -offset.y / zoom,
      VIEWPORT / zoom,
      VIEWPORT / zoom,
      // dx, dy, dw, dh — destination:
      0, 0, size, size,
    );
    void scale; void srcW; void drawnW; void drawnH; void outScale; // (kept for clarity; drawImage above is the source of truth)
    const dataUrl = canvas.toDataURL("image/png");
    onCrop(dataUrl);
    setOpen(false);
  }, [zoom, offset, size, onCrop]);

  const handleCancel = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ZoomIn className="h-4 w-4" /> قص الشعار
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center" style={{ width: VIEWPORT, height: VIEWPORT }}>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div
              ref={viewportRef}
              className="relative overflow-hidden rounded-lg border border-border bg-muted"
              style={{ width: VIEWPORT, height: VIEWPORT, touchAction: "none", cursor: "grab" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                src={URL.createObjectURL(file)}
                alt="crop preview"
                className="select-none"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: imgRef.current ? `${imgRef.current.width * zoom}px` : "auto",
                  height: imgRef.current ? `${imgRef.current.height * zoom}px` : "auto",
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  pointerEvents: "none",
                }}
                draggable={false}
              />
              {/* Square crop overlay */}
              <div className="absolute inset-0 pointer-events-none border-2 border-white/80 rounded-lg shadow-inner" />
            </div>
          )}

          <div className="w-full flex items-center gap-3 px-2">
            <span className="text-xs text-muted-foreground shrink-0">تكبير</span>
            <Slider
              value={[zoom * 100]}
              min={50}
              max={300}
              step={1}
              onValueChange={(v) => setZoom((v[0] || 50) / 100)}
              className="flex-1"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} className="border-border">إلغاء</Button>
          <Button onClick={handleSave} disabled={loading || !imgRef.current} className="bg-primary hover:bg-primary/90 text-white">
            حفظ الشعار
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
