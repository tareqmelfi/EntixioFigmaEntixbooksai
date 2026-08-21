import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ── Types ──
export type EntityLocation = "local" | "foreign";
export type PartyType = "organization" | "person";
export type RoleType = "عميل" | "مورد" | "موظف" | "فري لانسر" | "مساهم" | "مستثمر";

// ── Dual-language role labels · render via t(ROLE_LABELS[role].ar, ROLE_LABELS[role].en) ──
export const ROLE_LABELS: Record<RoleType, { ar: string; en: string }> = {
  "عميل": { ar: "عميل", en: "Customer" },
  "مورد": { ar: "مورد", en: "Supplier" },
  "موظف": { ar: "موظف", en: "Employee" },
  "فري لانسر": { ar: "فري لانسر", en: "Freelancer" },
  "مساهم": { ar: "مساهم", en: "Shareholder" },
  "مستثمر": { ar: "مستثمر", en: "Investor" },
};

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
// Real organizations start at ZERO contacts (owner rule: no fabricated sample
// data outside the demo company). This legacy store stays only as the home of
// Party/RoleType types + ROLE_LABELS until its last consumer migrates.
const initialParties: Party[] = [];

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
