export type ViewId = 'today' | 'coverage' | 'schedule' | 'activity' | 'team'

export type CandidateStatus =
  | 'queued'
  | 'calling'
  | 'declined'
  | 'no_answer'
  | 'accepted'
  | 'skipped'

export interface TranscriptLine {
  who: string
  text: string
  color: string
  offset: number
}

export interface CallScriptSegment {
  name: string
  initials: string
  role: string
  tint: string
  tintText: string
  keyholder?: boolean
  ring: number
  talk: number
  outcome: 'declined' | 'no_answer' | 'accepted'
  lines: TranscriptLine[]
  noCall?: boolean
  start?: number
  ringEnd?: number
  talkEnd?: number
  outcomeAt?: number
  end?: number
}

export interface Approval {
  id: string
  initials: string
  tint: string
  tintText: string
  name: string
  detail: string
  type: string
}

export interface ActivityEvent {
  text: string
  time: string
  dot: string
  tag: string
  tagColor: string
  tagBg: string
}

export interface StatCard {
  label: string
  value: string
  tag: string
  color: string
  tagColor: string
}

export interface QueueChip {
  name: string
  status: string
  dot: string
  anim: string
  bg: string
  border: string
  nameColor: string
  statusColor: string
  opacity: string
}

export interface CandidateRow {
  initials: string
  name: string
  role: string
  keyholder: boolean
  tint: string
  tintText: string
  status: string
  statusColor: string
  dot: string
  anim: string
  isCalling: boolean
  cardBg: string
  cardBorder: string
  opacity: string
}

export interface TimelineRow {
  label: string
  who: string
  initials: string
  left: string
  width: string
  bg: string
  border: string
  tint: string
  tintText: string
  textColor: string
  top: string
}

export interface ShiftChip {
  time: string
  who: string
  initials: string
  bg: string
  border: string
  tint: string
  tintText: string
  nameColor: string
  timeColor: string
}

export interface WeekDay {
  dow: string
  date: string
  isToday?: boolean
  headBg: string
  headBorder: string
  dowColor: string
  dateColor: string
  shifts: ShiftChip[]
}

export interface RosterMember {
  initials: string
  name: string
  role: string
  keyholder: boolean
  tint: string
  tintText: string
  status: string
  statusColor: string
  statusBg: string
}

export interface NavItem {
  id: ViewId
  label: string
  path: string
  badge: string
  bg: string
  color: string
  dot: string
}

export interface LivePill {
  bg: string
  border: string
  dot: string
  anim: string
  text: string
  label: string
}

export interface DashboardState {
  businessName: string
  clock: number
  playing: boolean
  showTranscript: boolean
  approvals: Approval[]
  covered: boolean
  callActive: boolean
  ringing: boolean
  connected: boolean
  inCall: boolean
  dialing: boolean
  heroTitle: string
  heroDot: string
  heroDotAnim: string
  heroProgress: string
  miniBg: string
  miniBorder: string
  callInitials: string
  callName: string
  callRole: string
  callTint: string
  callTintText: string
  callPhaseLabel: string
  callPhaseUpper: string
  callSubline: string
  callTimer: string
  transcript: Array<{ who: string; text: string; color: string }>
  showTranscriptBlock: boolean
  fillTime: string
  candidates: CandidateRow[]
  queueChips: QueueChip[]
  stats: StatCard[]
  activityShort: ActivityEvent[]
  activityFull: ActivityEvent[]
  hasApprovals: boolean
  noApprovals: boolean
  approveCount: string
  todayRows: TimelineRow[]
  week: WeekDay[]
  roster: RosterMember[]
  navItems: NavItem[]
  livePill: LivePill
  clockOfDay: string
  playLabel: string
  togglePlay: () => void
  replay: () => void
  approve: (id: string) => void
  deny: (id: string) => void
}
