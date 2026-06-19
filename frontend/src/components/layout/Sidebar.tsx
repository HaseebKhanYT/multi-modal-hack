import { NavLink } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'

export function Sidebar() {
  const { navItems, businessName } = useDashboard()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <div className="sidebar-logo-ring" />
        </div>
        <div className="sidebar-wordmark">
          Teem<span className="sidebar-wordmark-dot">.</span>Talk
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === '/'}
            className="sidebar-nav-btn"
            style={{ background: item.bg, color: item.color }}
          >
            <span className="sidebar-nav-dot" style={{ background: item.dot }} />
            <span className="sidebar-nav-label">{item.label}</span>
            {item.badge ? <span className="sidebar-nav-badge">{item.badge}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status-card">
          <div className="sidebar-status-header">
            <span className="sidebar-status-dot" />
            <span className="sidebar-status-title">System status</span>
          </div>
          <div className="sidebar-status-body">
            Intake & Coverage agents online · synced with Square
          </div>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">DO</div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-user-name">Dana Okafor</div>
            <div className="sidebar-user-role">Manager · {businessName}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
