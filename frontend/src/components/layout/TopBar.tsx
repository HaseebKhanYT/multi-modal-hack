import { useLocation } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'

const TITLES: Record<string, [string, string]> = {
  '/': ['Today', 'Saturday, June 20 · Rosewood Café'],
  '/coverage': ['Coverage', 'Live call-down in progress'],
  '/schedule': ['Schedule', 'Week of June 15 — synced with Square'],
  '/activity': ['Activity', 'Every call, decision & schedule change'],
  '/team': ['Team', '12 staff · 4 keyholders'],
}

export function TopBar() {
  const location = useLocation()
  const { livePill, clockOfDay } = useDashboard()
  const [title, subtitle] = TITLES[location.pathname] ?? TITLES['/']

  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        <div className="topbar-subtitle">{subtitle}</div>
      </div>
      <div className="topbar-right">
        <div
          className="live-pill"
          style={{
            background: livePill.bg,
            border: `1px solid ${livePill.border}`,
          }}
        >
          <span
            className="live-pill-dot"
            style={{
              background: livePill.dot,
              animation: livePill.anim,
            }}
          />
          <span className="live-pill-label" style={{ color: livePill.text }}>
            {livePill.label}
          </span>
        </div>
        <div className="clock-chip">{clockOfDay}</div>
      </div>
    </header>
  )
}
