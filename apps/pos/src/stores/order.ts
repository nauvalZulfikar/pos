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
};

export const useOrderDraftStore = create<OrderDraftState>((set) => ({
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
}));
