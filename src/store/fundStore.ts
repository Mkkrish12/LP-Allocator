import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Fund, FundStatus } from '../types/fund'
import { syntheticFunds, demoFunds } from '../data/syntheticFunds'

interface FundStore {
  funds: Fund[]
  selectedFundIds: string[]

  // Actions
  addFund: (fund: Fund) => void
  updateFund: (id: string, updates: Partial<Fund>) => void
  deleteFund: (id: string) => void
  updateFundStatus: (id: string, status: FundStatus) => void
  toggleFundSelection: (id: string) => void
  clearSelection: () => void

  // Computed
  getCommittedFunds: () => Fund[]
  getEvaluatingFunds: () => Fund[]
  getFundById: (id: string) => Fund | undefined
}

const SYNTHETIC_IDS = new Set([
  ...syntheticFunds.map((f) => f.id),
  ...demoFunds.map((f) => f.id),
])

const BASE_FUNDS = [...syntheticFunds, ...demoFunds]

export const useFundStore = create<FundStore>()(
  persist(
    (set, get) => ({
      funds: BASE_FUNDS,
      selectedFundIds: [],

      addFund: (fund) =>
        set((state) => ({ funds: [...state.funds, fund] })),

      updateFund: (id, updates) =>
        set((state) => ({
          funds: state.funds.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        })),

      deleteFund: (id) =>
        set((state) => ({
          funds: state.funds.filter((f) => f.id !== id || SYNTHETIC_IDS.has(f.id)),
        })),

      updateFundStatus: (id, status) =>
        set((state) => ({
          funds: state.funds.map((f) => (f.id === id ? { ...f, status } : f)),
        })),

      toggleFundSelection: (id) =>
        set((state) => {
          const selected = state.selectedFundIds
          return {
            selectedFundIds: selected.includes(id)
              ? selected.filter((s) => s !== id)
              : selected.length < 5
              ? [...selected, id]
              : selected,
          }
        }),

      clearSelection: () => set({ selectedFundIds: [] }),

      getCommittedFunds: () => get().funds.filter((f) => f.status === 'committed'),
      getEvaluatingFunds: () => get().funds.filter((f) => f.status === 'evaluating'),
      getFundById: (id) => get().funds.find((f) => f.id === id),
    }),
    {
      name: 'lp_allocator_funds',
      // On rehydrate: merge persisted user funds with the always-present base funds
      merge: (persisted: unknown, current: FundStore) => {
        const persistedState = persisted as Partial<FundStore>
        const userFunds = (persistedState?.funds ?? []).filter(
          (f: Fund) => !SYNTHETIC_IDS.has(f.id)
        )
        return {
          ...current,
          ...persistedState,
          funds: [...BASE_FUNDS, ...userFunds],
        }
      },
    }
  )
)
