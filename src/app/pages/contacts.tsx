import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Users, Plus, Search, Phone, Mail, Building2, User, ExternalLink,
  X, ChevronLeft, ChevronRight, Filter, Download, Eye, MoreVertical,
  Briefcase, UserCheck, Landmark, Award, Edit2, Copy, Trash2, Merge, CheckSquare
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

// ── Role definitions ──
type RoleType = "عميل" | "مورد" | "موظف" | "فري لانسر" | "مساهم" | "مستثمر";
type PartyType = "organization" | "person";

interface ContactPerson {
  name: string;
  role: string;
  email: string;
  phone: string;
}

interface Party {
  id: string;
  name: string;
  nameEn?: string;
  type: PartyType;
  roles: RoleType[];
  email: string;
  phone: string;
  taxNumber?: string;
  commercialReg?: string;
  address?: string;
  website?: string;
  netBalance: number; // positive = they owe us, negative = we owe them
  avatar?: string;
  contactPersons?: ContactPerson[];
  linkedOrgId?: string; // for persons linked to an org
}

const roleBadgeStyles: Record<RoleType, string> = {
  "عميل": "bg-[#DBEAFE] text-[#1E40AF]",
  "مورد": "bg-[#DCFCE7] text-[#166534]",
  "موظف": "bg-[#F3E8FF] text-[#6B21A8]",
  "فري لانسر": "bg-[#FEF3C7] text-[#92400E]",
  "مساهم": "bg-[#E0F2FE] text-[#075985]",
  "مستثمر": "bg-[#FCE7F3] text-[#9D174D]",
};

const roleIcons: Record<RoleType, typeof Users> = {
  "عميل": Users,
  "مورد": Building2,
  "موظف": Briefcase,
  "فري لانسر": UserCheck,
  "مساهم": Landmark,
  "مستثمر": Award,
};

