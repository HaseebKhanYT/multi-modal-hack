import { Link } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'

function AudioBars({ large = false }: { large?: boolean }) {
  const delays = large ? [0, 0.12, 0.24, 0.36, 0.48] : [0, 0.15, 0.3, 0.45, 0.6]
  const colors = large
    ? ['#D88A5E', '#C96E40', '#BC5E3C', '#C96E40', '#D88A5E']
    : ['#BC5E3C', '#BC5E3C', '#BC5E3C', '#BC5E3C', '#BC5E3C']

  return (
    <div className={large ? 'audio-bars-lg' : 'audio-bars'}>
      {delays.map((delay, i) => (
        <span
          key={i}
          className={large ? 'audio-bar-lg' : 'audio-bar'}
          style={{
            background: colors[i],
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export function CoverageHeroCard({ showOpenLink = true }: { showOpenLink?: boolean }) {
  const d = useDashboard()

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 20px 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: d.heroDot,
              animation: d.heroDotAnim,
            }}
          />
          <span className="card-title">{d.heroTitle}</span>
        </div>
        {showOpenLink ? (
          <Link to="/coverage" className="btn-outline" style={{ textDecoration: 'none' }}>
            Open coverage →
          </Link>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          margin: '0 20px',
          padding: '14px 16px',
          background: '#F7F1E7',
          border: '1px solid #EADFCD',
          borderRadius: 14,
        }}
      >
        <div
          className="avatar"
          style={{
            width: 42,
            height: 42,
            background: '#F1DED3',
            color: '#8C4A2E',
            fontSize: 14,
          }}
        >
          ML
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>Barista · 2:00–6:00 PM</div>
          <div style={{ fontSize: 12.5, color: '#8C8175', marginTop: 1 }}>
            Marcus Lee called out · <span style={{ color: '#B5573B', fontWeight: 600 }}>Sick</span> · released 9:12 AM
          </div>
        </div>
        <div
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            color: '#8C8175',
            textAlign: 'right',
            flex: 'none',
          }}
        >
          {d.heroProgress}
        </div>
      </div>

      <div
        style={{
          margin: '14px 20px 6px',
          padding: 16,
          borderRadius: 14,
          background: d.miniBg,
          border: `1px solid ${d.miniBorder}`,
          transition: 'background 0.4s',
        }}
      >
        {d.covered ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div
              className="avatar"
              style={{
                width: 44,
                height: 44,
                background: '#DEEAE0',
                color: '#3C6B4E',
                fontSize: 15,
              }}
            >
              TB
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#3C6B4E' }}>
                Shift covered — Tom Becker accepted
              </div>
              <div style={{ fontSize: 12.5, color: '#6E7A6E', marginTop: 1 }}>
                Schedule updated · all parties notified · 0 manager touches
              </div>
            </div>
            <button type="button" className="btn-replay" onClick={d.replay}>
              ↻ Replay
            </button>
          </div>
        ) : null}

        {d.dialing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div
              className="avatar"
              style={{
                width: 44,
                height: 44,
                background: '#F3EADF',
              }}
            >
              <div className="pulse-dots">
                {[0, 0.2, 0.4].map((delay) => (
                  <span key={delay} className="pulse-dot" style={{ animationDelay: `${delay}s` }} />
                ))}
              </div>
            </div>
            <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: '#8C8175' }}>
              Dialing next teammate…
            </div>
          </div>
        ) : null}

        {d.inCall ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div className="ring-wrap">
              {d.ringing ? <span className="ring-pulse" /> : null}
              <div
                className="avatar"
                style={{
                  position: 'relative',
                  width: 44,
                  height: 44,
                  background: d.callTint,
                  color: d.callTintText,
                  fontSize: 15,
                }}
              >
                {d.callInitials}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{d.callName}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#BC5E3C' }}>{d.callPhaseLabel}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#8C8175', marginTop: 2, minHeight: 17 }}>{d.callSubline}</div>
            </div>
            {d.connected ? <AudioBars /> : null}
            <div
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                color: '#8C8175',
                flex: 'none',
              }}
            >
              {d.callTimer}
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '12px 20px 18px', flexWrap: 'wrap' }}>
        {d.queueChips.map((c) => (
          <div
            key={c.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 11px 6px 8px',
              borderRadius: 30,
              background: c.bg,
              border: `1px solid ${c.border}`,
              opacity: c.opacity,
              transition: 'all 0.3s',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: c.dot,
                animation: c.anim,
              }}
            />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: c.nameColor }}>{c.name}</span>
            <span style={{ fontSize: 11.5, color: c.statusColor }}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CoverageStage() {
  const d = useDashboard()

  return (
    <div className="card" style={{ overflow: 'hidden', minHeight: 560, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 22px',
          borderBottom: '1px solid #EFE7D8',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: d.heroDot,
              animation: d.heroDotAnim,
            }}
          />
          <span className="card-title">Coverage agent · live</span>
        </div>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#8C8175' }}>
          Task #CT-4471
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px 22px',
          textAlign: 'center',
        }}
      >
        {d.covered ? (
          <>
            <div
              className="avatar"
              style={{
                width: 96,
                height: 96,
                background: '#DEEAE0',
                color: '#3C6B4E',
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 30,
                marginBottom: 6,
              }}
            >
              TB
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#4E8060', letterSpacing: '0.04em', marginBottom: 8 }}>
              CONFIRMED ✓
            </div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: '-0.02em',
              }}
            >
              Tom Becker is covering
            </div>
            <div style={{ fontSize: 14, color: '#8C8175', marginTop: 6, maxWidth: 340 }}>
              Barista · 2:00–6:00 PM. Schedule updated in Square, requester and manager notified.
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
              {[
                ['3', 'calls placed'],
                ['0', 'manager touches'],
                [d.fillTime, 'time to fill'],
              ].map(([val, label]) => (
                <div key={label}>
                  <div
                    style={{
                      fontFamily: "'Bricolage Grotesque', sans-serif",
                      fontWeight: 700,
                      fontSize: 24,
                      color: '#3C6B4E',
                    }}
                  >
                    {val}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#8C8175' }}>{label}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {d.dialing ? (
          <>
            <div className="pulse-dots-lg">
              {[0, 0.2, 0.4].map((delay) => (
                <span key={delay} className="pulse-dot-lg" style={{ animationDelay: `${delay}s` }} />
              ))}
            </div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 700,
                fontSize: 24,
                letterSpacing: '-0.02em',
                color: '#5C5347',
              }}
            >
              Dialing next teammate…
            </div>
            <div style={{ fontSize: 14, color: '#A89C8A', marginTop: 6 }}>Advancing the ranked queue</div>
          </>
        ) : null}

        {d.inCall ? (
          <>
            <div className="ring-wrap" style={{ marginBottom: 18 }}>
              {d.ringing ? (
                <>
                  <span className="ring-pulse" />
                  <span className="ring-pulse ring-pulse-delay" />
                </>
              ) : null}
              <div
                className="avatar"
                style={{
                  position: 'relative',
                  width: 96,
                  height: 96,
                  background: d.callTint,
                  color: d.callTintText,
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: 30,
                }}
              >
                {d.callInitials}
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#BC5E3C',
                letterSpacing: '0.04em',
                marginBottom: 7,
              }}
            >
              {d.callPhaseUpper}
            </div>
            <div
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: '-0.02em',
              }}
            >
              {d.callName}
            </div>
            <div style={{ fontSize: 14, color: '#8C8175', marginTop: 5 }}>
              {d.callRole} · {d.callTimer}
            </div>
            {d.connected ? <AudioBars large /> : null}
          </>
        ) : null}
      </div>

      {d.showTranscriptBlock ? (
        <div
          style={{
            borderTop: '1px solid #EFE7D8',
            padding: '16px 22px',
            minHeight: 118,
            background: '#FBF7EF',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#A89C8A',
              letterSpacing: '0.06em',
              marginBottom: 10,
            }}
          >
            LIVE TRANSCRIPT
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.transcript.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, animation: 'tt-up 0.25s ease' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: t.color,
                    flex: 'none',
                    width: 52,
                    textAlign: 'right',
                    paddingTop: 1,
                  }}
                >
                  {t.who}
                </span>
                <span style={{ fontSize: 13.5, lineHeight: 1.45, color: '#3A342D' }}>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function CandidateQueueRail() {
  const d = useDashboard()

  return (
    <div className="col-stack">
      <div style={{ background: '#221E1A', color: '#EEE7DA', borderRadius: 20, padding: 20 }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: '#9A8F7E',
            letterSpacing: '0.05em',
            marginBottom: 12,
          }}
        >
          SHIFT TO FILL
        </div>
        <div
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: '-0.02em',
          }}
        >
          Barista
        </div>
        <div style={{ fontSize: 14, color: '#C6BBA8', marginTop: 2 }}>Saturday, Jun 20 · 2:00–6:00 PM</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid #36302A',
          }}
        >
          <div
            className="avatar"
            style={{
              width: 30,
              height: 30,
              background: '#3A332C',
              color: '#D9CEBB',
              fontSize: 11,
            }}
          >
            ML
          </div>
          <div style={{ fontSize: 12.5, color: '#B6AB98' }}>
            Vacated by <span style={{ color: '#EEE7DA', fontWeight: 600 }}>Marcus Lee</span> · Sick
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '18px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div className="card-title" style={{ fontSize: 16 }}>
            Candidate queue
          </div>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#8C8175' }}>
            {d.heroProgress}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {d.candidates.map((c) => (
            <div
              key={c.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 13px',
                borderRadius: 14,
                background: c.cardBg,
                border: `1px solid ${c.cardBorder}`,
                opacity: c.opacity,
                transition: 'all 0.35s',
              }}
            >
              <div className="ring-wrap">
                {c.isCalling ? <span className="ring-pulse ring-pulse-thin" /> : null}
                <div
                  className="avatar"
                  style={{
                    position: 'relative',
                    width: 38,
                    height: 38,
                    background: c.tint,
                    color: c.tintText,
                    fontSize: 13,
                  }}
                >
                  {c.initials}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                  {c.keyholder ? <span className="key-badge">KEY</span> : null}
                </div>
                <div style={{ fontSize: 12, color: '#8C8175', marginTop: 1 }}>{c.role}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: c.statusColor }}>{c.status}</span>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: c.dot,
                    animation: c.anim,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn-outline-lg" onClick={d.togglePlay}>
          {d.playLabel}
        </button>
        <button type="button" className="btn-dark" onClick={d.replay}>
          ↻ Replay call-down
        </button>
      </div>
    </div>
  )
}
