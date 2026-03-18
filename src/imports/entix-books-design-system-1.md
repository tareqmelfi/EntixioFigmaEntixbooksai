# Entix Books — Figma Design System & All Screens Prompt
## USFC-ENTX-IO-LAB | FC-EX-IO

> هذا البرومبت لتصميم جميع شاشات Entix Books في Figma بشكل منظم ومتسلسل.
> يُستخدم مع Figma AI أو يُعطى للمصمم كمرجع كامل.

---

## 1. Brand Identity

```
Product:     Entix Books (Financial System)
Domain:      entix.io
Owner:       Falcon Core LLC
Language:    Arabic (RTL) primary — English secondary
Direction:   RTL-first (right-to-left)
```

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `navy-primary` | `#0B1B49` | Headings, active sidebar parent, text |
| `blue-accent` | `#1276E3` | Buttons, links, active items, primary CTA |
| `teal-secondary` | `#179FC5` | Charts accent, secondary elements |
| `bg-light` | `#F4FCFF` | Page backgrounds |
| `bg-white` | `#FFFFFF` | Cards, sidebar, content areas |
| `gray-500` | `#6B7280` | Section labels, secondary text |
| `gray-200` | `#E5E7EB` | Borders, dividers |
| `success` | `#22C55E` | Paid, positive trends |
| `danger` | `#EF4444` | Overdue, logout, errors |
| `warning` | `#F59E0B` | Pending, warnings |

### Typography
| Script | Font | Weights |
|--------|------|---------|
| Arabic | Noto Sans Arabic | 400, 500, 600, 700 |
| English/Numbers | Inter | 400, 500, 600, 700 |

### Icons
- Library: **Lucide Icons**
- Size: 20px (sidebar), 16px (inline), 24px (page headers)
- Style: Stroke only, 1.5px weight

### Spacing
- Base unit: 4px
- Card padding: 16-24px
- Section gap: 24px
- Sidebar width: 260px (expanded), 64px (collapsed)

### Border Radius
- Cards: 12px
- Buttons: 8px
- Badges: 6px (status), 16px (pills)
- Inputs: 8px

---

## 2. Component Library (Design System)

### 2.1 Sidebar Component
```
Background: #FFFFFF (light — NEVER dark)
Width: 260px
Border: 1px solid #E5E7EB (right border in LTR / left border in RTL)

States:
- Default item: icon + text, color #0B1B49 at 70% opacity
- Hover: bg #F4FCFF, color #0B1B49 at 100%
- Active (top-level): bg #1276E3, text white, rounded 8px
- Active parent (expanded): bg #0B1B49, text white
- Active child: bg #1276E3, text white
- Section label: #6B7280, uppercase, 11px, 600 weight
- Logout: #EF4444 text

Layout per item:
[Icon 20px] [gap 12px] [Label flex-1] [Chevron 16px]
(In RTL: Icon on RIGHT, Chevron on LEFT — auto from flex + dir=rtl)
```

### 2.2 Button Components
```
Primary:   bg #1276E3, text white, rounded 8px, px 16, py 10
Secondary: bg white, border #E5E7EB, text #0B1B49, rounded 8px
Danger:    bg #EF4444, text white, rounded 8px
Ghost:     bg transparent, text #1276E3
Icon+Text: [icon 16px] [gap 8px] [label]
```

### 2.3 Stat Card
```
Border: 1px solid #E5E7EB
Rounded: 12px
Padding: 20px
Content:
  - Label: 12px, #6B7280
  - Value: 28px, 700 weight, #0B1B49 (numbers in Inter)
  - Trend: 12px, green (+%) or red (-%)
  - Icon: 20px, top-right corner, #6B7280
```

### 2.4 Data Table
```
Header: bg #F9FAFB, text #6B7280, 12px, 600 weight, uppercase
Row: border-bottom 1px #F3F4F6, py 12, px 16
Row hover: bg #F4FCFF
Text: 14px, #374151
Numbers: Inter font, ltr direction
```

