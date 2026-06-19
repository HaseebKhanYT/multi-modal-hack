import { createContext, useContext } from 'react'
import type { DashboardState } from '../types/dashboard'

export const DashboardContext = createContext<DashboardState | null>(null)

export function useDashboard(): DashboardState {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