// ── Mock Data (Party Model) ──
const parties: Party[] = [
  {
    id: "P-001",
    name: "شركة الاتصالات السعودية",
    nameEn: "STC",
    type: "organization",
    roles: ["عميل", "مورد"],
    email: "corporate@stc.com.sa",
    phone: "+966 11 218 0000",
    taxNumber: "300000000000003",
    commercialReg: "1010000001",
    address: "الرياض، طريق الملك فهد",
    website: "stc.com.sa",
    netBalance: 205000,
    contactPersons: [
      { name: "أحمد محمد", role: "مدير المشتريات", email: "ahmed@stc.com.sa", phone: "+966 50 111 2222" },
      { name: "سارة العلي", role: "مدير الحسابات", email: "sara@stc.com.sa", phone: "+966 50 333 4444" },
    ],
  },
  {
    id: "P-002",
    name: "شركة التقنية المتقدمة",
    nameEn: "Advanced Tech",
    type: "organization",
    roles: ["عميل"],
    email: "info@advanced-tech.sa",
    phone: "+966 11 222 3333",
    taxNumber: "300000000000015",
    commercialReg: "1010000022",
    address: "الرياض، حي العليا",
    netBalance: 150000,
  },
  {
    id: "P-003",
    name: "مؤسسة الإبداع الرقمي",
    nameEn: "Digital Creative",
    type: "organization",
    roles: ["عميل"],
    email: "contact@digital-creative.sa",
    phone: "+966 11 444 5555",
    taxNumber: "300000000000027",
    address: "جدة، حي الروضة",
    netBalance: 8500,
  },
  {
    id: "P-004",
    name: "شركة المستقبل للتجارة",
    nameEn: "Future Trade",
    type: "organization",
    roles: ["عميل", "مورد"],
    email: "info@future-trade.sa",
    phone: "+966 11 666 7777",
    taxNumber: "300000000000039",
    address: "الدمام، حي الفيصلية",
    netBalance: -12000,
  },
  {
    id: "P-005",
    name: "شركة الإمدادات الصناعية",
    nameEn: "Industrial Supplies",
    type: "organization",
    roles: ["مورد"],
    email: "info@industrial-supplies.sa",
    phone: "+966 11 888 9999",
    taxNumber: "300000000000041",
    address: "الرياض، المنطقة الصناعية",
    netBalance: -45000,
  },
  {
    id: "P-006",
    name: "مؤسسة التوريدات الشاملة",
    type: "organization",
    roles: ["مورد"],
    email: "contact@comprehensive-supplies.sa",
    phone: "+966 11 111 2222",
    taxNumber: "300000000000053",
    address: "جدة، حي السلامة",
    netBalance: -18500,
  },
  {
    id: "P-007",
    name: "طارق ملفي",
    type: "person",
    roles: ["موظف", "مساهم"],
    email: "tariq@entix.io",
    phone: "+966 50 555 6666",
    address: "الرياض",
    netBalance: 0,
  },
  {
    id: "P-008",
    name: "عبدالله السعيد",
    type: "person",
    roles: ["فري لانسر"],
    email: "abdullah.s@freelance.sa",
    phone: "+966 55 777 8888",
    address: "الرياض",
    netBalance: -3500,
  },
  {
    id: "P-009",
    name: "نورة الشمري",
    type: "person",
    roles: ["موظف"],
    email: "noura@entix.io",
    phone: "+966 50 999 0000",
    address: "الرياض",
    netBalance: 0,
  },
  {
    id: "P-010",
    name: "خالد العتيبي",
    type: "person",
    roles: ["فري لانسر", "مورد"],
    email: "khalid.o@design.sa",
    phone: "+966 55 123 4567",
    address: "جدة",
    netBalance: -7200,
  },
  {
    id: "P-011",
    name: "مؤسسة النجاح للتطوير",
    type: "organization",
    roles: ["عميل"],
    email: "info@najah-dev.sa",
    phone: "+966 11 333 4444",
    taxNumber: "300000000000065",
    address: "الرياض، حي الملز",
    netBalance: 90000,
  },
  {
    id: "P-012",
    name: "شركة الأمل للاستثمار",
    type: "organization",
    roles: ["عميل", "مستثمر"],
    email: "info@amal-invest.sa",
    phone: "+966 11 555 6666",
    taxNumber: "300000000000077",
    address: "الرياض، حي الورود",
    netBalance: 18700,
  },
];