### 2.5 Status Badge
```
مدفوعة (Paid):    bg #DCFCE7, text #166534, border #22C55E
مرسلة (Sent):     bg #EFF6FF, text #1E40AF, border #3B82F6
متأخرة (Overdue): bg #FEE2E2, text #991B1B, border #EF4444
مسودة (Draft):    bg #F3F4F6, text #374151, border #9CA3AF
جديد (New):       bg #DBEAFE, text #1E40AF, solid
موحد (Unified):   bg #FEF3C7, text #92400E, solid
```

### 2.6 Report Card
```
Border: 1px solid #E5E7EB
Rounded: 12px
Padding: 20px
Layout:
  Row 1: [Icon in blue circle 36px] [Title 14px 600] [Badge optional]
  Row 2: [Description 12px #6B7280]
  Row 3: [عرض button blue filled] [تصدير button blue outline]
Grid: 3 columns, gap 16px
```

### 2.7 Form Inputs
```
Height: 40px
Border: 1px solid #E5E7EB
Rounded: 8px
Focus: border #1276E3, ring 2px #1276E3/20%
Label: 12px, #374151, 500 weight, above input
Placeholder: #9CA3AF
Error: border #EF4444, text #EF4444 below
```

---

## 3. Screen Designs (11 Screens)

### تعليمات عامة لكل شاشة:
- Direction: RTL (right-to-left)
- Sidebar على اليمين (في RTL)
- المحتوى على اليسار
- Header bar أعلى المحتوى: [language toggle 🌐] [notifications 🔔] [user name + avatar]
- صمم كل شاشة بـ 3 variants: Empty, Active, Error

---

### Screen 1: Login — تسجيل الدخول
```
Layout: Centered card (400px) on #F4FCFF background
Content:
  - Entix Books logo + "EB" icon (centered)
  - "نظام محاسبي متكامل" subtitle
  - البريد الإلكتروني input
  - كلمة المرور input (with show/hide toggle)
  - "تسجيل الدخول" button (full width, primary)
  - "نسيت كلمة المرور؟" link
  - Language toggle (AR | EN) bottom
  
Variants:
  - Default: empty form
  - Error: red borders on invalid fields + error message
  - Loading: button with spinner
```

### Screen 2: Dashboard — لوحة التحكم
```
Header: "Dashboard" / "لوحة التحكم" + subtitle
Row 1: 4 Stat Cards
  - Total Income: SAR 45,231.89 (+21.1%)
  - Subscriptions: +2350 (+10.1%)
  - Sales: 12,234 (+9%)
  - Active Now: +573 (201 vs previous hour)

Row 2: 2 Charts side by side
  - Profit & Loss: Grouped bar chart (6 months) — navy + teal bars
  - Revenue Breakdown: Horizontal bar chart — by branch/project/cost center

Row 3: 2 Charts side by side  
  - Cash Flow: Dual line chart (inflow vs outflow) with dot markers
  - Revenue vs Expenses: Grouped bar comparison

Chart style: White card, subtle shadow, 12px rounded
```

