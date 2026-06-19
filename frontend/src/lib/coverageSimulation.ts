import type {
  ActivityEvent,
  Approval,
  CallScriptSegment,
  CandidateRow,
  CandidateStatus,
  DashboardState,
  LivePill,
  NavItem,
  QueueChip,
  RosterMember,
  ShiftChip,
  StatCard,
  TimelineRow,
  ViewId,
  WeekDay,
} from '../types/dashboard'

const GAP = 1500
const BUSINESS_NAME = 'Rosewood Café'

const SCRIPT: CallScriptSegment[] = [
  {
    name: 'Sam Rivera',
    initials: 'SR',
    role: 'Barista',
    tint: '#DCE4F0',
    tintText: '#3E5A86',
    ring: 3200,
    talk: 4400,
    outcome: 'declined',
    lines: [
      { who: 'Teem', color: '#BC5E3C', offset: 200, text: "Hi Sam, it's Teem from Rosewood. Marcus needs Saturday 2 to 6 off — can you cover?" },
      { who: 'Sam', color: '#3A342D', offset: 2000, text: "Ah, I'm out of town this weekend. Can't, sorry." },
      { who: 'Teem', color: '#BC5E3C', offset: 3400, text: 'No problem — thanks Sam.' },
    ],
  },
  {
    name: 'Elena Vasquez',
    initials: 'EV',
    role: 'Barista · Keyholder',
    tint: '#ECDFE6',
    tintText: '#7A4C63',
    ring: 6000,
    talk: 0,
    outcome: 'no_answer',
    lines: [],
  },
  {
    name: 'Tom Becker',
    initials: 'TB',
    role: 'Barista',
    tint: '#DEEAE0',
    tintText: '#3C6B4E',
    ring: 2400,
    talk: 6200,
    outcome: 'accepted',
    lines: [
      { who: 'Teem', color: '#BC5E3C', offset: 200, text: "Hi Tom, Teem from Rosewood. There's an open barista shift Saturday, 2 to 6 — can you take it?" },
      { who: 'Tom', color: '#3A342D', offset: 2600, text: 'Yeah, I can cover that.' },
      { who: 'Teem', color: '#BC5E3C', offset: 4400, text: "You're confirmed for 2 to 6. Thanks Tom!" },
    ],
  },
]

function buildScript(): CallScriptSegment[] {
  let t = 0
  return SCRIPT.map((segment) => {
    const start = t
    const ringEnd = start + segment.ring
    const talkEnd = ringEnd + segment.talk
    const outcomeAt = talkEnd
    const end = outcomeAt + GAP
    t = end
    return { ...segment, start, ringEnd, talkEnd, outcomeAt, end }
  })
}

const BUILT_SCRIPT = buildScript()
const ACCEPTED_AT = BUILT_SCRIPT[2].outcomeAt ?? 0
const TOTAL_END = ACCEPTED_AT + 600

const QUEUE: CallScriptSegment[] = [
  ...BUILT_SCRIPT,
  {
    name: 'Wes Carter',
    initials: 'WC',
    role: 'Barista',
    tint: '#DCE4F0',
    tintText: '#3E5A86',
    noCall: true,
    ring: 0,
    talk: 0,
    outcome: 'declined',
    lines: [],
  },
  {
    name: 'Priya Shah',
    initials: 'PS',
    role: 'Barista · Keyholder',
    keyholder: true,
    tint: '#F1DED3',
    tintText: '#8C4A2E',
    noCall: true,
    ring: 0,
    talk: 0,
    outcome: 'declined',
    lines: [],
  },
]

const INITIAL_APPROVALS: Approval[] = [
  { id: 'a1', initials: 'WC', tint: '#DCE4F0', tintText: '#3E5A86', name: 'Wes Carter', detail: 'Full day · Sat, Jun 28', type: 'Vacation' },
  { id: 'a2', initials: 'AB', tint: '#ECDFE6', tintText: '#7A4C63', name: 'Aisha Bello', detail: 'Afternoon · Fri, Jun 26', type: 'Personal' },
]

