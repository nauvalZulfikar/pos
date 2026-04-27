import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SessionState = {
  userId: string | null;
  tenantId: string | null;
  outletId: string | null;
  role: string | null;
  setSession: (s: Partial<SessionState>) => void;
  clear: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      tenantId: null,
      outletId: null,
      role: null,
      setSession: (s) => set(s),
      clear: () => set({ userId: null, tenantId: null, outletId: null, role: null }),
    }),
    { name: 'desain-session' },
  ),
);