### Screen 3: Sales Dashboard — الصفحة الرئيسية للمبيعات
```
⚠️ CRITICAL UX: Clicking "المبيعات" in sidebar → opens THIS page, not just a dropdown
Route: /sales

Header: "المبيعات" + "نظرة شاملة على مبيعاتك وفواتيرك"

KPI Cards Row (4 cards — CLICKABLE, act as filter shortcuts):
  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
  │إجمالي    │ │إجمالي    │ │المدفوع   │ │المتأخر   │
  │الفواتير  │ │المبالغ   │ │          │ │          │
  │    8     │ │551,947.3 │ │306,947.3 │ │ 90,000   │
  │          │ │  ر.س     │ │  ر.س 🟢  │ │  ر.س 🔴  │
  └──────────┘ └──────────┘ └──────────┘ └──────────┘
  ↑ Click any card → navigates to /sales/invoices?status=X

Filter Bar:
  [🔍 البحث في الفواتير...] [🔽 تصفية] [⬇ تصدير]
  Tabs: [الكل (8)] [مسودات (1)] [مرسلة (1)] [مدفوعة (5)] [متأخرة (1)]

Quick Insights Row (3 mini-cards — clickable):
  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
  │ 🏆 أكبر عميل   │ │ ⚠️ أكثر تأخر  │ │ 📊 أكثر كريديت│
  │ شركة التقنية   │ │ مؤسسة النجاح  │ │ شركة المستقبل │
  │ 150,000 ر.س    │ │ 90,000 ر.س    │ │ 3 إشعارات    │
  │ [عرض التفاصيل] │ │ [عرض التفاصيل] │ │ [عرض التفاصيل]│
  └────────────────┘ └────────────────┘ └────────────────┘

Recent Invoices Table (latest 5-10):
  Same columns as Invoice List page
  [عرض جميع الفواتير →] link at bottom

Charts Row (2 charts side by side):
  Left: المبيعات الشهرية (6-month bar chart, navy bars)
  Right: توزيع حالات الفواتير (donut chart: paid/sent/overdue/draft)

Quick Actions:
  [+ فاتورة جديدة] [+ عرض سعر جديد] [+ سند قبض]
```

### Screen 4: Sales Invoices — فواتير المبيعات
```
Route: /sales/invoices
Header: "فواتير المبيعات" + "إصدار وإدارة فواتير المبيعات"
Action: "فاتورة جديدة +" button (blue, top of page)

Summary Cards (2):
  - مبيعات الشهر الحالي: 121,700 ريال (6 فواتير هذا الشهر)
  - الفواتير غير المدفوعة: 51,800 ريال (3 فواتير معلقة أو متأخرة)

Filter: "بحث باسم العميل..." search input

Table: "قائمة الفواتير"
  Columns: ☐ | رقم الفاتورة | العميل | تاريخ الإصدار | تاريخ الاستحقاق | المبلغ (ريال) | الحالة | الإجراءات
  Sample rows:
    INV-2026-001 | شركة التقنية المتقدمة | 2026-03-01 | 2026-03-31 | 15,000 | مدفوعة | عرض
    INV-2026-002 | مؤسسة الإبداع الرقمي | 2026-03-02 | 2026-03-16 | 8,500 | مرسلة | عرض
    INV-2026-003 | شركة المستقبل للتجارة | 2026-03-03 | 2026-04-03 | 22,000 | مدفوعة | عرض
    INV-2026-004 | مؤسسة النجاح للتطوير | 2026-02-20 | 2026-03-05 | 12,300 | متأخرة | عرض
    INV-2026-005 | شركة الأمل للاستثمار | 2026-03-04 | 2026-03-20 | 18,700 | مسودة | عرض
    INV-2026-006 | مؤسسة البناء الحديث | 2026-03-04 | 2026-04-04 | 45,200 | مرسلة | عرض

Pagination: "0 من 6 صف محدد" | السابق | التالي

Empty State: illustration + "لا توجد فواتير بعد" + "أنشئ أول فاتورة" button
```

### Screen 5: Create Invoice — إنشاء فاتورة جديدة
```
Full page form (NOT modal)
Header: "فاتورة جديدة" + [حفظ كمسودة] [إصدار الفاتورة]

Section 1: بيانات العميل
  - اختيار العميل (searchable dropdown) + "عميل جديد +"
  
Section 2: تفاصيل الفاتورة
  - رقم الفاتورة: INV-2026-007 (auto, read-only)
  - تاريخ الإصدار: date picker
  - تاريخ الاستحقاق: date picker
  - المرجع: optional text field

Section 3: البنود (Line Items Table)
  Headers: الصنف | الوصف | الكمية | السعر | الضريبة % | المجموع
  Row: [autocomplete product] [text] [number] [number] [15% default] [calculated]
  "إضافة بند +" button below table
  Supports paste from Excel (UX-2)

Section 4: المجاميع
  المجموع الفرعي: _____ ريال
  ضريبة القيمة المضافة (15%): _____ ريال
  الإجمالي: _____ ريال (bold, large)

Section 5: ملاحظات
  ملاحظات: textarea
  شروط الدفع: dropdown (صافي 30 يوم, صافي 15 يوم, فوري)
```

