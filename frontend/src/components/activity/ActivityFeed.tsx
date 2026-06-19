import { Link } from 'react-router-dom'
import type { ActivityEvent } from '../../types/dashboard'

export function ActivityFeed({
  events,
  compact = false,
  showViewAll = false,
}: {
  events: ActivityEvent[]
  compact?: boolean
  showViewAll?: boolean
}) {
  return (
    <div className="card" style={{ padding: compact ? '18px 20px 8px' : '8px 24px' }}>
      {compact ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <div className="card-title">Activity</div>
          {showViewAll ? (
            <Link to="/activity" className="btn-link" style={{ textDecoration: 'none' }}>
              View all
            </Link>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {events.map((e, i) => (
          <div
            key={`${e.time}-${i}`}
            style={{
              display: 'flex',
              gap: compact ? 12 : 16,
              padding: compact ? '11px 0' : '15px 0',
              borderBottom: '1px solid #F0E8D9',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 'none',
                paddingTop: compact ? 3 : 0,
              }}
            >
              <span
                style={{
                  width: compact ? 8 : 10,
                  height: compact ? 8 : 10,
                  borderRadius: '50%',
                  background: e.dot,
                  marginTop: compact ? 0 : 4,
                }}
              />
              {!compact && i < events.length - 1 ? (
                <span style={{ flex: 1, width: 2, background: '#F0E8D9', marginTop: 4 }} />
              ) : null}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: compact ? 0 : 2 }}>
              <div
                style={{
                  fontSize: compact ? 13 : 14,
                  lineHeight: 1.4,
                  color: compact ? '#3A342D' : '#2F2A24',
                }}
              >
                {e.text}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  marginTop: compact ? 2 : 4,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    fontSize: compact ? 11 : 11.5,
                    color: '#A89C8A',
                  }}
                >
                  {e.time}
                </span>
                {!compact ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: e.tagColor,
                      background: e.tagBg,
                      padding: '1px 8px',
                      borderRadius: 20,
                    }}
                  >
                    {e.tag}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
