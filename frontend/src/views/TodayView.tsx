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

          <div className="card" style={{ padding: '18px 20px 22px' }}>
            <div className="card-title" style={{ marginBottom: 18 }}>
              Today&apos;s floor
            </div>
            <div style={{ position: 'relative', height: 150 }}>
              {d.todayRows.map((r) => (
                <div
                  key={r.label}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    height: 30,
                    top: r.top,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 9,
                      width: 64,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: '#8C8175',
                    }}
                  >
                    {r.label}
                  </div>
                  <div style={{ position: 'absolute', left: 74, right: 0, top: 0, bottom: 0 }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: r.left,
                        width: r.width,
                        background: r.bg,
                        border: `1px solid ${r.border}`,
                        borderRadius: 9,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '0 10px',
                        overflow: 'hidden',
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
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: r.textColor,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.who}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                position: 'relative',
                height: 22,
                marginLeft: 74,
                borderTop: '1px solid #EADFCD',
                marginTop: 12,
                paddingTop: 6,
              }}
            >
              {[
                ['0%', '6a'],
                ['19%', '9a'],
                ['38%', '12p'],
                ['56%', '3p'],
                ['75%', '6p'],
                ['94%', '9p'],
              ].map(([left, label], i, labels) => (
                <span
                  key={label}
                  style={{
                    position: 'absolute',
                    left,
                    top: 6,
                    transform:
                      i === 0 ? 'none' : i === labels.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 10.5,
                    color: '#A89C8A',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              ))}
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