### Screen 6: Contacts — جهات الاتصال
```
Header: "جهات الاتصال" + "إدارة العملاء والموردين"
Tabs: الكل | عملاء | موردين | موظفين
Action: "إضافة جهة اتصال +" + search

Table columns: الاسم | النوع | البريد | الهاتف | الرصيد | الإجراءات
Types: عميل (blue badge), مورد (green badge), موظف (gray badge)
```

### Screen 7: Chart of Accounts — دليل الحسابات
```
Header: "دليل الحسابات" + "إضافة حساب +"
Tree structure:
  1000 الأصول
  ├── 1100 الأصول المتداولة
  │   ├── 1101 النقدية
  │   ├── 1102 البنك
  │   └── 1103 الذمم المدينة
  ├── 1200 الأصول الثابتة
  2000 الخصوم
  3000 حقوق الملكية
  4000 الإيرادات
  5000 المصروفات

Each row: [expand/collapse] [رقم الحساب] [اسم الحساب] [النوع badge] [الرصيد] [⋮ menu]
Drag to reorder within same level
```

### Screen 8: Journal Entries — قيود اليومية
```
List view:
  Header: "قيود اليومية" + "قيد جديد +"
  Table: رقم القيد | التاريخ | الوصف | إجمالي المدين | إجمالي الدائن | الحالة
  Status: مسودة (gray), مرحّل (green), ملغي (red)

Create view (full page):
  التاريخ + الوصف + المرجع
  Line items: الحساب (searchable) | مركز التكلفة | المدين | الدائن
  Balance indicator: ✅ متوازن or ❌ غير متوازن
  Actions: حفظ كمسودة | ترحيل
```

### Screen 9: Reports — التقارير (COMPREHENSIVE)
```
⚠️ هذه أهم شاشة من ناحية التصميم — يجب أن تعرض 42+ تقرير بشكل منظم

Header: "التقارير" + "تقارير مالية ومحاسبية شاملة"
Action Bar: [🔍 البحث في التقارير...] [🔽 تصفية] [📅 الفترة الزمنية]

Category Tabs (horizontal, scrollable):
  جميع التقارير | تقارير مالية | تقارير موحدة | مبيعات | مشتريات | رواتب | ضرائب | توقعات | للمحاسب | مخزون

Report Cards Grid (3 columns):
  Each card:
  ┌────────────────────────────────────┐
  │  [🔵 icon]  عنوان التقرير  [جديد] │
  │  وصف مختصر للتقرير                 │
  │  [عرض 👁 (blue filled)] [تصدير ⬇ (blue outline)] │
  └────────────────────────────────────┘

Footer Stats:
  إجمالي التقارير: 42 | تقارير مالية: 9 | ضريبية: 3 | جديدة: 4

ZATCA Banner (bottom):
  bg blue gradient, icon ✅
  "متوافق مع هيئة الزكاة والضريبة والجمارك (ZATCA)"
  "جميع التقارير الضريبية متوافقة مع متطلبات الفوترة الإلكترونية"

IMPORTANT: This is NOT 4 simple cards. Design the full 42-report view.
```

