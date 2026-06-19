import { useDashboard } from '../context/DashboardContext'
import { ActivityFeed } from '../components/activity/ActivityFeed'
import { CoverageHeroCard } from '../components/coverage/CoveragePanels'

export function TodayView() {
  const d = useDashboard()

  return (
    <div className="view-container">
      <div className="stat-grid">
        {d.stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-row">
              <div className="stat-value" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="stat-tag" style={{ color: s.tagColor }}>
                {s.tag}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="two-col-wide">
        <div className="col-stack">
          <CoverageHeroCard />

          <div className="card" style={{ padding: '18px 20px 24px' }}>
            <div className="card-title" style={{ marginBottom: 18 }}>
              Today&apos;s floor
            </div>
            <div className="floor-timeline">
              <div className="floor-timeline-rows">
                {d.todayRows.map((r, i) => {
                  const barWidth = parseFloat(r.width)
                  const showName = barWidth >= 20

                  return (
                    <div className="floor-timeline-row" key={`${r.label}-${r.initials}-${i}`}>
                      <span className="floor-timeline-label">{r.label}</span>
                      <div className="floor-timeline-track">
                        <div
                          className="floor-timeline-bar"
                          style={{
                            left: r.left,
                            width: r.width,
                            background: r.bg,
                            border: `1px solid ${r.border}`,
                          }}
                        >
                          <span
                            className="avatar"
                            style={{
                              width: 18,
                              height: 18,
                              background: r.tint,
                              color: r.tintText,
                              fontSize: 9.5,
                            }}
                          >
                            {r.initials}
                          </span>
                          {showName ? (
                            <span className="floor-timeline-bar-name" style={{ color: r.textColor }}>
                              {r.who}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="floor-timeline-axis">
                {[
                  ['0%', '6a', 'start'],
                  ['19%', '9a', 'center'],
                  ['38%', '12p', 'center'],
                  ['56%', '3p', 'center'],
                  ['75%', '6p', 'center'],
                  ['94%', '9p', 'end'],
                ].map(([left, label, align]) => (
                  <span
                    key={label}
                    className="floor-timeline-tick"
                    style={{
                      left,
                      transform:
                        align === 'start'
                          ? 'none'
                          : align === 'end'
                            ? 'translateX(-100%)'
                            : 'translateX(-50%)',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-stack">
          <div className="card" style={{ padding: '18px 20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <div className="card-title">Needs you</div>
              <span
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#8A6B2E',
                  background: '#F3E8CF',
                  padding: '2px 9px',
                  borderRadius: 20,
                }}
              >
                {d.approveCount}
              </span>
            </div>

            {d.hasApprovals ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {d.approvals.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      border: '1px solid #EADFCD',
                      borderRadius: 14,
                      padding: '13px 14px',
                      animation: 'tt-up 0.3s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <div
                        className="avatar"
                        style={{
                          width: 32,
                          height: 32,
                          background: a.tint,
                          color: a.tintText,
                          fontSize: 12,
                        }}
                      >
                        {a.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.name}</div>
                        <div style={{ fontSize: 12, color: '#8C8175' }}>{a.detail}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#8A6B2E',
                          background: '#F3E8CF',
                          padding: '2px 8px',
                          borderRadius: 20,
                          flex: 'none',
                        }}
                      >
                        {a.type}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn-approve" onClick={() => d.approve(a.id)}>
                        Approve
                      </button>
                      <button type="button" className="btn-deny" onClick={() => d.deny(a.id)}>
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {d.noApprovals ? (
              <div style={{ padding: '18px 0 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#3C6B4E' }}>All caught up</div>
                <div style={{ fontSize: 12.5, color: '#8C8175', marginTop: 3 }}>
                  No approvals waiting on you.
                </div>
              </div>
            ) : null}
          </div>

          <ActivityFeed events={d.activityShort} compact showViewAll />
        </div>
      </div>
    </div>
  )
}
