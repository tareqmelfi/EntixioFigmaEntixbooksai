# ENTIX BOOKS — AI REFERENCE DOCUMENT
## FC-EX-IO | USFC-ENTX-IO-LAB | Master Plan v1.1

> **Purpose:** This document is the single source of truth for any AI assistant working on the Entix Books project. It contains every technical decision, architecture detail, database schema, compliance requirement, UX principle, and business context needed to contribute effectively.
>
> **Last Updated:** March 2026 | **Status:** ACTIVE | **Author:** Tareq Melfi (طارق ملفي)

---

## 0. CRITICAL CONTEXT — READ FIRST

```
PRODUCT NAME:     Entix Books (Financial System)
DOMAIN:           entix.io
PRODUCT CODE:     FC-EX-IO
PROJECT CODE:     USFC-ENTX-IO-LAB
OWNER:            Falcon Core LLC (Wyoming, USA)

⚠️ DEPRECATED NAMES (NEVER USE):
  - SpecPros Cloud Accounting
  - FinBridge
  - FinBridge Global
  These names are permanently retired as of March 2026.
```

---

## 1. COMPANY & LEGAL ENTITY

### 1.1 Falcon Core LLC

| Field | Value |
|---|---|
| Legal Name | Falcon Core LLC |
| Formation Date | January 04, 2026 |
| State of Formation | Wyoming (WY) |
| Entity Type | Limited Liability Company (LLC) |
| Federal Tax ID (EIN) | 41-3348033 |
| State Filing ID | 2026-001857464 |
| Tax Classification | Disregarded Entity (Sole Proprietor) |
| Registered Agent | Registered Agents Inc. |
| Entity Code (FC-UCS) | ▶ US-FC-00 ◀ |

### 1.2 Addresses

| Location | Address |
|---|---|
| 🇺🇸 US Legal (Principal & Mailing) | 30 N Gould St Ste R, Sheridan, WY 82801, United States |
| 🇸🇦 KSA Operations (Physical HQ) | 3938 AbMuhammad Ibn Al Mudhaffar, King Faisal Dist., Riyadh 13215, Kingdom of Saudi Arabia |

### 1.3 Contact Information

| Channel | Details |
|---|---|
| KSA Toll-Free | 800-111-0110 |
| KSA International Line 1 | +966 11 511 0150 |
| KSA International Line 2 | +966 11 511 0155 |
| US Direct Line | +1 (442) 444-4410 |
| General Inquiries | info@fc.sa |
| Administration/Banking | admin@fc.sa |
| Official Website | www.fc.sa |
| Product Website | entix.io |

### 1.4 Team

| Role | Name |
|---|---|
| CEO & Founder | Tareq Melfi (طارق ملفي) — AI Strategist & Investor |

---

## 2. PRODUCT DEFINITION

### 2.1 What Is Entix Books?

Entix Books is a **cloud-based accounting & financial management SaaS** platform targeting small and medium businesses (SMBs) in **Saudi Arabia** (primary market) and the **United States** (secondary market).

**Core value proposition:**
- Full ZATCA e-invoicing compliance (mandatory for Saudi businesses)
- Bilingual Arabic/English with native RTL support
- AI-powered document processing and smart classification
- Modern, minimal, clean UX — not cluttered like legacy accounting software
- Self-hosted infrastructure for full data sovereignty

### 2.2 FC-UCS Codes

| Code | Meaning |
|---|---|
| `FC-EX-IO` | Product code: Entix Books |
| `FC-EX-AP` | Product code: Entix App (company management — future) |
| `FC-EX-CL` | Product code: Entix Cloud (future) |
| `FC-EX-PR` | Product code: Entix Pro (future) |
| `USFC-ENTX-IO-LAB` | Project code: Entix Books development |

### 2.3 Target Markets

| Market | Priority | Key Driver |
|---|---|---|
| 🇸🇦 Saudi Arabia | PRIMARY — Launch first | ZATCA e-invoicing mandate, 67% of companies struggle with compliance |
| 🇺🇸 United States | SECONDARY — Phase 3 | 82% of business failures from poor cash flow management |

### 2.4 Market Data

| Metric | Value |
|---|---|
| Global accounting software market (2024) | $17.4B |
| Projected (2033) | $31.8B |
| CAGR | 7.3% |
| Cloud solutions market share | 67% |

---