### Screen 10: Settings — الإعدادات
```
Header: "الإعدادات" + "إدارة إعدادات الحساب والشركة"

Tabs: بيانات الشركة | المستخدمين | التكاملات | الفواتير والاشتراك | الإشعارات

Tab 1 — بيانات الشركة:
  Form fields (2-column grid):
    الرقم الضريبي: 300000000000003 | اسم الشركة: شركة Entix Books العالمية
    رقم الهاتف: +966 11 511 0150 | السجل التجاري: 1010000000
    العنوان: (full width) 3938 AbMuhammad Ibn Al Mudhaffar, حي الملك فيصل...
  [حفظ التغييرات] button (primary, right-aligned in RTL)

  Section: إعدادات الفوترة الإلكترونية (ZATCA)
    - subtitle: "إعدادات الامتثال للفاتورة الإلكترونية السعودية"
    - تفعيل الفوترة الإلكترونية: [toggle switch ON]
      "الامتثال لمتطلبات هيئة الزكاة والضريبة والجمارك (ZATCA)"
    - CSID (Cryptographic Stamp ID): [input field]
      helper: "المعرف التشفيري الصادر من هيئة الزكاة والضريبة والجمارك"
    - عداد الفواتير الحالي: 000006
      helper: "(ZATCA متطلب) عداد تسلسلي غير قابل لإعادة التعيين"
```

### Screen 11: Purchases Dashboard — الصفحة الرئيسية للمشتريات
```
⚠️ CRITICAL UX: Clicking "المشتريات" in sidebar → opens THIS page
Route: /purchases

Same layout pattern as Sales Dashboard (Screen 3) but purchase-specific:

KPI Cards Row (4 cards — CLICKABLE):
  إجمالي فواتير المشتريات | إجمالي المبالغ | المدفوع (green) | المتأخر (red)
  ↑ Click → navigates to /purchases/bills?status=X

Quick Insights Row (3 mini-cards):
  🏆 أكبر مورد (by amount) | ⚠️ أكثر مورد تأخراً | 🏗️ مشتريات أصول (pending classification)

Filter Bar + Status Tabs:
  [الكل] [مسودات] [مرسلة] [مدفوعة] [متأخرة]

Recent Purchase Bills Table (latest 5-10)
  [عرض جميع فواتير المشتريات →]

Charts Row:
  Left: المشتريات الشهرية (bar chart)
  Right: توزيع حسب المورد (donut chart)

Quick Actions:
  [+ فاتورة مشتريات] [+ سند دفع] [+ مصروف نقدي]
```

### Screen 12: Purchase Bills — فواتير المشتريات
```
Route: /purchases/bills
Mirror layout of Sales Invoices (Screen 4)
Replace: عميل → مورد, مبيعات → مشتريات
Summary: مشتريات الشهر + الفواتير غير المدفوعة

🔥 SMART ASSET DETECTION:
When adding line items, if GL account is under الأصول الثابتة (1200+):
  → System shows inline prompt:
  ┌──────────────────────────────────────────────────────┐
  │ ⚡ هذا البند يبدو كأصل ثابت.                         │
  │ [نعم، سجّل كأصل] [لا، احتفظ كمصروف]                │
  └──────────────────────────────────────────────────────┘
```

### Screen 13: Quotations — عروض الأسعار
```
Route: /sales/quotations
Similar to Invoice List
Status badges: مسودة | مرسل | مقبول | مرفوض | محوّل لفاتورة
Action: "عرض سعر جديد +"
Extra: "تحويل لفاتورة" action on accepted quotations
```

