/**
 * AddressAutocomplete · UX-106
 *
 * Type an address → debounced query to Nominatim (OpenStreetMap, free, no key)
 * → suggestions dropdown → click to auto-fill city/region/postalCode/country.
 *
 * Usage:
 *   <AddressAutocomplete
 *     value={form.addressLine1}
 *     onChange={(v) => setForm({ ...form, addressLine1: v })}
 *     onPick={(p) => setForm({ ...form, addressLine1: p.line1, city: p.city, region: p.region, postalCode: p.postalCode, country: p.country })}
 *     country={form.country}
 *     placeholder="ابدأ الكتابة..."
 *   />
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "./ui/input";

export interface PlaceResult {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
  lat?: number;
  lon?: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    region?: string;
    province?: string;
    postcode?: string;
    country_code?: string;
    house_number?: string;
  };
}

// US state name → 2-letter code (IRS/state filing needs the code, and an
// English UI must never carry a localized Arabic name into the State field).
const US_STATE_CODES: Record<string, string> = {
  "alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA","colorado":"CO","connecticut":"CT","delaware":"DE","district of columbia":"DC","florida":"FL","georgia":"GA","hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS","kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA","michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT","nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK","oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT","virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY",
};

function usStateCode(name: string): string {
  const n = (name || "").trim();
  if (/^[A-Z]{2}$/.test(n)) return n;
  return US_STATE_CODES[n.toLowerCase()] || n;
}

function nominatimToPlace(r: NominatimResult): PlaceResult {
  const a = r.address || {};
  const line1 = [a.house_number, a.road, a.neighbourhood || a.suburb].filter(Boolean).join(" ");
  return {
    line1: line1 || r.display_name.split(",")[0] || "",
    city: a.city || a.town || a.village || a.municipality || "",
    region: (a.country_code || "").toUpperCase() === "US" ? usStateCode(a.state || a.region || a.province || "") : (a.state || a.region || a.province || ""),
    postalCode: a.postcode || "",
    country: (a.country_code || "").toUpperCase(),
    lat: Number(r.lat),
    lon: Number(r.lon),
  };
}

export function AddressAutocomplete({
  value, onChange, onPick, country, placeholder, className,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: PlaceResult) => void;
  country?: string;
  placeholder?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click-away to close
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounce + fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.trim().length < 3) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        const params = new URLSearchParams({
          q: value.trim(),
          format: "jsonv2",
          addressdetails: "1",
          limit: "6",
          "accept-language": (typeof localStorage !== "undefined" && localStorage.getItem("entix-language") === "en") ? "en" : "ar,en",
        });
        if (country) params.set("countrycodes", country.toLowerCase());
        const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { "User-Agent": "EntixBooks/1.0 (https://entix.io)" },
        });
        if (r.ok) {
          const data = await r.json() as NominatimResult[];
          setSuggestions(data);
          setOpen(data.length > 0);
        }
      } catch { /* network error · ignore */ }
      finally { setBusy(false); }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, country]);

  return (
    <div ref={wrapperRef} className={`relative ${className || ""}`}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder || "ابدأ كتابة العنوان..."}
        className="border-border pe-9"
      />
      {busy && <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground/60" />}
      {!busy && value.trim().length >= 3 && <MapPin className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />}

      {open && suggestions.length > 0 && (
        <div className="absolute z-30 inset-x-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-border max-h-72 overflow-y-auto">
          {suggestions.map((s) => {
            const place = nominatimToPlace(s);
            return (
              <button
                key={s.place_id}
                type="button"
                onClick={() => { onPick(place); setOpen(false); }}
                className="w-full text-start px-3 py-2 hover:bg-primary/5 border-b border-border/50 last:border-0 flex items-start gap-2"
              >
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 text-xs">
                  <div className="text-foreground truncate" style={{ fontWeight: 500 }}>{place.line1 || s.display_name.split(",")[0]}</div>
                  <div className="text-muted-foreground truncate mt-0.5">
                    {[place.city, place.region, place.postalCode, place.country].filter(Boolean).join(" · ") || s.display_name}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
