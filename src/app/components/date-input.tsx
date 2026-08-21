/**
 * DateInput · typable/pastable date field (Xero-style fast entry)
 *
 * Product requirement: copy "10/01/2026" from any invoice and paste it straight
 * into a date field — no hunting through the calendar picker. Applies to every
 * date input in the app (invoices · quotes · bills · expenses …).
 *
 * Behavior:
 *  - Text field displays dd/mm/yyyy (Arabic-locale convention) and accepts
 *    typing/pasting: 10/01/2026 · 10-01-2026 · 10.01.26 · 2026-01-10 · 10012026
 *  - Parses on change + normalizes on blur; invalid input keeps the text and
 *    shows a subtle error ring (value is NOT committed until valid)
 *  - Calendar button opens the native picker (hidden input type="date")
 *  - External value stays ISO `yyyy-mm-dd` (what the API expects)
 */
import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { useLanguage } from "./LanguageContext";

function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function parseDisplay(text: string): string | null {
  const t = (text || "").trim();
  if (!t) return null;
  let m: RegExpExecArray | null;
  // yyyy-mm-dd (ISO passthrough)
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  // dd/mm/yyyy · dd-mm-yyyy · dd.mm.yy(YY)
  if ((m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(t))) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = (Number(y) > 50 ? "19" : "20") + y;
    if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return "";
    return `${y}-${mo}-${d}`;
  }
  // ddmmyyyy (8 digits)
  if ((m = /^(\d{2})(\d{2})(\d{4})$/.exec(t))) {
    if (Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[1]) < 1 || Number(m[1]) > 31) return "";
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return "";
}

interface Props {
  value: string;                    // ISO yyyy-mm-dd (or "")
  onChange: (iso: string) => void;  // committed only when parseable (or cleared)
  className?: string;               // wrapper div
  inputClassName?: string;          // the text input itself (sizing overrides)
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export function DateInput({ value, onChange, className = "", inputClassName = "", placeholder, disabled, required, id }: Props) {
  const { t } = useLanguage();
  const resolvedPlaceholder = placeholder ?? t("يوم/شهر/سنة", "day/month/year");
  const [text, setText] = useState(isoToDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  // External value changes (form reset · invoice load) → resync display
  useEffect(() => {
    setText(isoToDisplay(value));
    setInvalid(false);
  }, [value]);

  const commit = (raw: string) => {
    setText(raw);
    if (!raw.trim()) {
      setInvalid(false);
      onChange("");
      return;
    }
    const iso = parseDisplay(raw);
    if (iso) {
      setInvalid(false);
      onChange(iso);
    } else {
      setInvalid(true); // keep typing · don't commit
    }
  };

  const onBlur = () => {
    if (!text.trim()) return;
    const iso = parseDisplay(text);
    if (iso) {
      setText(isoToDisplay(iso));
      setInvalid(false);
    }
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try { (el as any).showPicker?.(); } catch { /* older browsers: click fallback */ el.click(); }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={text}
        onChange={(e) => commit(e.target.value)}
        onBlur={onBlur}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        required={required}
        className={`w-full ${inputClassName || "h-10 text-sm"} rounded-md border ${invalid ? "border-red-400 ring-1 ring-red-300" : "border-border"} bg-white px-3 pe-9 font-english text-start focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:opacity-50`}
        style={{ textAlign: "start" }}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        tabIndex={-1}
        className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-primary transition-colors disabled:opacity-40"
        aria-label="فتح التقويم"
        title="فتح التقويم"
      >
        <Calendar className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
      </button>
      {/* hidden native picker · positioned over the icon for its popup anchor */}
      <input
        ref={pickerRef}
        type="date"
        value={/^(\d{4})-(\d{2})-(\d{2})$/.test(value) ? value : ""}
        onChange={(e) => {
          const iso = e.target.value;
          if (iso) {
            setInvalid(false);
            setText(isoToDisplay(iso));
            onChange(iso);
          }
        }}
        className="absolute end-0 top-0 h-full w-9 opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