### Screen 14: Fixed Assets — الأصول الثابتة والإهلاك
```
Route: /assets
⚠️ MVP MODULE — not Phase 2

Header: "الأصول الثابتة" + "إدارة الأصول والإهلاك"
Action: "تسجيل أصل جديد +"

KPI Cards Row (4):
  إجمالي الأصول (عدد) | إجمالي التكلفة (ر.س) | الإهلاك المتراكم (ر.س) | صافي القيمة الدفترية (ر.س)

Asset Table:
  Columns: رقم الأصل | اسم الأصل | الفئة | تاريخ الشراء | التكلفة | الإهلاك المتراكم | القيمة الدفترية | الحالة
  Status badges: نشط (green) | مُهلك بالكامل (gray) | مُستبعد (red) | قيد الصيانة (yellow)
  Filters: بحسب الفئة | الموقع | الحالة | فترة الشراء

Asset Detail View (/assets/:id):
  Section 1: معلومات الأصل (name, category, location, purchase date, cost, invoice link)
  Section 2: إعدادات الإهلاك
    - طريقة الإهلاك: dropdown (قسط ثابت | متناقص | وحدات إنتاج | مجموع سنوات)
    - العمر الافتراضي: years input
    - القيمة التخريدية: amount input
    - المعيار: IFRS | GAAP (inherited from company settings)
  Section 3: جدول الإهلاك (table showing monthly/yearly depreciation schedule)
  Section 4: العمليات المرتبطة (linked purchase invoice, maintenance records)

Asset Categories (sidebar filter or tabs):
  مباني | معدات | أثاث | أجهزة حاسب | مركبات | برمجيات | أصول غير ملموسة | تحسينات مستأجرة

Charts Row:
  Left: توزيع الأصول حسب الفئة (donut)
  Right: جدول الإهلاك السنوي (bar chart)

Alert Cards:
  - أصول مُهلكة بالكامل تحتاج مراجعة (count)
  - أصول قاربت على الاستهلاك الكامل (count)
  - إهلاك الشهر الحالي المعلق (amount)
```

---

## 4. Figma File Structure

```
📁 Entix Books Design System
├── 🎨 Tokens (Colors, Typography, Spacing, Shadows)
├── 🧩 Components
│   ├── Sidebar (Light, with all states)
│   ├── Header Bar
│   ├── Buttons (Primary, Secondary, Danger, Ghost, Icon)
│   ├── Stat Cards (standard + clickable/interactive)
│   ├── Quick Insight Cards (mini cards with CTA)
│   ├── Data Tables (with sort, filter states)
│   ├── Status Badges (all statuses)
│   ├── Report Cards
│   ├── Form Inputs (text, select, date, toggle, textarea)
│   ├── Inline Prompts (asset detection, confirmations)
│   ├── Modals (confirmation, error)
│   ├── Toast Notifications
│   └── Empty States
├── 📱 Screens (14 screens)
│   ├── 01-Login (3 variants)
│   ├── 02-Dashboard (main)
│   ├── 03-Sales-Dashboard (module home)
│   ├── 04-Invoice-List (3 variants)
│   ├── 05-Invoice-Create (3 variants)
│   ├── 06-Contacts (3 variants)
│   ├── 07-Chart-of-Accounts
│   ├── 08-Journal-Entries (list + create)
│   ├── 09-Reports (comprehensive, 42 reports)
│   ├── 10-Settings (5 tabs)
│   ├── 11-Purchases-Dashboard (module home)
│   ├── 12-Purchase-Bills (+ asset detection prompt)
│   ├── 13-Quotations
│   └── 14-Fixed-Assets (register + detail + depreciation)
└── 📐 Layout Templates
    ├── Module Dashboard (reusable for Sales/Purchases/etc)
    ├── Page with Sidebar
    ├── Full-page Form
    └── List Page (cards + table)
```

---

## 5. Design Rules

```
✅ RTL FIRST — كل شيء من اليمين لليسار
✅ Arabic is PRIMARY language
✅ Numbers always in Inter font, LTR direction
✅ Sidebar: LIGHT background only (Design Freeze)
✅ Consistent 8px grid system
✅ Every screen has Empty + Active + Error states
✅ Accessibility: minimum 4.5:1 contrast ratio
✅ Responsive: Desktop (1440px) → Tablet (768px) → Mobile (375px)

❌ No dark sidebar background
❌ No decorative elements that add visual noise
❌ No physical positioning (use logical start/end)
❌ No React 19 features
```

---

**© 2026 Falcon Core LLC | Entix Books Design System v1.1**