# ENTIX Visual System Task 2 — Recovery Record

## Source and branch

- Base: `19349910871babac7c845d175a4106f00c9a824b`
- Branch: `feat/visual-system-v2`
- Worktree: `.worktrees/web-visual-system-v2`
- Scope: web visual-system foundation only; no API, database, iOS, pricing-copy, or App Store metadata changes.

## Delivered foundation

- Semantic Tailwind v4 tokens for ENTIX brand, neutral surfaces, statuses, density, geometry, elevation, and fluid typography.
- Unified core controls, cards, tabs, and logical RTL-safe table primitives.
- Shared page headers, toolbars, metrics, status badges, alerts, empty states, form fields, tables, numeric cells, and settings sections.
- Neutral application shell and organization switcher.
- Representative adoption on Dashboard, Contacts, Contact Detail, and Invoices without changing business workflows or table columns.
- Neutral shared panels plus reusable, unadopted public/auth layout contracts.
- Visual-policy gate and deterministic English/Arabic snapshots at phone, tablet, and desktop sizes.

## Verification record

- `npx tsc --noEmit` — passed.
- `npm run build` — passed; 32 legacy/public routes and 4 localized routes prerendered.
- `npm run test:visual-contracts` — passed.
- `npm run qa:visual-policy` — passed.
- `npm test -- --project=chromium` — 133 passed, 1 pre-existing authenticated smoke test skipped on macOS.
- Ubuntu Playwright 1.62 container — 133 passed, 1 pre-existing authenticated smoke test skipped.
- `tests/visual-regression.spec.ts` — 22 snapshots passed on repeat runs on both macOS and Ubuntu.
- Targeted print/bidi/claims contracts — 4 passed.
- Direct print CSS, routes, invoice/voucher/report/POS/tax/payroll source files are unchanged from the base commit.

## Print verification boundary

The repository had no rendered print-media snapshot suite or PDF page-geometry baseline. Task 2 proves that direct print implementations are unchanged and existing print/bidi/content contracts pass. It does not claim pixel-identical tax/payroll browser-print output, because global theme and Card/Button changes can affect shell-based printing and no prior image/PDF baseline exists.

## Deliberate deferrals

- Full public marketing page redesign and removal of existing hero/marketing decoration.
- Final login/register composition and adoption of the new auth contracts.
- Dashboard module reordering.
- Invoice table/editor/preview information architecture.
- Full DataTable migration of existing accounting tables.
- Report catalog and print designer redesign.
- Print-route consolidation and rendered PDF geometry tests.
- POS workstation redesign.
- Full dark-mode implementation.

## Rollback

Before merge, rollback is branch deletion. After merge, revert the visual-system merge commit recorded in the pull request. No schema or data migration is involved.