## 3. TECHNOLOGY STACK — FINAL DECISIONS

### 3.1 Stack Overview

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 14 + React 18 + TypeScript + Tailwind CSS + shadcn/ui | SSR performance, modern design, type safety |
| **Backend** | NestJS + TypeScript + Prisma ORM | Modular architecture, type safety, excellent DX |
| **Database** | PostgreSQL 16 (self-hosted) | Best open-source DB for financial multi-tenant systems |
| **Cache/Sessions** | Redis 7 (self-hosted) | Sessions, rate limiting, queue backend |
| **Job Queue** | BullMQ (Redis-based) | ZATCA sync, OCR processing, report generation |
| **Object Storage** | MinIO (S3-compatible, self-hosted) | Attachments, invoices, OCR documents |
| **Design Tool** | Figma → shadcn/ui components | Design-first workflow |
| **Hosting** | Self-hosted Docker Compose + Coolify/Portainer | Full control, zero cloud cost, data sovereignty |
| **Reverse Proxy** | Caddy 2 (auto SSL) | Automatic HTTPS, simple config |
| **ORM** | Prisma | Type-safe database access, migrations |

### 3.2 Why PostgreSQL (Not MySQL/MariaDB)?

1. **Best open-source database for financial/accounting systems globally**
2. **Native Multi-Tenant** via Schema Isolation (each company = separate schema)
3. **JSONB** support for flexible data (ZATCA settings, custom permissions)
4. **Advanced indexes** (GIN, GiST, BRIN) for excellent query performance
5. **Row-Level Security (RLS)** for record-level data protection
6. **Generated Columns** (e.g., `amount_due` auto-calculated in invoices)
7. **Transactional DDL** — schema changes can be rolled back
8. **Mature ecosystem** for financial applications

### 3.3 Why Self-Hosting?

- Server already available — zero additional cloud cost
- Docker Compose manages all services as a single stack
- Coolify or Portainer as management UI
- **Critical for Saudi compliance** — full data sovereignty, no third-party data access
- Complete infrastructure ownership

### 3.4 Docker Compose Services

| Service | Image | Port | Function |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | Primary database |
| `redis` | `redis:7-alpine` | 6379 | Cache + Sessions + Queues |
| `minio` | `minio/minio` | 9000 | S3-compatible file storage |
| `app-api` | `entix-api:latest` | 3001 | NestJS Backend API |
| `app-web` | `entix-web:latest` | 3000 | Next.js Frontend |
| `worker` | `entix-worker:latest` | — | BullMQ Workers (ZATCA, OCR) |
| `caddy` | `caddy:2-alpine` | 443 | Reverse Proxy + Auto SSL |

### 3.5 Compatibility Rules

```
- React 18 ONLY — no React 19 dependencies
- Next.js 14.x patterns — do not change next.config.js unless absolutely necessary
- If "Minified React error #31" appears → check for duplicate imports
- Stable dependency versions only — no experimental packages
```

---

## 4. ARCHITECTURE

### 4.1 Multi-Tenant Model

```
┌─────────────────────────────────────────────────────────────┐
│                    PUBLIC SCHEMA                              │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐     │
│  │ tenants  │  │  users   │  │ user_tenant_access     │     │
│  └──────────┘  └──────────┘  │ (7 predefined roles)   │     │
│                               └────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────┐   ┌─────────────────────┐
│  tenant_001 schema  │   │  tenant_002 schema  │
│  - chart_of_accounts│   │  - chart_of_accounts│
│  - journal_entries  │   │  - journal_entries  │
│  - invoices         │   │  - invoices         │
│  - payments         │   │  - payments         │
│  - ... (all tables) │   │  - ... (all tables) │
└─────────────────────┘   └─────────────────────┘
```

**Request flow:**
```
User Request → Next.js → NestJS API Gateway → Tenant Resolver (JWT) → PostgreSQL Schema
```

Each company operates in a fully isolated PostgreSQL schema. Global tables (`public.tenants`, `public.users`, `public.user_tenant_access`) manage cross-tenant data. 

### 4.2 Predefined User Roles (7)

| Role | Access Level |
|---|---|
| `owner` | Full access + company settings + billing |
| `admin` | Full access except billing |
| `accountant` | Accounting, invoicing, reports, payments |
| `employee` | Limited: own timesheets, expense claims |
| `customer` | Portal: view invoices, make payments |
| `supplier` | Portal: view POs, submit invoices |
| `shareholder` | Portal: view financials, dividends |