// ── Helper Functions ──
function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) return parts[0].charAt(0) + parts[1].charAt(0);
  return name.substring(0, 2);
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-[#0B1B49]", "bg-[#1276E3]", "bg-[#179FC5]",
    "bg-[#6B21A8]", "bg-[#166534]", "bg-[#92400E]",
    "bg-[#9D174D]", "bg-[#1E40AF]", "bg-[#075985]",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatBalance(balance: number): { text: string; color: string } {
  if (balance === 0) return { text: "—", color: "text-[#6B7280]" };
  const abs = Math.abs(balance).toLocaleString();
  if (balance > 0) return { text: `+${abs}`, color: "text-[#0B1A47]" };
  return { text: `-${abs}`, color: "text-[#349FC4]" };
}

// ── Role Tabs ──
const roleTabs: { label: string; role: RoleType | "الكل" }[] = [
  { label: "الكل", role: "الكل" },
  { label: "عملاء", role: "عميل" },
  { label: "موردين", role: "مورد" },
  { label: "موظفين", role: "موظف" },
  { label: "فري لانسر", role: "فري لانسر" },
  { label: "مساهمين", role: "مساهم" },
];

// ── Type Filters ──
const typeFilters: { label: string; icon: typeof Building2; value: PartyType | "all" }[] = [
  { label: "الكل", icon: Users, value: "all" },
  { label: "منظمات", icon: Building2, value: "organization" },
  { label: "أفراد", icon: User, value: "person" },
];

// ── Add Contact Modal Steps ──
type AddStep = "type" | "info" | "roles" | "details";

interface NewPartyForm {
  type: PartyType | null;
  name: string;
  nameEn: string;
  email: string;
  phone: string;
  taxNumber: string;
  commercialReg: string;
  address: string;
  website: string;
  roles: RoleType[];
}

const emptyForm: NewPartyForm = {
  type: null, name: "", nameEn: "", email: "", phone: "",
  taxNumber: "", commercialReg: "", address: "", website: "", roles: [],
};

const CUR = "SR";

export function Contacts() {
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<RoleType | "الكل">("الكل");
  const [activeType, setActiveType] = useState<PartyType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState<AddStep>("type");
  const [newParty, setNewParty] = useState<NewPartyForm>({ ...emptyForm });
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) setActionMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(p => p.id)));
  };

  // ── Filtering ──
  const filtered = parties.filter((p) => {
    if (activeRole !== "الكل" && !p.roles.includes(activeRole)) return false;
    if (activeType !== "all" && p.type !== activeType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.includes(q) ||
        (p.nameEn?.toLowerCase().includes(q)) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.taxNumber?.includes(q))
      );
    }
    return true;
  });

  // ── Counts ──
  const counts = {
    "الكل": parties.length,
    "عميل": parties.filter((p) => p.roles.includes("عميل")).length,
    "مورد": parties.filter((p) => p.roles.includes("مورد")).length,
    "موظف": parties.filter((p) => p.roles.includes("موظف")).length,
    "فري لانسر": parties.filter((p) => p.roles.includes("فري لانسر")).length,
    "مساهم": parties.filter((p) => p.roles.includes("مساهم")).length,
  };

  const orgCount = parties.filter((p) => p.type === "organization").length;
  const personCount = parties.filter((p) => p.type === "person").length;

  // ── Add Contact Handlers ──
  function openAddModal() {
    setNewParty({ ...emptyForm });
    setAddStep("type");
    setShowAddModal(true);
  }

  function toggleRole(role: RoleType) {
    setNewParty((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  }

  function handleSaveParty() {
    // In real app, save to backend
    setShowAddModal(false);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#0B1B49]" style={{ fontSize: "1.875rem", fontWeight: 700 }}>جهات الاتصال</h1>
          <p className="text-[#6B7280] mt-1">إدارة جميع الأطراف ذات العلاقة</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-lg bg-[#1276E3] px-4 py-2.5 text-white text-sm transition-colors hover:bg-[#0F63C3]"
          style={{ fontWeight: 500 }}
        >
          <Plus className="h-4 w-4" />
          إضافة جهة
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="border-[#E5E7EB] cursor-pointer hover:shadow-md hover:border-[#1276E3]/30 transition-all"
          onClick={() => { setActiveRole("الكل"); setActiveType("all"); }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-[#6B7280]" style={{ fontWeight: 500 }}>إجمالي جهات الاتصال</CardTitle>
            <Users className="h-5 w-5 text-[#6B7280]" />
          </CardHeader>
          <CardContent>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{parties.length}</div>
            <p className="text-xs text-[#6B7280] mt-1">{orgCount} منظمة · {personCount} فرد</p>
          </CardContent>
        </Card>

        <Card
          className="border-[#E5E7EB] cursor-pointer hover:shadow-md hover:border-[#1276E3]/30 transition-all"
          onClick={() => { setActiveRole("عميل"); setActiveType("all"); }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-[#6B7280]" style={{ fontWeight: 500 }}>العملاء</CardTitle>
            <Users className="h-5 w-5 text-[#1276E3]" />
          </CardHeader>
          <CardContent>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{counts["عميل"]}</div>
            <p className="text-xs text-[#0B1A47] mt-1">
              مستحقات: <span dir="ltr" className="font-english">{parties.filter(p => p.roles.includes("عميل") && p.netBalance > 0).reduce((s, p) => s + p.netBalance, 0).toLocaleString()} {CUR}</span>
            </p>
          </CardContent>
        </Card>

        <Card
          className="border-[#E5E7EB] cursor-pointer hover:shadow-md hover:border-[#1276E3]/30 transition-all"
          onClick={() => { setActiveRole("مورد"); setActiveType("all"); }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-[#6B7280]" style={{ fontWeight: 500 }}>الموردين</CardTitle>
            <Building2 className="h-5 w-5 text-[#349FC4]" />
          </CardHeader>
          <CardContent>
            <div className="text-[#0B1B49] font-english" style={{ fontSize: "1.75rem", fontWeight: 700 }}>{counts["مورد"]}</div>
            <p className="text-xs text-[#349FC4] mt-1">
              مستحقات عليك: <span dir="ltr" className="font-english">{Math.abs(parties.filter(p => p.roles.includes("مورد") && p.netBalance < 0).reduce((s, p) => s + p.netBalance, 0)).toLocaleString()} {CUR}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#E5E7EB] cursor-pointer hover:shadow-md hover:border-[#1276E3]/30 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-[#6B7280]" style={{ fontWeight: 500 }}>صافي الرصيد</CardTitle>
            <Landmark className="h-5 w-5 text-[#6B7280]" />
          </CardHeader>
          <CardContent>
            {(() => {
              const net = parties.reduce((s, p) => s + p.netBalance, 0);
              const { text, color } = formatBalance(net);
              return (
                <>
                  <span dir="ltr" className={`inline-flex items-baseline gap-1 font-english ${color}`} style={{ fontSize: "1.75rem", fontWeight: 700 }}>
                    {text}
                    <span className="font-english" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{CUR}</span>
                  </span>
                  <p className="text-xs text-[#6B7280] mt-1">{net > 0 ? "لصالحك" : net < 0 ? "عليك" : "متوازن"}</p>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Filter / Search Bar */}
      <Card className="border-[#E5E7EB]">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col gap-4">
            {/* Search + Actions Row */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[250px] max-w-[400px]">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
                <Input
                  placeholder="بحث بالاسم، الرقم الضريبي، البريد، الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10 border-[#E5E7EB]"
                />
              </div>
              <div className="flex items-center gap-2">
                {/* Type Toggle */}
                <div className="flex items-center rounded-lg border border-[#E5E7EB] overflow-hidden">
                  {typeFilters.map((tf) => {
                    const Icon = tf.icon;
                    return (
                      <button
                        key={tf.value}
                        onClick={() => setActiveType(tf.value)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                          activeType === tf.value
                            ? "bg-[#0B1B49] text-white"
                            : "bg-white text-[#374151] hover:bg-[#F3F4F6]"
                        }`}
                        style={{ fontWeight: 500 }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {tf.label}
                      </button>
                    );
                  })}
                </div>
                <button className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs text-[#374151] hover:bg-[#F3F4F6] transition-colors" style={{ fontWeight: 500 }}>
                  <Filter className="h-3.5 w-3.5" />
                  تصفية
                </button>
                <button className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs text-[#374151] hover:bg-[#F3F4F6] transition-colors" style={{ fontWeight: 500 }}>
                  <Download className="h-3.5 w-3.5" />
                  تصدير
                </button>
              </div>
            </div>

            {/* Role Tabs */}
            <div className="flex gap-2 flex-wrap">
              {roleTabs.map((tab) => {
                const count = counts[tab.role as keyof typeof counts] ?? 0;
                return (
                  <button
                    key={tab.role}
                    onClick={() => setActiveRole(tab.role)}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                      activeRole === tab.role
                        ? "bg-[#1276E3] text-white"
                        : "bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]"
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {tab.label} <span className="font-english">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card className="border-[#E5E7EB]">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[#0B1B49]">
              جهات الاتصال <span className="text-[#6B7280] font-english" style={{ fontWeight: 400 }}>({filtered.length})</span>
            </CardTitle>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6B7280]">تم تحديد <span className="font-english text-[#1276E3]" style={{ fontWeight: 600 }}>{selectedIds.size}</span></span>
                <div className="relative">
                  <button
                    onClick={() => setShowBulkMenu(!showBulkMenu)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1276E3] px-3 py-1.5 text-xs text-white hover:bg-[#0F63C3] transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    إجراء جماعي
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  {showBulkMenu && (
                    <div className="absolute end-0 z-40 mt-1 w-44 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                      <button onClick={() => { setShowBulkMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Merge className="h-3.5 w-3.5 text-[#6B7280]" />دمج الجهات</button>
                      <button onClick={() => { setShowBulkMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Download className="h-3.5 w-3.5 text-[#6B7280]" />تصدير المحدد</button>
                      <div className="border-t border-[#F3F4F6] my-1" />
                      <button onClick={() => { setShowBulkMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30 text-start"><Trash2 className="h-3.5 w-3.5" />حذف المحدد</button>
                    </div>
                  )}
                </div>
                <button onClick={() => setSelectedIds(new Set())} className="rounded-md p-1 text-[#6B7280] hover:bg-[#F3F4F6]"><X className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: "850px", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "40px" }} />
                <col />
                <col style={{ width: "120px" }} />
                <col style={{ width: "200px" }} />
                <col style={{ width: "140px" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "50px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="py-2.5 pe-2 text-start">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-[#1276E3] accent-[#1276E3] cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الاسم</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الأدوار</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>البريد</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>الهاتف</th>
                  <th className="py-2.5 pe-3 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>صافي الرصيد</th>
                  <th className="py-2.5 text-start text-xs text-[#6B7280]" style={{ fontWeight: 600 }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="h-12 w-12 text-[#9CA3AF]" />
                        <p className="text-sm text-[#6B7280]">لا توجد جهات اتصال مطابقة</p>
                        <button
                          onClick={openAddModal}
                          className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm text-[#1276E3] hover:bg-[#F4FCFF] transition-colors"
                          style={{ fontWeight: 500 }}
                        >
                          <Plus className="h-4 w-4" />
                          إضافة جهة اتصال
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((party) => {
                    const bal = formatBalance(party.netBalance);
                    const isSelected = selectedIds.has(party.id);
                    return (
                      <tr
                        key={party.id}
                        className={`border-b border-[#F3F4F6] last:border-0 hover:bg-[#F4FCFF] cursor-pointer transition-colors ${isSelected ? "bg-[#EFF6FF]" : ""}`}
                        onClick={() => navigate(`/contacts/${party.id}`)}
                      >
                        <td className="py-3 pe-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(party.id)}
                            className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-[#1276E3] accent-[#1276E3] cursor-pointer"
                          />
                        </td>
                        <td className="py-3 pe-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarFallback className={`${getAvatarColor(party.name)} text-white text-sm`} style={{ fontWeight: 600 }}>
                                {getInitials(party.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="text-sm text-[#0B1B49] truncate" style={{ fontWeight: 600 }}>{party.name}</div>
                              {party.nameEn && (
                                <div className="text-xs text-[#9CA3AF] font-english truncate">{party.nameEn}</div>
                              )}
                              {party.type === "organization" && party.taxNumber && (
                                <div className="text-xs text-[#9CA3AF] font-english">ض: {party.taxNumber.substring(0, 6)}...</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pe-3">
                          <div className="flex flex-wrap gap-1">
                            {party.roles.map((role) => (
                              <span
                                key={role}
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${roleBadgeStyles[role]}`}
                                style={{ fontWeight: 600 }}
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 pe-3">
                          <span className="text-sm text-[#374151] font-english truncate block">{party.email}</span>
                        </td>
                        <td className="py-3 pe-3">
                          <span className="text-sm text-[#374151] font-english">{party.phone}</span>
                        </td>
                        <td className="py-3 pe-3">
                          <span dir="ltr" className="inline-flex items-baseline gap-0.5">
                            <span className={`text-sm font-english ${bal.color}`} style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{bal.text}</span>
                            {party.netBalance !== 0 && <span className="text-[10px] text-[#9CA3AF] font-english" style={{ fontWeight: 500 }}>{CUR}</span>}
                          </span>
                        </td>
                        {/* Three-dot menu */}
                        <td className="py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="relative" ref={actionMenuId === party.id ? actionMenuRef : undefined}>
                            <button
                              onClick={() => setActionMenuId(actionMenuId === party.id ? null : party.id)}
                              className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {actionMenuId === party.id && (
                              <div className="absolute end-0 z-40 mt-1 w-40 rounded-lg border border-[#E5E7EB] bg-white shadow-lg py-1">
                                <button onClick={() => { setActionMenuId(null); navigate(`/contacts/${party.id}`); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Eye className="h-3.5 w-3.5 text-[#6B7280]" />عرض</button>
                                <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Edit2 className="h-3.5 w-3.5 text-[#6B7280]" />تعديل سريع</button>
                                <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Copy className="h-3.5 w-3.5 text-[#6B7280]" />نسخ</button>
                                <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start"><Merge className="h-3.5 w-3.5 text-[#6B7280]" />دمج مع...</button>
                                <div className="border-t border-[#F3F4F6] my-1" />
                                <button onClick={() => setActionMenuId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEE2E2]/30 text-start"><Trash2 className="h-3.5 w-3.5" />حذف</button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F3F4F6]">
              <p className="text-xs text-[#6B7280]">عرض <span className="font-english">{filtered.length}</span> من <span className="font-english">{parties.length}</span> جهة اتصال</p>
              <div className="flex items-center gap-1">
                <button className="rounded-md border border-[#E5E7EB] px-3 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6] transition-colors" style={{ fontWeight: 500 }}>السابق</button>
                <button className="rounded-md bg-[#1276E3] px-3 py-1 text-xs text-white" style={{ fontWeight: 500 }}>
                  <span className="font-english">1</span>
                </button>
                <button className="rounded-md border border-[#E5E7EB] px-3 py-1 text-xs text-[#6B7280] hover:bg-[#F3F4F6] transition-colors" style={{ fontWeight: 500 }}>التالي</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add Contact Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <h2 className="text-[#0B1B49]" style={{ fontSize: "1.125rem", fontWeight: 600 }}>إضافة جهة اتصال</h2>
              <button onClick={() => setShowAddModal(false)} className="rounded-md p-1 text-[#6B7280] hover:bg-[#F3F4F6]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Steps Indicator */}
            <div className="flex items-center justify-center gap-2 px-6 py-3 border-b border-[#F3F4F6]">
              {(["type", "info", "roles", "details"] as AddStep[]).map((step, i) => {
                const labels = ["النوع", "البيانات", "الأدوار", "التفاصيل"];
                const isActive = addStep === step;
                const stepIndex = ["type", "info", "roles", "details"].indexOf(addStep);
                const isPast = i < stepIndex;
                return (
                  <div key={step} className="flex items-center gap-2">
                    {i > 0 && <div className={`w-8 h-px ${isPast ? "bg-[#1276E3]" : "bg-[#E5E7EB]"}`} />}
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-english ${
                        isActive ? "bg-[#1276E3] text-white" : isPast ? "bg-[#DBEAFE] text-[#1276E3]" : "bg-[#F3F4F6] text-[#9CA3AF]"
                      }`} style={{ fontWeight: 600 }}>{i + 1}</div>
                      <span className={`text-xs ${isActive ? "text-[#0B1B49]" : "text-[#9CA3AF]"}`} style={{ fontWeight: 500 }}>{labels[i]}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-5">
              {/* Step 1: Type Selection */}
              {addStep === "type" && (
                <div className="space-y-4">
                  <p className="text-sm text-[#374151]" style={{ fontWeight: 500 }}>هل هي منظمة أم فرد؟</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => { setNewParty((p) => ({ ...p, type: "organization" })); setAddStep("info"); }}
                      className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all hover:border-[#1276E3] hover:bg-[#F4FCFF] ${
                        newParty.type === "organization" ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB]"
                      }`}
                    >
                      <div className="w-14 h-14 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                        <Building2 className="h-7 w-7 text-[#1276E3]" />
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>منظمة</div>
                        <div className="text-xs text-[#6B7280] mt-1">شركة أو مؤسسة</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setNewParty((p) => ({ ...p, type: "person" })); setAddStep("info"); }}
                      className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all hover:border-[#1276E3] hover:bg-[#F4FCFF] ${
                        newParty.type === "person" ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB]"
                      }`}
                    >
                      <div className="w-14 h-14 rounded-full bg-[#F3E8FF] flex items-center justify-center">
                        <User className="h-7 w-7 text-[#6B21A8]" />
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>فرد</div>
                        <div className="text-xs text-[#6B7280] mt-1">شخص طبيعي</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Basic Info */}
              {addStep === "info" && (
                <div className="space-y-4">
                  <p className="text-sm text-[#374151]" style={{ fontWeight: 500 }}>
                    {newParty.type === "organization" ? "بيانات المنظمة" : "بيانات الشخص"}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-[#374151] mb-1 block" style={{ fontWeight: 500 }}>
                        {newParty.type === "organization" ? "اسم المنظمة" : "الاسم الكامل"} *
                      </label>
                      <Input
                        value={newParty.name}
                        onChange={(e) => setNewParty((p) => ({ ...p, name: e.target.value }))}
                        placeholder={newParty.type === "organization" ? "مثال: شركة التقنية المتقدمة" : "مثال: أحمد محمد"}
                        className="border-[#E5E7EB]"
                      />
                    </div>
                    {newParty.type === "organization" && (
                      <div>
                        <label className="text-xs text-[#374151] mb-1 block" style={{ fontWeight: 500 }}>الاسم بالإنجليزية</label>
                        <Input
                          value={newParty.nameEn}
                          onChange={(e) => setNewParty((p) => ({ ...p, nameEn: e.target.value }))}
                          placeholder="e.g. Advanced Tech Co."
                          className="border-[#E5E7EB] font-english"
                          dir="ltr"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-[#374151] mb-1 block" style={{ fontWeight: 500 }}>البريد الإلكتروني</label>
                        <Input
                          value={newParty.email}
                          onChange={(e) => setNewParty((p) => ({ ...p, email: e.target.value }))}
                          placeholder="email@example.com"
                          className="border-[#E5E7EB] font-english"
                          dir="ltr"
                          type="email"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-[#374151] mb-1 block" style={{ fontWeight: 500 }}>رقم الهاتف</label>
                        <Input
                          value={newParty.phone}
                          onChange={(e) => setNewParty((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="+966 5X XXX XXXX"
                          className="border-[#E5E7EB] font-english"
                          dir="ltr"
                        />
                      </div>
                    </div>
                    {newParty.type === "organization" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-[#374151] mb-1 block" style={{ fontWeight: 500 }}>الرقم الضريبي</label>
                          <Input
                            value={newParty.taxNumber}
                            onChange={(e) => setNewParty((p) => ({ ...p, taxNumber: e.target.value }))}
                            placeholder="300XXXXXXXXX003"
                            className="border-[#E5E7EB] font-english"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#374151] mb-1 block" style={{ fontWeight: 500 }}>السجل التجاري</label>
                          <Input
                            value={newParty.commercialReg}
                            onChange={(e) => setNewParty((p) => ({ ...p, commercialReg: e.target.value }))}
                            placeholder="1010XXXXXX"
                            className="border-[#E5E7EB] font-english"
                            dir="ltr"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Roles Selection */}
              {addStep === "roles" && (
                <div className="space-y-4">
                  <p className="text-sm text-[#374151]" style={{ fontWeight: 500 }}>اختر الأدوار (يمكن اختيار أكثر من دور)</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["عميل", "مورد", "موظف", "فري لانسر", "مساهم", "مستثمر"] as RoleType[]).map((role) => {
                      const isSelected = newParty.roles.includes(role);
                      const Icon = roleIcons[role];
                      return (
                        <button
                          key={role}
                          onClick={() => toggleRole(role)}
                          className={`flex items-center gap-3 rounded-lg border-2 p-3 text-start transition-all ${
                            isSelected ? "border-[#1276E3] bg-[#F4FCFF]" : "border-[#E5E7EB] hover:border-[#1276E3]/30"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isSelected ? "bg-[#1276E3] text-white" : "bg-[#F3F4F6] text-[#6B7280]"
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm text-[#0B1B49]" style={{ fontWeight: 500 }}>{role}</div>
                          </div>
                          {isSelected && (
                            <div className="ms-auto w-5 h-5 rounded-full bg-[#1276E3] flex items-center justify-center">
                              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Additional Details */}
              {addStep === "details" && (
                <div className="space-y-4">
                  <p className="text-sm text-[#374151]" style={{ fontWeight: 500 }}>تفاصيل إضافية</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-[#374151] mb-1 block" style={{ fontWeight: 500 }}>العنوان</label>
                      <Input
                        value={newParty.address}
                        onChange={(e) => setNewParty((p) => ({ ...p, address: e.target.value }))}
                        placeholder="المدينة، الحي، الشارع"
                        className="border-[#E5E7EB]"
                      />
                    </div>
                    {newParty.type === "organization" && (
                      <div>
                        <label className="text-xs text-[#374151] mb-1 block" style={{ fontWeight: 500 }}>الموقع الإلكتروني</label>
                        <Input
                          value={newParty.website}
                          onChange={(e) => setNewParty((p) => ({ ...p, website: e.target.value }))}
                          placeholder="example.com"
                          className="border-[#E5E7EB] font-english"
                          dir="ltr"
                        />
                      </div>
                    )}

                    {/* Summary Preview */}
                    <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4 mt-4">
                      <p className="text-xs text-[#6B7280] mb-3" style={{ fontWeight: 600 }}>معاينة</p>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className={`${getAvatarColor(newParty.name || "جهة")} text-white`} style={{ fontWeight: 600 }}>
                            {getInitials(newParty.name || "جهة جديدة")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm text-[#0B1B49]" style={{ fontWeight: 600 }}>{newParty.name || "اسم الجهة"}</div>
                          <div className="flex gap-1 mt-1">
                            {newParty.roles.map((role) => (
                              <span key={role} className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${roleBadgeStyles[role]}`} style={{ fontWeight: 600 }}>
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB]">
              <button
                onClick={() => {
                  const steps: AddStep[] = ["type", "info", "roles", "details"];
                  const idx = steps.indexOf(addStep);
                  if (idx > 0) setAddStep(steps[idx - 1]);
                  else setShowAddModal(false);
                }}
                className="flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                style={{ fontWeight: 500 }}
              >
                {addStep === "type" ? "إلغاء" : (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    السابق
                  </>
                )}
              </button>

              {addStep === "details" ? (
                <button
                  onClick={handleSaveParty}
                  className="rounded-lg bg-[#1276E3] px-5 py-2 text-sm text-white hover:bg-[#0F63C3] transition-colors"
                  style={{ fontWeight: 500 }}
                >
                  حفظ جهة الاتصال
                </button>
              ) : (
                <button
                  onClick={() => {
                    const steps: AddStep[] = ["type", "info", "roles", "details"];
                    const idx = steps.indexOf(addStep);
                    if (idx < steps.length - 1) setAddStep(steps[idx + 1]);
                  }}
                  disabled={addStep === "type" && !newParty.type}
                  className="flex items-center gap-1 rounded-lg bg-[#1276E3] px-4 py-2 text-sm text-white hover:bg-[#0F63C3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontWeight: 500 }}
                >
                  التالي
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}