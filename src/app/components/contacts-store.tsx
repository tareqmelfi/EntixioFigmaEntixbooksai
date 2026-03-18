import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ── Types ──
export type EntityLocation = "local" | "foreign";
export type PartyType = "organization" | "person";
export type RoleType = "عميل" | "مورد" | "موظف" | "فري لانسر" | "مساهم" | "مستثمر";

export interface Party {
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
  netBalance: number;
  contactPersons?: { name: string; role: string; email: string; phone: string }[];
  linkedOrgId?: string;
  // New fields for entity classification
  entityLocation: EntityLocation;
  country?: string;
  currency?: string;
  itn?: string; // International Tax Number (for foreign)
  leiCode?: string; // Legal Entity Identifier
  licenseNumber?: string;
  withholdingTaxRate?: number; // Withholding tax % for foreign entities
  transactionClassification?: string; // For withholding tax reporting
}

// ── Initial Data ──
const initialParties: Party[] = [
  {
    id: "P-001", name: "شركة الاتصالات السعودية", nameEn: "STC", type: "organization",
    roles: ["عميل", "مورد"], email: "corporate@stc.com.sa", phone: "+966 11 218 0000",
    taxNumber: "300000000000003", commercialReg: "1010000001",
    address: "الرياض، طريق الملك فهد", website: "stc.com.sa", netBalance: 205000,
    entityLocation: "local", country: "SA", currency: "SAR",
    contactPersons: [
      { name: "أحمد محمد", role: "مدير المشتريات", email: "ahmed@stc.com.sa", phone: "+966 50 111 2222" },
      { name: "سارة العلي", role: "مدير الحسابات", email: "sara@stc.com.sa", phone: "+966 50 333 4444" },
    ],
  },
  {
    id: "P-002", name: "شركة التقنية المتقدمة", nameEn: "Advanced Tech", type: "organization",
    roles: ["عميل"], email: "info@advanced-tech.sa", phone: "+966 11 222 3333",
    taxNumber: "300000000000015", commercialReg: "1010000022",
    address: "الرياض، حي العليا", netBalance: 150000,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-003", name: "مؤسسة الإبداع الرقمي", nameEn: "Digital Creative", type: "organization",
    roles: ["عميل"], email: "contact@digital-creative.sa", phone: "+966 11 444 5555",
    taxNumber: "300000000000027", address: "جدة، حي الروضة", netBalance: 8500,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-004", name: "شركة المستقبل للتجارة", nameEn: "Future Trade", type: "organization",
    roles: ["عميل", "مورد"], email: "info@future-trade.sa", phone: "+966 11 666 7777",
    taxNumber: "300000000000039", address: "الدمام، حي الفيصلية", netBalance: -12000,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-005", name: "شركة المواد الخام", nameEn: "Raw Materials Co", type: "organization",
    roles: ["مورد"], email: "info@raw-materials.sa", phone: "+966 11 888 9999",
    taxNumber: "300000000000041", address: "الرياض، المنطقة الصناعية", netBalance: -45000,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-006", name: "مؤسسة البناء الحديث", type: "organization",
    roles: ["عميل"], email: "info@modern-build.sa", phone: "+966 11 111 2222",
    taxNumber: "300000000000053", address: "جدة، حي السلامة", netBalance: -18500,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-007", name: "مؤسسة التوريدات", nameEn: "Supplies Est", type: "organization",
    roles: ["مورد"], email: "info@supplies-est.sa", phone: "+966 11 333 4444",
    taxNumber: "300000000000065", address: "الرياض", netBalance: -28500,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-008", name: "شركة الإمدادات", nameEn: "Logistics Co", type: "organization",
    roles: ["مورد"], email: "info@logistics-co.sa", phone: "+966 11 555 6666",
    address: "الرياض", netBalance: -15000,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-009", name: "مؤسسة الخدمات", type: "organization",
    roles: ["مورد"], email: "info@services-est.sa", phone: "+966 11 777 8888",
    address: "الرياض", netBalance: -22000,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-010", name: "شركة التجهيزات", type: "organization",
    roles: ["مورد"], email: "info@equip-co.sa", phone: "+966 11 999 0000",
    address: "الرياض", netBalance: -18500,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-011", name: "مؤسسة النجاح للتطوير", type: "organization",
    roles: ["عميل"], email: "info@najah-dev.sa", phone: "+966 11 333 4444",
    taxNumber: "300000000000065", address: "الرياض، حي الملز", netBalance: 90000,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-012", name: "شركة الأمل للاستثمار", type: "organization",
    roles: ["عميل", "مستثمر"], email: "info@amal-invest.sa", phone: "+966 11 555 6666",
    taxNumber: "300000000000077", address: "الرياض، حي الورود", netBalance: 18700,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-013", name: "شركة الأمل التجارية", type: "organization",
    roles: ["عميل"], email: "info@amal-trade.sa", phone: "+966 11 222 3333",
    address: "الرياض", netBalance: 5000,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  {
    id: "P-014", name: "مؤسسة النور", nameEn: "Al Noor Est", type: "organization",
    roles: ["عميل"], email: "info@alnoor.sa", phone: "+966 11 444 5555",
    address: "جدة", netBalance: 8500,
    entityLocation: "local", country: "SA", currency: "SAR",
  },
  // Foreign entities
  {
    id: "P-100", name: "Google LLC", nameEn: "Google LLC", type: "organization",
    roles: ["مورد"], email: "billing@google.com", phone: "+1 650 253 0000",
    address: "Mountain View, CA, USA", website: "google.com", netBalance: -12000,
    entityLocation: "foreign", country: "US", currency: "USD",
    itn: "61-1767919", leiCode: "HWUPKR0MPOU8FGXBT394",
    withholdingTaxRate: 5, transactionClassification: "خدمات تقنية",
  },
  {
    id: "P-101", name: "Microsoft Corporation", nameEn: "Microsoft Corporation", type: "organization",
    roles: ["مورد"], email: "billing@microsoft.com", phone: "+1 425 882 8080",
    address: "Redmond, WA, USA", website: "microsoft.com", netBalance: -8500,
    entityLocation: "foreign", country: "US", currency: "USD",
    itn: "91-1144442", leiCode: "INR2EJN1ERAN0W5ZP974",
    withholdingTaxRate: 5, transactionClassification: "تراخيص برمجية",
  },
  {
    id: "P-102", name: "Amazon Web Services", nameEn: "AWS", type: "organization",
    roles: ["مورد"], email: "aws-billing@amazon.com", phone: "+1 206 266 1000",
    address: "Seattle, WA, USA", website: "aws.amazon.com", netBalance: -15000,
    entityLocation: "foreign", country: "US", currency: "USD",
    itn: "91-1646860", withholdingTaxRate: 5, transactionClassification: "خدمات سحابية",
  },
];

// ── Context ──
interface ContactsContextType {
  parties: Party[];
  addParty: (party: Omit<Party, "id">) => Party;
  updateParty: (id: string, updates: Partial<Party>) => void;
  searchParties: (query: string, roleFilter?: RoleType) => Party[];
  getPartyById: (id: string) => Party | undefined;
  getPartyByName: (name: string) => Party | undefined;
}

const ContactsContext = createContext<ContactsContextType | null>(null);

export function ContactsProvider({ children }: { children: ReactNode }) {
  const [partiesList, setPartiesList] = useState<Party[]>(initialParties);

  const addParty = useCallback((partyData: Omit<Party, "id">): Party => {
    const newId = `P-${String(partiesList.length + 200).padStart(3, "0")}`;
    const newParty: Party = { ...partyData, id: newId };
    setPartiesList((prev) => [...prev, newParty]);
    return newParty;
  }, [partiesList.length]);

  const updateParty = useCallback((id: string, updates: Partial<Party>) => {
    setPartiesList((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const searchParties = useCallback((query: string, roleFilter?: RoleType): Party[] => {
    if (!query.trim()) return roleFilter ? partiesList.filter((p) => p.roles.includes(roleFilter)) : partiesList;
    const q = query.toLowerCase().trim();
    return partiesList.filter((p) => {
      const matchesQuery = p.name.toLowerCase().includes(q) ||
        (p.nameEn?.toLowerCase().includes(q)) ||
        p.email.toLowerCase().includes(q) ||
        (p.taxNumber?.includes(q)) ||
        (p.commercialReg?.includes(q)) ||
        (p.leiCode?.toLowerCase().includes(q));
      const matchesRole = !roleFilter || p.roles.includes(roleFilter);
      return matchesQuery && matchesRole;
    });
  }, [partiesList]);

  const getPartyById = useCallback((id: string) => partiesList.find((p) => p.id === id), [partiesList]);
  const getPartyByName = useCallback((name: string) => partiesList.find((p) => p.name === name || p.nameEn === name), [partiesList]);

  return (
    <ContactsContext.Provider value={{ parties: partiesList, addParty, updateParty, searchParties, getPartyById, getPartyByName }}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) throw new Error("useContacts must be used within ContactsProvider");
  return ctx;
}