### 4.3 Monorepo Structure

```
entix/
├── apps/
│   ├── web/          # Next.js 14 frontend
│   └── api/          # NestJS backend
├── packages/
│   └── shared/       # Shared types, utils, constants
├── prisma/
│   └── schema.prisma # Database schema
├── docker-compose.yml
└── package.json
```

---

## 5. DATABASE SCHEMA (50+ TABLES)

### 5.1 Global Tables (public schema)

| Table | Purpose |
|---|---|
| `tenants` | Company/organization records |
| `users` | User accounts (email, password, profile) |
| `user_tenant_access` | User-to-company mapping with role assignment |
| `roles` | 7 predefined roles |

### 5.2 Tenant Tables (per-company schema)

#### Core Accounting
| Table | Purpose | Key Features |
|---|---|---|
| `chart_of_accounts` | Chart of accounts tree | Hierarchical, GAAP/IFRS compatible |
| `journal_entries` | General ledger entries | Status workflow (draft → posted → void) |
| `journal_entry_details` | Entry line items | Debit/credit with cost center |
| `cost_centers` | Cost center tracking | Multi-level hierarchy |
| `currencies` | Multi-currency support | Base + foreign currencies |
| `exchange_rates` | Currency exchange rates | Date-based rates |
| `fixed_assets` | Asset register | Depreciation schedules |

#### Invoicing & Sales
| Table | Purpose | Key Features |
|---|---|---|
| `invoices` | Sales & purchase invoices | Full ZATCA fields (UUID, Hash, QR, XML, Signed XML) |
| `invoice_items` | Invoice line items | Product linking, tax calculation |
| `invoice_taxes` | Tax breakdown per invoice | VAT 15%, multiple tax types |

#### Payments
| Table | Purpose | Key Features |
|---|---|---|
| `payments` | Payment records | Multiple payment methods |
| `payment_allocations` | Payment-to-invoice mapping | Partial payments, multi-invoice allocation |

#### Approvals
| Table | Purpose | Key Features |
|---|---|---|
| `approval_workflows` | Workflow definitions | 1-5 step approval chains |
| `approval_workflow_steps` | Step configuration | Role-based or user-based approvers |
| `approval_requests` | Active approval requests | Status tracking |
| `approval_request_steps` | Step execution log | Approve/reject with comments |

#### Banking
| Table | Purpose | Key Features |
|---|---|---|
| `bank_accounts` | Company bank accounts | Multi-bank support |
| `bank_transactions` | Imported transactions | Plaid/Open Banking feed |
| `auto_reconciliation_rules` | Matching rules | Auto-categorization patterns |

#### Projects
| Table | Purpose | Key Features |
|---|---|---|
| `projects` | Project records | Budget tracking, profitability |
| `tasks` | Task breakdown | Assignees, deadlines |
| `time_entries` | Time tracking | Billable/non-billable hours |
| `project_accounting_links` | Project-to-GL mapping | Revenue/expense allocation |

#### HR & Payroll
| Table | Purpose | Key Features |
|---|---|---|
| `employees` | Employee records | Saudi labor law fields |
| `contracts` | Employment contracts | Contract types, renewal dates |
| `attendance_records` | Attendance tracking | Check-in/check-out |
| `leave_requests` | Leave management | Accrual, balance tracking |
| `expense_claims` | Employee expense claims | Receipt attachments, approval flow |
| `payroll_runs` | Monthly payroll execution | GOSI/WPS compliance |
| `payroll_details` | Per-employee payroll breakdown | Allowances, deductions, net pay |

#### Inventory
| Table | Purpose | Key Features |
|---|---|---|
| `products` | Product/service catalog | SKU, barcode, pricing |
| `warehouses` | Warehouse locations | Multi-warehouse support |
| `product_warehouse_stock` | Stock per warehouse | Generated column for available qty |
| `inventory_movements` | Stock movements | Transfer, adjustment, receipt |
| `inventory_alerts` | Low stock alerts | Configurable thresholds |

#### Shareholders
| Table | Purpose | Key Features |
|---|---|---|
| `shareholders` | Shareholder records | Ownership percentage |
| `dividend_distributions` | Dividend declarations | Per-period distribution |
| `shareholder_dividends` | Per-shareholder payout | Payment tracking |

