/**
 * One-shot codemod · replaces arbitrary hex utility classes with semantic
 * theme tokens (theme.css). Exact-token replacements only — no regex fuzz.
 * Usage: node scripts/replace-hex-classes.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/app/pages", "src/app/components"];

// Brand tokens (theme.css): --foreground #0B1B49 · --primary #0F6AD2 · --secondary #179FC5 · --ring #1276E3
// --muted-foreground #717182 · --sidebar-border #E5E7EB
const MAP = {
  // deep navy → foreground
  "text-[#0B1B49]": "text-foreground",
  "text-[#0B1A47]": "text-foreground",
  "bg-[#0B1B49]": "bg-foreground",
  "from-[#0B1B49]": "from-foreground",
  // brand blue (#1276E3 ≈ --ring / --sidebar-primary · #0F66C7 ≈ --primary #0F6AD2)
  "border-[#1276E3]": "border-primary",
  "text-[#1276E3]": "text-primary",
  "bg-[#1276E3]": "bg-primary",
  "ring-[#1276E3]": "ring-ring",
  "from-[#1276E3]": "from-primary",
  "to-[#1276E3]": "to-primary",
  "via-[#1276E3]": "via-primary",
  "shadow-[#1276E3]": "shadow-primary",
  "bg-[#0F66C7]": "bg-primary",
  "text-[#0F66C7]": "text-primary",
  "border-[#0F66C7]": "border-primary",
  // teal / cyan (#349FC4 ≈ --secondary #179FC5)
  "text-[#349FC4]": "text-secondary",
  "bg-[#349FC4]": "bg-secondary",
  "to-[#349FC4]": "to-secondary",
  "from-[#349FC4]": "from-secondary",
  "text-[#179FC5]": "text-secondary",
  "bg-[#179FC5]": "bg-secondary",
  // neutral grays → muted-foreground
  "text-[#6B7280]": "text-muted-foreground",
  "text-[#9CA3AF]": "text-muted-foreground",
  "text-[#94A3B8]": "text-muted-foreground",
  "text-[#717182]": "text-muted-foreground",
  "text-[#4B5563]": "text-foreground/70",
  "text-[#374151]": "text-foreground/80",
  "text-[#1F2937]": "text-foreground",
  "text-[#111827]": "text-foreground",
  "text-[#E5E7EB]": "text-muted",
  // surfaces & lines
  "border-[#E5E7EB]": "border-border",
  "bg-[#E5E7EB]": "bg-muted",
  "bg-[#EFF6FF]": "bg-primary/5",
  "bg-[#F7F9FC]": "bg-muted/50",
  "bg-[#FAFBFC]": "bg-muted/40",
  "bg-[#F3F4F6]": "bg-muted",
  "bg-[#F9FAFB]": "bg-muted/40",
  "bg-[#F1F5F9]": "bg-background",
  // status palettes → standard tailwind status scale (already used across the app)
  "text-[#22C55E]": "text-green-500",
  "bg-[#22C55E]": "bg-green-500",
  "text-[#166534]": "text-green-800",
  "bg-[#DCFCE7]": "bg-green-100",
  "text-[#15803D]": "text-green-700",
  "text-[#92400E]": "text-amber-800",
  "bg-[#FEF3C7]": "bg-amber-100",
  "text-[#F59E0B]": "text-amber-500",
  "bg-[#F59E0B]": "bg-amber-500",
  "text-[#B45309]": "text-amber-700",
  "text-[#991B1B]": "text-red-800",
  "bg-[#FEE2E2]": "bg-red-100",
  "text-[#DC2626]": "text-red-600",
  "text-[#EF4444]": "text-red-500",
  "bg-[#EF4444]": "bg-red-500",
  "text-[#B91C1C]": "text-red-700",

  // ── round 2 · long tail ─────────────────────────────────────────────────
  // pale tints
  "bg-[#F4FCFF]": "bg-primary/5",
  "from-[#F4FCFF]": "from-primary/5",
  "hover:bg-[#F4FCFF]": "hover:bg-primary/5",
  "bg-[#F0FDF4]": "bg-green-50",
  "bg-[#F8FAFC]": "bg-muted/40",
  "bg-[#ECEEF5]": "bg-muted",
  "bg-[#EFF8FF]": "bg-primary/5",
  "bg-[#EAF4FF]": "bg-primary/5",
  "bg-[#DBEAFE]": "bg-blue-100",
  // pale borders
  "border-[#D7F0FF]": "border-primary/20",
  "border-[#D7E9FF]": "border-primary/20",
  "border-[#BFDBFE]": "border-primary/30",
  "border-[#D1D5DB]": "border-border",
  "border-[#CBD5E1]": "border-border",
  "border-[#EEF2F7]": "border-border",
  "border-[#DEE4EF]": "border-border",
  "border-[#F3F4F6]": "border-border",
  "border-[#0B1B49]": "border-foreground",
  "border-[#22C55E]": "border-green-500",
  "border-[#F59E0B]": "border-amber-500",
  "border-[#FEF3C7]": "border-amber-100",
  // navy gradient stops
  "via-[#122354]": "via-foreground",
  "via-[#0F2156]": "via-foreground",
  "to-[#122354]": "to-foreground",
  "to-[#1A2D5C]": "to-foreground",
  "shadow-[#0B1B49]": "shadow-foreground",
  // blue family → primary / sky
  "text-[#1E40AF]": "text-primary",
  "text-[#0B5CAD]": "text-primary",
  "text-[#075985]": "text-primary",
  "text-[#60A5FA]": "text-sky-400",
  "to-[#60A5FA]": "to-sky-400",
  "bg-[#075985]": "bg-primary",
  "bg-[#0372B4]": "bg-primary",
  "bg-[#02609E]": "bg-primary",
  "shadow-[#0372B4]": "shadow-primary",
  "hover:bg-[#0F66C7]": "hover:bg-primary/90",
  "hover:bg-[#02609E]": "hover:bg-primary/90",
  "hover:bg-[#0498D4]": "hover:bg-secondary/90",
  "hover:text-[#1276E3]": "hover:text-primary",
  "hover:text-[#0B1A47]": "hover:text-foreground",
  // remaining grays
  "text-[#D1D5DB]": "text-muted-foreground",
  "text-[#CBD5E1]": "text-muted-foreground",
  "text-[#64748B]": "text-muted-foreground",
  // purple family (V10-banned) → brand tokens
  "text-[#6B21A8]": "text-primary",
  "text-[#7C3AED]": "text-primary",
  "bg-[#F3E8FF]": "bg-primary/5",
  // misc statuses
  "text-[#9D174D]": "text-destructive",

  // ── round 3 · final tail ────────────────────────────────────────────────
  "to-[#179FC5]": "to-secondary",
  "hover:bg-[#16A34A]": "hover:bg-green-600",
  "bg-[#16A34A]": "bg-green-600",
  "bg-[#166534]": "bg-green-800",
  "border-[#16785A]": "border-green-700",
  "text-[#16785A]": "text-green-700",
  "bg-[#16785A]": "bg-green-700",
  "shadow-[#22C55E]": "shadow-green-500",
  "border-[#BBD7F5]": "border-primary/20",
  "ring-[#E5E7EB]": "ring-border",
  "bg-[#F8FBFF]": "bg-primary/5",
  "bg-[#F0FBF6]": "bg-green-50",
  "bg-[#1E40AF]": "bg-primary",
  "text-[#9333EA]": "text-primary",
  "hover:text-[#E84B4B]": "hover:text-destructive",
  "hover:border-[#E84B4B]": "hover:border-destructive",
  "hover:bg-[#E0F2FE]": "hover:bg-primary/10",
  "hover:bg-[#8B5CF6]": "hover:bg-primary/90",
  "hover:bg-[#4F47CC]": "hover:bg-primary/90",
  "hover:bg-[#001E5F]": "hover:bg-foreground/90",
  "from-[#F8FAFC]": "from-muted/40",
  "from-[#F0FDF4]": "from-green-50",
  "border-[#F4B4B4]": "border-red-300",
  "border-[#D9DCE7]": "border-border",
  "border-[#8B5CF6]": "border-primary",
  "bg-[#FFFBEB]": "bg-amber-50",
  "bg-[#FFF7ED]": "bg-orange-50",
  "bg-[#FEF2F2]": "bg-red-50",
  "bg-[#FCE7F3]": "bg-pink-50",
  "bg-[#F7FBFF]": "bg-primary/5",
  "bg-[#F4F5F7]": "bg-muted",
  "bg-[#F0F9FF]": "bg-sky-50",
  "bg-[#F0F7FF]": "bg-primary/5",
  "bg-[#EEF6FF]": "bg-primary/5",
  "bg-[#EEF2F7]": "bg-muted",
  "bg-[#ECFDF5]": "bg-emerald-50",
  "bg-[#EAF1F8]": "bg-muted/50",
  "bg-[#DDE7F0]": "bg-muted",
  "bg-[#D1D5DB]": "bg-muted",
  "bg-[#9D174D]": "bg-destructive",
  "bg-[#92400E]": "bg-amber-800",
  "bg-[#7C3AED]": "bg-primary",
  "bg-[#6B21A8]": "bg-primary",
  "bg-[#635BFF]": "bg-primary",
  "bg-[#374151]": "bg-foreground/80",
  "bg-[#25D366]": "bg-green-500",
  "bg-[#0B1A47]": "bg-foreground",
  "bg-[#003087]": "bg-primary",
};

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) yield p;
  }
}

let filesChanged = 0;
let replacements = 0;
for (const root of ROOTS) {
  for (const file of walk(root)) {
    let src = readFileSync(file, "utf8");
    let changed = false;
    for (const [from, to] of Object.entries(MAP)) {
      if (src.includes(from)) {
        const count = src.split(from).length - 1;
        src = src.split(from).join(to);
        replacements += count;
        changed = true;
      }
    }
    if (changed) {
      writeFileSync(file, src);
      filesChanged++;
    }
  }
}
console.log(`files changed: ${filesChanged} · replacements: ${replacements}`);
