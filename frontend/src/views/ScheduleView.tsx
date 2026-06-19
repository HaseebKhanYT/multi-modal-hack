import { useDashboard } from '../context/DashboardContext'

export function ScheduleView() {
  const { week } = useDashboard()

  return (
    <div className="view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: '#8C8175' }}>
          {[
            ['#F1DED3', '#E2C8B6', 'Barista'],
            ['#E7DCC6', '#DBCBA8', 'Kitchen'],
            ['#DEEAE0', '#C6DCC9', 'Just covered'],
          ].map(([bg, border, label]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: bg,
                  border: `1px solid ${border}`,
                }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
        {week.map((d) => (
          <div
            key={d.dow}
            style={{
              background: d.headBg,
              border: `1px solid ${d.headBorder}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 12px 10px',
                textAlign: 'center',
                borderBottom: '1px solid #EFE7D8',
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: d.dowColor,
                  letterSpacing: '0.03em',
                }}
              >
                {d.dow}
              </div>
              <div
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontWeight: 700,
                  fontSize: 20,
                  color: d.dateColor,
                  marginTop: 2,
                }}
              >
                {d.date}
              </div>
            </div>
            <div
              style={{
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                minHeight: 230,
              }}
            >
              {d.shifts.map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    borderRadius: 10,
                    padding: '8px 9px',
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 10,
                      color: s.timeColor,
                      marginBottom: 4,
                    }}
                  >
                    {s.time}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      className="avatar"
                      style={{
                        width: 18,
                        height: 18,
                        background: s.tint,
                        color: s.tintText,
                        fontSize: 9,
                      }}
                    >
                      {s.initials}
                    </span>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: s.nameColor,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.who}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