#### System
| Table | Purpose | Key Features |
|---|---|---|
| `audit_log` | Full audit trail | Who changed what, when |
| `system_settings` | Per-tenant configuration | JSONB for flexible settings |
| `integrations` | External service connections | ZATCA, Stripe, Plaid configs |
| `chat_channels` | Internal messaging | Team communication |
| `chat_messages` | Chat message records | Attachments support |
| `notifications` | User notifications | Real-time + email |

---

## 6. MODULES (12 CORE MODULES)

### 6.1 Module Overview

| # | Module | Key Functions | Phase |
|---|---|---|---|
| 1 | **Core Accounting** | General ledger, journal entries, cost centers, multi-currency | MVP |
| 2 | **Sales** | Invoices, quotations, receipts, credit notes | MVP |
| 3 | **Purchases** | Purchase bills, payment vouchers, cash expenses | MVP |
| 4 | **ZATCA E-Invoicing** | XML/UBL 2.1, QR code, digital signature, FATOORAH API | MVP |
| 5 | **Reports** | Trial balance, income statement, balance sheet, cash flow | MVP |
| 6 | **Contacts** | Customers, suppliers, freelancers, light CRM | MVP |
| 7 | **Inventory** | Products, warehouses, movements, stock alerts | Phase 2 |
| 8 | **Payroll** | Payroll runs, attendance, leaves, GOSI compliance | Phase 2 |
| 9 | **Projects** | Projects, tasks, time tracking, profitability analysis | Phase 2 |
| 10 | **Bank Feeds** | Auto-reconciliation, Plaid (US), Open Banking (GCC) | Phase 3 |
| 11 | **Portals** | Customer/supplier/shareholder self-service portals | Phase 3 |
| 12 | **Smart AI** | OCR (Google Vision), auto-classification, cash flow prediction | Phase 3 |

### 6.2 Module Details — MVP (Phase 1)

#### Module 1: Core Accounting
- Chart of Accounts with GAAP/IFRS templates (auto-populated by business type)
- Manual journal entries with draft → posted → void workflow
- Cost center tracking with multi-level hierarchy
- Multi-currency with automatic exchange rate conversion
- Fiscal year management with period locking

#### Module 2: Sales
- Invoice creation with smart line items (auto-suggest from products DB)
- Quotation → Invoice conversion
- Receipt/payment voucher generation
- Credit notes for returns/adjustments
- Sequential numbering with prefix customization

#### Module 3: Purchases
- Purchase bill entry with supplier linking
- Payment voucher generation
- Cash expense recording
- Purchase → Payment allocation

#### Module 4: ZATCA E-Invoicing
- UUID 128-bit unique identifier per invoice
- Sequential hash linking invoices cryptographically
- QR code with 9 TLV base64 elements
- CSID cryptographic seal from ZATCA
- Non-resettable invoice counter
- XML/UBL 2.1 format + PDF/A-3
- API integration with FATOORA platform
- Phase 1 (Issuance): QR for B2C, electronic storage
- Phase 2 (Integration): API for B2B clearance, B2C reporting within 24h
- Sandbox testing environment available

#### Module 5: Reports
- Trial Balance
- Income Statement (Profit & Loss)
- Balance Sheet
- Cash Flow Statement
- VAT Return Report
- Custom date range filtering
- Export to PDF/Excel

#### Module 6: Contacts
- Customer management with credit limits
- Supplier management with payment terms
- Freelancer profiles
- Contact activity timeline
- Light CRM features (notes, tags, last interaction)

---

## 7. UI/UX DESIGN

### 7.1 Design Philosophy

```
PRINCIPLE: Minimal & Clean
- No unnecessary elements
- Generous whitespace
- Focused content
- Professional, not flashy
- "Less is more" — avoid cluttering the interface
```

### 7.2 Design Workflow

```
1. Design in Figma → 2. Review by Tareq → 3. Implement with shadcn/ui + Tailwind
⚠️ No development starts before design approval
```

### 7.3 Brand Colors (Entix Books)

| Color | Hex | Usage |
|---|---|---|
| Navy Primary | `#0B1B49` | Headers, sidebar background, primary text |
| Blue Accent | `#1276E3` | Buttons, links, active states |
| Teal Secondary | `#179FC5` | Charts, secondary accents, highlights |
| Light Background | `#F4FCFF` | Page backgrounds, card surfaces |

