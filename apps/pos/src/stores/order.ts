import { create } from 'zustand';

export type CartLine = {
  id: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitPrice: bigint;
  quantity: number;
  modifiersTotal: bigint;
  notes: string | null;
};

export type HoldEntry = {
  id: string;
  label: string;
  heldAt: number;
  tableId: string | null;
  pricingProfile: 'dine_in' | 'take_away' | 'delivery' | 'happy_hour';
  customerName: string | null;
  guestCount: number | null;
  notes: string | null;
  discountSen: string | null;
  discountReason: string | null;
  // bigint isn't JSON-safe; store unitPrice/modifiersTotal as strings.
  lines: Array<{
    id: string;
    menuItemId: string;
    itemNameSnapshot: string;
    unitPrice: string;
    quantity: number;
    modifiersTotal: string;
    notes: string | null;
  }>;
};

export type OrderDraftState = {
  outletId: string | null;
  shiftId: string | null;
  tableId: string | null;
  pricingProfile: 'dine_in' | 'take_away' | 'delivery' | 'happy_hour';
  customerName: string | null;
  guestCount: number | null;
  lines: CartLine[];
  notes: string | null;
  discountSen: bigint | null;
  discountReason: string | null;
  activeOrderId: string | null;
  holds: HoldEntry[];

  setOutlet: (id: string) => void;
  setShift: (id: string | null) => void;
  setTable: (id: string | null) => void;
  setPricingProfile: (p: OrderDraftState['pricingProfile']) => void;
  addLine: (line: CartLine) => void;
  updateLine: (id: string, patch: Partial<CartLine>) => void;
  removeLine: (id: string) => void;
  setDiscount: (sen: bigint, reason: string) => void;
  clearDiscount: () => void;
  setActiveOrderId: (id: string | null) => void;
  clear: () => void;
  hold: (label: string) => void;
  resume: (id: string) => void;
  removeHold: (id: string) => void;
};

const HOLDS_KEY = 'desain.pos.holds';

function loadHolds(): HoldEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HOLDS_KEY);
    return raw ? (JSON.parse(raw) as HoldEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHolds(holds: HoldEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(HOLDS_KEY, JSON.stringify(holds));
  } catch {
    /* quota or sandbox */
  }
}

export const useOrderDraftStore = create<OrderDraftState>((set, get) => ({
  outletId: null,
  shiftId: null,
  tableId: null,
  pricingProfile: 'dine_in',
  customerName: null,
  guestCount: null,
  lines: [],
  notes: null,
  discountSen: null,
  discountReason: null,
  activeOrderId: null,
  holds: loadHolds(),

  setOutlet: (id) => set({ outletId: id }),
  setShift: (id) => set({ shiftId: id }),
  setTable: (id) => set({ tableId: id }),
  setPricingProfile: (p) => set({ pricingProfile: p }),
  addLine: (line) => set((s) => ({ lines: [...s.lines, line] })),
  updateLine: (id, patch) =>
    set((s) => ({ lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
  removeLine: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
  setDiscount: (sen, reason) => set({ discountSen: sen, discountReason: reason }),
  clearDiscount: () => set({ discountSen: null, discountReason: null }),
  setActiveOrderId: (id) => set({ activeOrderId: id }),
  clear: () =>
    set({
      tableId: null,
      pricingProfile: 'dine_in',
      customerName: null,
      guestCount: null,
      lines: [],
      notes: null,
      discountSen: null,
      discountReason: null,
      activeOrderId: null,
    }),

  hold: (label) => {
    const s = get();
    if (s.lines.length === 0) return;
    const entry: HoldEntry = {
      id: crypto.randomUUID(),
      label: label || `Hold ${new Date().toLocaleTimeString('id-ID')}`,
      heldAt: Date.now(),
      tableId: s.tableId,
      pricingProfile: s.pricingProfile,
      customerName: s.customerName,
      guestCount: s.guestCount,
      notes: s.notes,
      discountSen: s.discountSen?.toString() ?? null,
      discountReason: s.discountReason,
      lines: s.lines.map((l) => ({
        id: l.id,
        menuItemId: l.menuItemId,
        itemNameSnapshot: l.itemNameSnapshot,
        unitPrice: l.unitPrice.toString(),
        quantity: l.quantity,
        modifiersTotal: l.modifiersTotal.toString(),
        notes: l.notes,
      })),
    };
    const next = [...s.holds, entry];
    saveHolds(next);
    set({
      holds: next,
      lines: [],
      tableId: null,
      customerName: null,
      guestCount: null,
      notes: null,
      discountSen: null,
      discountReason: null,
      pricingProfile: 'dine_in',
    });
  },

  resume: (id) => {
    const s = get();
    const entry = s.holds.find((h) => h.id === id);
    if (!entry) return;
    const remaining = s.holds.filter((h) => h.id !== id);
    saveHolds(remaining);
    set({
      holds: remaining,
      tableId: entry.tableId,
      pricingProfile: entry.pricingProfile,
      customerName: entry.customerName,
      guestCount: entry.guestCount,
      notes: entry.notes,
      discountSen: entry.discountSen ? BigInt(entry.discountSen) : null,
      discountReason: entry.discountReason,
      lines: entry.lines.map((l) => ({
        id: l.id,
        menuItemId: l.menuItemId,
        itemNameSnapshot: l.itemNameSnapshot,
        unitPrice: BigInt(l.unitPrice),
        quantity: l.quantity,
        modifiersTotal: BigInt(l.modifiersTotal),
        notes: l.notes,
      })),
    });
  },

  removeHold: (id) => {
    const next = get().holds.filter((h) => h.id !== id);
    saveHolds(next);
    set({ holds: next });
  },
}));
