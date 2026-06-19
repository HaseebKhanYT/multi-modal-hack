import { useDashboard } from '../context/DashboardContext'

export function TeamView() {
  const { roster } = useDashboard()

  return (
    <div
      className="view-container"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: 14,
      }}
    >
      {roster.map((p) => (
        <div
          key={p.name}
          className="card"
          style={{
            borderRadius: 18,
            padding: '17px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 13,
          }}
        >
          <div
            className="avatar"
            style={{
              width: 46,
              height: 46,
              background: p.tint,
              color: p.tintText,
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: 16,
            }}
          >
            {p.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
              {p.keyholder ? <span className="key-badge">KEY</span> : null}
            </div>
            <div style={{ fontSize: 12.5, color: '#8C8175', marginTop: 2 }}>{p.role}</div>
          </div>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: p.statusColor,
              background: p.statusBg,
              padding: '3px 9px',
              borderRadius: 20,
              flex: 'none',
            }}
          >
            {p.status}
          </span>
        </div>
      ))}
    </div>
  )
}