### 7.4 Typography

| Script | Font | Usage |
|---|---|---|
| Arabic | **Noto Sans Arabic** | All Arabic text, UI labels, body text |
| English | **Inter** | English text, numbers, code, technical terms |
| Icons | **Lucide Icons** | All UI icons, using brand colors |

### 7.5 Layout Principles

- **RTL-first** — Arabic is the primary language, English is secondary
- Full **LTR support** with instant language toggle
- Responsive design (desktop-first, mobile-friendly)
- Each screen designed in 3 states: Empty State, Active State, Error State
- Dark Mode planned as future enhancement

### 7.6 Sidebar Structure (Approved — v1.1)

```
┌─────────────────────────────────┐
│ 🏢 [Company Selector]     ▼    │
│ 📍 [Branch Selector]           │
├─────────────────────────────────┤
│ 📊 لوحة التحكم (Dashboard)     │  ← Active: highlight + icon
│ ✨ الذكاء الاصطناعي [NEW]       │
├────── العمليات الأساسية ────────┤
│ 📈 المبيعات ▼                   │
│    ├ الفواتير                   │
│    ├ عروض الأسعار               │
│    ├ سندات القبض                │
│    └ الإشعارات الدائنة          │
│ 🛒 المشتريات ▼                  │
│    ├ فواتير المشتريات           │
│    ├ سندات الدفع                │
│    └ المصروفات النقدية          │
│ 🧮 المحاسبة ▼                   │
│    ├ دليل الحسابات             │
│    ├ قيود اليومية               │
│    └ الضرائب                    │
├────── الموارد ──────────────────┤
│ 📦 المخزون ▼                    │
│ 💵 الرواتب ▼                    │
│ 👥 جهات الاتصال                 │
├────── التحليلات ────────────────┤
│ 📊 التقارير                     │
├─────────────────────────────────┤
│ ⚙️ الإعدادات                    │
│ 🚪 تسجيل الخروج                │
└─────────────────────────────────┘
```

### 7.7 Dashboard Design (Approved Reference)

The dashboard follows a structured layout:

1. **Alert Bar** (top): 3 colored notification cards (red = warning, green = positive, blue = info)
2. **KPI Cards Row**: 4 stat cards — Total Revenue (SAR), Subscriptions, Sales, Active Now — each with trend indicator (up/down arrow + percentage)
3. **Charts Grid** (2x2):
   - Top-left: **Profit & Loss** — grouped bar chart (6 months)
   - Top-right: **Revenue Breakdown** — horizontal bar chart by segment (branches, projects, cost centers)
   - Bottom-left: **Cash Flow** — dual line chart (inflow vs outflow)
   - Bottom-right: **Revenue vs Expenses** — grouped bar chart comparison

### 7.8 UX Principles (Approved from Prior Reviews)

| Code | Principle | Details |
|---|---|---|
| **UX-2** | Paste-from-Excel + AI | Paste line items from spreadsheet → auto-classify GL account → learn from corrections |
| **UX-5** | Global Drag & Drop | Drag PDF/JPG anywhere on screen → auto-upload and attach to current document |
| **UX-6** | No Pre-Creation Modals | "Add" button opens full page directly — never show a modal before the creation page |
| **UX-7** | Smart Line Items | Auto-suggest from products DB, auto-fill price/account, option to save as new product |
| **FW-1** | Templated Onboarding | Setup wizard by business type → auto-populate Chart of Accounts and report templates |

### 7.9 Core Screens (Phase 1 Design Priority)

1. **Login** — Clean, centered, bilingual
2. **Dashboard** — KPI cards + 4 charts + alert bar
3. **Invoice List** — Filterable table with status badges, summary footer
4. **Invoice Create** — Full page (not modal), smart line items
5. **Contacts** — List + detail view
6. **Chart of Accounts** — Tree view with drag-to-reorder
7. **Reports** — Report selector + date range + export options
8. **Settings** — Tabbed layout (Company, Users, Integrations, Billing)

---

## 8. COMPLIANCE

### 8.1 Saudi Arabia — ZATCA E-Invoicing (FATOORAH)

```
CRITICAL: ZATCA compliance is the LAUNCH REQUIREMENT for Saudi market.
Saudi market launches FIRST. US expansion comes in Phase 3.
```

