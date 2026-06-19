import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { DashboardContext } from './DashboardContext'
import { deriveDashboard, INITIAL_APPROVALS, TOTAL_END } from '../lib/coverageSimulation'
import type { Approval, ViewId } from '../types/dashboard'

const VIEW_PATHS: Record<string, ViewId> = {
  '/': 'today',
  '/coverage': 'coverage',
  '/schedule': 'schedule',
  '/activity': 'activity',
  '/team': 'team',
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const activeView = VIEW_PATHS[location.pathname] ?? 'today'

  const [clock, setClock] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [showTranscript] = useState(true)
  const [approvals, setApprovals] = useState<Approval[]>(INITIAL_APPROVALS)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setClock((c) => Math.min(c + 100, TOTAL_END))
    }, 100)
    return () => window.clearInterval(id)
  }, [playing])

  const togglePlay = useCallback(() => setPlaying((p) => !p), [])
  const replay = useCallback(() => {
    setClock(0)
    setPlaying(true)
  }, [])
  const approve = useCallback((id: string) => {
    setApprovals((a) => a.filter((x) => x.id !== id))
  }, [])
  const deny = useCallback((id: string) => {
    setApprovals((a) => a.filter((x) => x.id !== id))
  }, [])

  const value = useMemo(
    () =>
      deriveDashboard(
        { clock, playing, showTranscript, approvals, activeView },
        { togglePlay, replay, approve, deny },
      ),
    [clock, playing, showTranscript, approvals, activeView, togglePlay, replay, approve, deny],
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}