function fmt(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

function curSeg(clk: number): CallScriptSegment | undefined {
  return BUILT_SCRIPT.find((s) => clk >= (s.start ?? 0) && clk < (s.outcomeAt ?? 0))
}

function statusOf(seg: CallScriptSegment, clk: number): CandidateStatus {
  if (seg.noCall) return clk >= ACCEPTED_AT ? 'skipped' : 'queued'
  if (clk < (seg.start ?? 0)) return 'queued'
  if (clk < (seg.outcomeAt ?? 0)) return 'calling'
  return seg.outcome
}

function statusMeta(kind: CandidateStatus) {
  const map = {
    queued: { label: 'Queued', color: '#A89C8A', dot: '#C9BDA9', anim: 'none' },
    calling: { label: 'Calling…', color: '#BC5E3C', dot: '#BC5E3C', anim: 'tt-pulse 1s ease-in-out infinite' },
    declined: { label: 'Declined', color: '#B5573B', dot: '#B5573B', anim: 'none' },
    no_answer: { label: 'No answer', color: '#8A6B2E', dot: '#C99A3F', anim: 'none' },
    accepted: { label: 'Accepted ✓', color: '#3C6B4E', dot: '#4E8060', anim: 'none' },
    skipped: { label: 'Not needed', color: '#B3A899', dot: '#D6CCBC', anim: 'none' },
  }
  return map[kind]
}

function fmtClock(ms: number): string {
  const base = 9 * 3600 + 12 * 60
  const tot = base + Math.floor(ms / 1000)
  let h = Math.floor(tot / 3600)
  const m = Math.floor((tot % 3600) / 60)
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `Today · ${h}:${String(m).padStart(2, '0')} ${ap}`
}

function pos(s: number, e: number) {
  return {
    left: `${((s - 360) / 960) * 100}%`,
    width: `${((e - s) / 960) * 100}%`,
  }
}

function shiftTint(kind: 'barista' | 'kitchen', covered = false) {
  if (covered) {
    return { bg: '#E4EFE6', border: '#C6DCC9', tint: '#DEEAE0', tintText: '#3C6B4E', textColor: '#3C6B4E' }
  }
  if (kind === 'kitchen') {
    return { bg: '#F1EAD8', border: '#E0D3B4', tint: '#E7DCC6', tintText: '#8A6B2E', textColor: '#6E5A2E' }
  }
  return { bg: '#F7EAE1', border: '#E8CFBE', tint: '#F1DED3', tintText: '#8C4A2E', textColor: '#8C4A2E' }
}

function wk(s: number, e: number): string {
  const lbl = (m: number) => {
    let h = Math.floor(m / 60)
    const ap = h >= 12 ? 'p' : 'a'
    h = h % 12
    if (h === 0) h = 12
    return `${h}${ap}`
  }
  return `${lbl(s)}–${lbl(e)}`
}

function cell(s: number, e: number, who: string, initials: string, kind: 'barista' | 'kitchen', covered = false): ShiftChip {
  const c = shiftTint(kind, covered)
  return {
    time: wk(s, e),
    who,
    initials,
    bg: c.bg,
    border: c.border,
    tint: c.tint,
    tintText: c.tintText,
    nameColor: c.textColor,
    timeColor: c.textColor,
  }
}

export interface SimulationInput {
  clock: number
  playing: boolean
  showTranscript: boolean
  approvals: Approval[]
  activeView: ViewId
}

export interface SimulationActions {
  togglePlay: () => void
  replay: () => void
  approve: (id: string) => void
  deny: (id: string) => void
}

export function deriveDashboard(
  input: SimulationInput,
  actions: SimulationActions,
): DashboardState {
  const { clock: clk, playing, showTranscript, approvals, activeView } = input
  const covered = clk >= ACCEPTED_AT
  const seg = curSeg(clk)
  const ringing = !!seg && clk < (seg.ringEnd ?? 0)
  const connected = !!seg && clk >= (seg.ringEnd ?? 0) && clk < (seg.talkEnd ?? 0) && seg.talk > 0

  const queueMeta = QUEUE.map((q) => {
    const kind = statusOf(q, clk)
    const mt = statusMeta(kind)
    return { ...q, kind, mt }
  })

  const callingIdx = queueMeta.findIndex((q) => q.kind === 'calling')
  const heroProgress = covered
    ? 'Covered · 3 calls'
    : callingIdx >= 0
      ? `Calling ${callingIdx + 1} of 5`
      : 'Dialing…'

  const candidates: CandidateRow[] = queueMeta.map((q) => {
    const cur = q.kind === 'calling'
    return {
      initials: q.initials,
      name: q.name,
      role: q.role,
      keyholder: !!q.keyholder,
      tint: q.tint,
      tintText: q.tintText,
      status: q.mt.label,
      statusColor: q.mt.color,
      dot: q.mt.dot,
      anim: q.mt.anim,
      isCalling: cur,
      cardBg: cur ? '#FBF1EB' : q.kind === 'accepted' ? '#F3F8F2' : '#FFFDF9',
      cardBorder: cur ? '#E7C3B0' : q.kind === 'accepted' ? '#CFE0D2' : '#EFE7D8',
      opacity: q.kind === 'skipped' ? '0.5' : '1',
    }
  })

  const queueChips: QueueChip[] = queueMeta.map((q) => ({
    name: q.name.split(' ')[0],
    status: q.mt.label,
    dot: q.mt.dot,
    anim: q.mt.anim,
    bg: q.kind === 'calling' ? '#FBF1EB' : '#F6F0E6',
    border: q.kind === 'calling' ? '#E7C3B0' : '#EADFCD',
    nameColor: '#3A342D',
    statusColor: q.mt.color,
    opacity: q.kind === 'skipped' ? '0.5' : '1',
  }))

  let callInitials = ''
  let callName = ''
  let callRole = ''
  let callTint = '#F1DED3'
  let callTintText = '#8C4A2E'
  let callPhaseLabel = ''
  let callPhaseUpper = ''
  let callSubline = ''
  let callTimer = ''
  let transcript: Array<{ who: string; text: string; color: string }> = []

  if (seg) {
    callInitials = seg.initials
    callName = seg.name
    callRole = seg.role
    callTint = seg.tint
    callTintText = seg.tintText
    callTimer = fmt(clk - (seg.start ?? 0))
    if (ringing) {
      callPhaseLabel = 'Ringing…'
      callPhaseUpper = 'RINGING'
      callSubline = seg.talk > 0 ? 'Connecting call…' : 'Trying to reach…'
    } else if (connected) {
      callPhaseLabel = 'On call'
      callPhaseUpper = 'ON CALL'
    } else {
      callPhaseLabel = 'Wrapping up'
      callPhaseUpper = 'WRAP-UP'
    }
    const since = clk - (seg.ringEnd ?? 0)
    transcript = seg.lines
      .filter((l) => since >= l.offset)
      .map((l) => ({ who: l.who, text: l.text, color: l.color }))
    if (connected && transcript.length) {
      callSubline = transcript[transcript.length - 1].text
    }
  } else if (!covered) {
    callPhaseLabel = 'Dialing'
    callSubline = 'Dialing next teammate…'
    callTimer = '0:00'
  }

  const stats: StatCard[] = [
    { label: 'Shifts today', value: '6', tag: 'scheduled', color: '#2A2521', tagColor: '#A89C8A' },
    { label: 'Auto-covered this week', value: covered ? '24' : '23', tag: '+0 touches', color: '#3C6B4E', tagColor: '#7FA98C' },
    { label: 'Filling now', value: covered ? '0' : '1', tag: covered ? 'done' : 'live', color: covered ? '#2A2521' : '#BC5E3C', tagColor: '#BC9A82' },
    { label: 'Uncovered', value: '0', tag: 'all clear', color: '#3C6B4E', tagColor: '#7FA98C' },
  ]

  const dyn: Array<{ at: number; text: string; dot: string; tag: string; tagColor: string; tagBg: string }> = []
  if (clk >= (BUILT_SCRIPT[0].outcomeAt ?? 0)) {
    dyn.push({
      at: BUILT_SCRIPT[0].outcomeAt ?? 0,
      text: 'Sam Rivera declined coverage for Barista 2:00–6:00 PM',
      dot: '#B5573B',
      tag: 'Call',
      tagColor: '#B5573B',
      tagBg: '#F4E2DB',
    })
  }
  if (clk >= (BUILT_SCRIPT[1].outcomeAt ?? 0)) {
    dyn.push({
      at: BUILT_SCRIPT[1].outcomeAt ?? 0,
      text: 'Elena Vasquez — no answer, voicemail left',
      dot: '#C99A3F',
      tag: 'Call',
      tagColor: '#8A6B2E',
      tagBg: '#F3E8CF',
    })
  }
  if (covered) {
    dyn.push({
      at: ACCEPTED_AT,
      text: 'Tom Becker accepted — assigned Barista 2:00–6:00 PM',
      dot: '#4E8060',
      tag: 'Covered',
      tagColor: '#3C6B4E',
      tagBg: '#DEEAE0',
    })
    dyn.push({
      at: ACCEPTED_AT + 1,
      text: 'Schedule updated in Square · Marcus → Tom · all parties notified',
      dot: '#4E6FA8',
      tag: 'Sync',
      tagColor: '#3E5A86',
      tagBg: '#DCE4F0',
    })
  }
  dyn.sort((a, b) => b.at - a.at)
  const dynRows: ActivityEvent[] = dyn.map((d) => ({
    text: d.text,
    time: fmtClock(d.at),
    dot: d.dot,
    tag: d.tag,
    tagColor: d.tagColor,
    tagBg: d.tagBg,
  }))
  const staticRows: ActivityEvent[] = [
    { text: 'Coverage task opened for Barista 2:00–6:00 PM', time: 'Today · 9:12 AM', dot: '#BC5E3C', tag: 'Task', tagColor: '#9B5234', tagBg: '#F2E2D8' },
    { text: 'Marcus Lee released Saturday 2:00–6:00 PM shift — reason kept private', time: 'Today · 9:12 AM', dot: '#8C8175', tag: 'Leave', tagColor: '#6E6457', tagBg: '#EEE6D8' },
    { text: 'You approved Priya Shah time off — Tue, Jun 24', time: 'Yesterday · 6:40 PM', dot: '#4E8060', tag: 'Approval', tagColor: '#3C6B4E', tagBg: '#DEEAE0' },
    { text: 'Uncovered-shift alert resolved — you covered Friday close', time: 'Yesterday · 5:02 PM', dot: '#4E6FA8', tag: 'Resolved', tagColor: '#3E5A86', tagBg: '#DCE4F0' },
  ]
  const activityFull = [...dynRows, ...staticRows]
  const activityShort = activityFull.slice(0, 5)

  const mk = (
    label: string,
    who: string,
    initials: string,
    s: number,
    e: number,
    kind: 'barista' | 'kitchen',
    cov = false,
  ): TimelineRow => {
    const c = shiftTint(kind, cov)
    const p = pos(s, e)
    return { label, who, initials, left: p.left, width: p.width, ...c, top: '0' }
  }

  const todayShifts = [
    mk('Open', 'Priya S.', 'PS', 360, 840, 'barista'),
    mk('Open', 'Jordan K.', 'JK', 420, 900, 'kitchen'),
    mk('Mid', 'Aisha B.', 'AB', 660, 1140, 'barista'),
    mk('Mid', covered ? 'Tom B.' : '— open —', covered ? 'TB' : '··', 840, 1080, 'barista', covered),
    mk('Close', 'Nadia H.', 'NH', 840, 1320, 'kitchen'),
  ]
  const todayRows = todayShifts.map((r, i) => ({ ...r, top: `${i * 30}px` }))

  const week: WeekDay[] = [
    { dow: 'MON', date: '15', shifts: [cell(360, 840, 'Marcus L.', 'ML', 'barista'), cell(840, 1320, 'Priya S.', 'PS', 'barista')] },
    { dow: 'TUE', date: '16', shifts: [cell(360, 840, 'Tom B.', 'TB', 'barista'), cell(420, 900, 'Jordan K.', 'JK', 'kitchen')] },
    { dow: 'WED', date: '17', shifts: [cell(360, 840, 'Aisha B.', 'AB', 'barista'), cell(840, 1320, 'Elena V.', 'EV', 'barista')] },
    { dow: 'THU', date: '18', shifts: [cell(360, 840, 'Marcus L.', 'ML', 'barista'), cell(840, 1320, 'Nadia H.', 'NH', 'kitchen')] },
    { dow: 'FRI', date: '19', shifts: [cell(360, 840, 'Priya S.', 'PS', 'barista'), cell(660, 1140, 'Leo P.', 'LP', 'barista')] },
    { dow: 'SAT', date: '20', isToday: true, shifts: [cell(360, 840, 'Priya S.', 'PS', 'barista'), cell(840, 1080, covered ? 'Tom B.' : 'Open shift', covered ? 'TB' : '··', 'barista', covered), cell(840, 1320, 'Nadia H.', 'NH', 'kitchen')] },
    { dow: 'SUN', date: '21', shifts: [cell(420, 900, 'Jordan K.', 'JK', 'kitchen'), cell(660, 1140, 'Aisha B.', 'AB', 'barista')] },
  ].map((d) => ({
    ...d,
    headBg: d.isToday ? '#FBF1EB' : '#FFFDF9',
    headBorder: d.isToday ? '#E7C3B0' : '#E7DDCC',
    dowColor: d.isToday ? '#BC5E3C' : '#A89C8A',
    dateColor: d.isToday ? '#BC5E3C' : '#2A2521',
  }))

  const rosterData: Array<[string, string, boolean, 'active' | 'sick' | 'covering']> = [
    ['Dana Okafor', 'Manager · Keyholder', true, 'active'],
    ['Marcus Lee', 'Barista', false, 'sick'],
    ['Priya Shah', 'Barista · Keyholder', true, 'active'],
    ['Sam Rivera', 'Barista', false, 'active'],
    ['Elena Vasquez', 'Barista · Keyholder', true, 'active'],
    ['Tom Becker', 'Barista', false, covered ? 'covering' : 'active'],
    ['Wes Carter', 'Barista', false, 'active'],
    ['Jordan Kim', 'Kitchen', false, 'active'],
    ['Nadia Hassan', 'Kitchen · Keyholder', true, 'active'],
    ['Aisha Bello', 'Barista', false, 'active'],
    ['Leo Park', 'Barista', false, 'active'],
    ['Sofia Marin', 'Barista', false, 'active'],
  ]
  const tints = [
    ['#F1DED3', '#8C4A2E'],
    ['#DCE4F0', '#3E5A86'],
    ['#DEEAE0', '#3C6B4E'],
    ['#ECDFE6', '#7A4C63'],
    ['#F1EAD8', '#8A6B2E'],
  ] as const
  const stt = {
    active: { label: 'Active', color: '#3C6B4E', bg: '#DEEAE0' },
    sick: { label: 'Out · Sick', color: '#B5573B', bg: '#F4E2DB' },
    covering: { label: 'Covering ✓', color: '#3C6B4E', bg: '#DEEAE0' },
  }
  const roster: RosterMember[] = rosterData.map((r, i) => {
    const t = tints[i % tints.length]
    const s = stt[r[3]]
    const ini = r[0]
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
    return {
      initials: ini,
      name: r[0],
      role: r[1],
      keyholder: r[2],
      tint: t[0],
      tintText: t[1],
      status: s.label,
      statusColor: s.color,
      statusBg: s.bg,
    }
  })

  const navDef: Array<[ViewId, string, string, number]> = [
    ['today', 'Today', '/', covered ? 0 : 0],
    ['coverage', 'Coverage', '/coverage', covered ? 0 : 1],
    ['schedule', 'Schedule', '/schedule', 0],
    ['activity', 'Activity', '/activity', 0],
    ['team', 'Team', '/team', 0],
  ]
  const navItems: NavItem[] = navDef.map(([id, label, path, badgeCount]) => {
    const on = activeView === id
    return {
      id,
      label,
      path,
      badge: badgeCount > 0 ? String(badgeCount) : '',
      bg: on ? '#322C26' : 'transparent',
      color: on ? '#F4EAD9' : '#A89C8A',
      dot: on ? '#BC5E3C' : '#5A524A',
    }
  })

  const livePill: LivePill = covered
    ? { bg: '#DEEAE0', border: '#C6DCC9', dot: '#4E8060', anim: 'none', text: '#3C6B4E', label: 'All shifts covered' }
    : { bg: '#FBF1EB', border: '#E7C3B0', dot: '#BC5E3C', anim: 'tt-pulse 1s ease-in-out infinite', text: '#9B5234', label: 'Covering 1 shift' }

  return {
    businessName: BUSINESS_NAME,
    clock: clk,
    playing,
    showTranscript,
    approvals,
    covered,
    callActive: !covered,
    ringing,
    connected,
    inCall: !!seg && !covered,
    dialing: !covered && !seg,
    heroTitle: covered ? 'Coverage complete' : 'Coverage in progress',
    heroDot: covered ? '#4E8060' : '#BC5E3C',
    heroDotAnim: covered ? 'none' : 'tt-pulse 1s ease-in-out infinite',
    heroProgress,
    miniBg: covered ? '#F3F8F2' : '#FBF7EF',
    miniBorder: covered ? '#CFE0D2' : '#EFE7D8',
    callInitials,
    callName,
    callRole,
    callTint,
    callTintText,
    callPhaseLabel,
    callPhaseUpper,
    callSubline,
    callTimer,
    transcript,
    showTranscriptBlock: showTranscript && !covered,
    fillTime: '4m 12s',
    candidates,
    queueChips,
    stats,
    activityShort,
    activityFull,
    hasApprovals: approvals.length > 0,
    noApprovals: approvals.length === 0,
    approveCount: String(approvals.length),
    todayRows,
    week,
    roster,
    navItems,
    livePill,
    clockOfDay: fmtClock(clk).replace('Today · ', ''),
    playLabel: playing ? '❚❚ Pause' : '▶ Resume',
    togglePlay: actions.togglePlay,
    replay: actions.replay,
    approve: actions.approve,
    deny: actions.deny,
  }
}

export { TOTAL_END, INITIAL_APPROVALS }