| Requirement | Details |
|---|---|
| UUID | 128-bit unique identifier per invoice |
| Sequential Hash | Cryptographic chain linking invoices |
| QR Code | 9 TLV base64-encoded elements |
| CSID | Cryptographic Stamp Identifier from ZATCA |
| Counter | Non-resettable sequential invoice counter |
| Format | XML/UBL 2.1 + PDF/A-3 |
| API | Integration with FATOORAH platform |
| VAT | 15% standard rate |
| Phase 1 (Issuance) | QR for B2C, electronic storage |
| Phase 2 (Integration) | API clearance for B2B, B2C reporting within 24h |
| Current Wave | Wave 21: companies with revenue >1.25M SAR |

### 8.2 United States — IRS & GAAP

| Requirement | Details |
|---|---|
| Tax Filing | e-file system support |
| Forms | 1099 (payments) and W-2 (payroll) |
| Sales Tax | 13,000+ jurisdictions across states |
| Accounting Standards | GAAP 10 core principles |
| Security | SOC 2 Type II |
| Card Processing | PCI DSS compliance |
| Banking | Plaid for account linking |

---

## 9. INTEGRATIONS

| Integration | Type | Market | Phase |
|---|---|---|---|
| **ZATCA FATOORAH API** | E-invoicing | 🇸🇦 | MVP |
| **Stripe Payments** | Payment gateway | 🌍 | MVP |
| **STC Pay / Mada** | Local payment | 🇸🇦 | Phase 2 |
| **Google Vision OCR** | Invoice reading | 🌍 | Phase 3 |
| **Plaid** | Bank linking | 🇺🇸 | Phase 3 |
| **Wio / Open Banking** | Bank linking | 🇸🇦 🇦🇪 | Phase 3 |
| **Zapier / n8n** | Automation | 🌍 | Phase 3 |
| **Slack / Teams** | Notifications | 🌍 | Phase 3 |

---

## 10. DEVELOPMENT ROADMAP (9 MONTHS)

### Phase 1 — Foundation (Months 1-3) — MVP

| Week | Task | Deliverables |
|---|---|---|
| W1-2 | Infrastructure + Figma | Docker stack running + 4 core screen designs |
| W3-4 | Auth + Multi-Tenant + CoA | Login/logout + company creation + CoA templates |
| W5-6 | Journal Entries + Contacts | Entry create/view/post + CRUD contacts |
| W7-8 | Sales Invoices (without ZATCA) | Create/view/print + smart line items (UX-7) |
| W9-10 | Purchase Bills + Payments | Full purchase cycle + payment allocation |
| W11-12 | Basic Financial Reports | Trial balance + income statement + balance sheet |

### Phase 2 — Expansion (Months 4-6)

| Week | Task | Deliverables |
|---|---|---|
| W13-15 | Full ZATCA Integration | XML/QR/Hash + CSID + API + Sandbox testing |
| W16-17 | Inventory Module | Products + warehouses + movements + alerts |
| W18-20 | Basic Payroll | Employees + payroll runs + GOSI |
| W21-22 | Project Management | Projects + tasks + time tracking |
| W23-24 | Approval Workflows + Dashboard | Approval paths + interactive dashboard |

### Phase 3 — Launch & Intelligence (Months 7-9)

| Week | Task | Deliverables |
|---|---|---|
| W25-27 | Smart AI Module | OCR (Google Vision) + AI account prediction + Paste-from-Excel |
| W28-30 | Bank Feeds + Auto-Reconciliation | Plaid US + Open Banking GCC + matching rules |
| W31-33 | Customer/Supplier Portals | Standalone portal for payment/signature/invoice viewing |
| W34-36 | Comprehensive Testing + Pilot Launch | 500+ test cases + 20 pilot companies + ZATCA Production |

### Roadmap Flow

```
Phase 1 (3mo) ──→ Phase 2 (3mo) ──→ Phase 3 (3mo) ──→ 🚀 LAUNCH
Core Accounting     ZATCA + Inventory    AI + Bank Feeds     Saudi Market
+ Invoicing         + Payroll            + Portals           Launch
```

---

## 11. PRICING MODEL

### 11.1 Saudi Market (SAR)

| Feature | أساسي (Basic) 69 SAR/mo | متقدم (Advanced) 149 SAR/mo | مؤسسي (Enterprise) 399 SAR/mo |
|---|---|---|---|
| Users | 2 | 10 | Unlimited |
| Invoices/month | 100 | 500 | Unlimited |
| ZATCA E-Invoicing | ✓ | ✓ | ✓ |
| Inventory + Projects | — | ✓ | ✓ |
| Payroll + HR | — | ✓ | ✓ |
| Smart AI (OCR + Classification) | — | — | ✓ |
| Customer/Supplier Portals | — | — | ✓ |
| Bank Feeds | — | — | ✓ |
| API Access | — | — | ✓ |

### 11.2 US Market (Future)

| Tier | Price Range |
|---|---|
| Basic | $10-35/month |
| Professional | $50-100/month |
| Enterprise | $150-300/month |

---

## 12. SUCCESS METRICS

| Metric | Target |
|---|---|
| Customer retention rate | >90% |
| Net Promoter Score (NPS) | >50 |
| ZATCA violations | Zero |
| Uptime | 99.9% |
| API response time | <500ms |

---

## 13. IMMEDIATE NEXT STEPS

1. ✅ Master Plan v1.1 delivered and approved
2. 🎯 Design 8 core screens in Figma (Dashboard, Invoice List, Invoice Create, Contacts, CoA, Reports, Settings, Login)
3. 🎯 Set up Docker Compose on server with all services
4. 🎯 Create GitHub repository with Monorepo structure (`apps/web` + `apps/api` + `packages/shared`)
5. 🎯 Implement database schema via Prisma Migrations
6. 🎯 Develop Auth + Multi-Tenant system as first component

---

## 14. AI ASSISTANT RULES

When working on this project, any AI assistant MUST follow these rules:

### 14.1 Incremental Updates Only
```
❌ NEVER: Recreate entire files or applications
❌ NEVER: Delete, summarize, or ignore existing code/content
❌ NEVER: Change parts that were not requested to change

✅ ALWAYS: Output only the modified parts (the updated component only)
✅ ALWAYS: Preserve everything not explicitly requested to change — VERBATIM
✅ ALWAYS: Make surgical, precise edits on the requested point only
```

### 14.2 Sacred Elements (Never Touch Without Permission)
```
🔒 Header / Footer / Sidebar / Navigation
🔒 Auth Logic / Session Management
🔒 Design System Colors / Typography
🔒 Database Schema / API Endpoints (unless explicitly requested)
🔒 Existing Business Logic
```

### 14.3 No Regression
```
Before applying any fix, verify it does not break:
✓ Previously working features (Drag & Drop, Streaming, etc.)
✓ Current design and colors
✓ External service integrations
✓ Current user experience

Mental test before every change: "Will this break something else?"
```

### 14.4 Design Freeze Protocol
```
When asked to modify design/logo/interface:
1. ASK: "What specific change is needed?"
2. FREEZE: All other elements (colors, fonts, dimensions, layout)
3. MODIFY: Only the requested point
4. DOCUMENT: What changed and what stayed the same

⚠️ If asked to "improve" generally → ask for specific details before any change
```

### 14.5 Naming Rules
```
- Product name: "Entix Books" (not ENTIX, not entix, not EntixBooks)
- Domain: entix.io
- Company: Falcon Core LLC
- Never use: SpecPros, FinBridge, or any deprecated name
- Code references: FC-EX-IO (product), USFC-ENTX-IO-LAB (project)
- Author credit: "Tareq Melfi | طارق ملفي"
- Copyright: "© 2026 Falcon Core LLC"
```

---

## 15. DESIGN SYSTEM REFERENCE (For FC Documents)

When creating formal Falcon Core documents (reports, plans, proposals), use **FC Design System V5**:

| Element | Value |
|---|---|
| Document Colors | Navy `#001539` + Cyan `#05B6FA` |
| Arabic Font | Noto Sans Arabic |
| English Font | Rubik 800 |
| Logo | FALCON (white) + CORE (cyan #05B6FA) |
| Page Size | A4 (210mm × 297mm) |
| Direction | RTL (Arabic primary) |
| Footer | `[FC-UCS Code]` + `© 2026 Falcon Core LLC` + `[Page#]` |
| Cover/Closing | Navy background, no page numbers |

---

**© 2026 Falcon Core LLC, WY, United States. All rights reserved.**
**Prepared by: Tareq Melfi | إعداد: طارق ملفي**