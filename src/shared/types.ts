// Общие типы Tverskoy Helper — используются main-процессом, preload и рендером.

export type ProjectSlug = 'majestic' | 'russia' | 'gta5rp'

export interface FallbackServer {
  slug: string
  id: string
  name: string
}

export interface ProjectConfig {
  slug: string
  name: string
  tagline: string
  initials: string
  accent: string
  forumOrigin: string
  forumSections: string[]
  serverCategory: string
  serverNameRe: string
  serverNamePrefix?: string
  fallbackServers: FallbackServer[]
  onlineUrl?: string | null
  onlineViaServer?: boolean
  pinnedRules: string[]
  nickAlphabet: 'latin' | 'cyrillic'
  lawsNeedLogin: boolean
  sharedKnowledge: boolean
  forumLoginExternal?: boolean
  forumPaceMs?: number
  lawsNode?: string
  serverRulesNode?: string
}

export interface AppConfig {
  apiBase: string
  apiBaseEu: string
  projects: ProjectConfig[]
}

// --- Серверные структуры (контракт из ТЗ, раздел 4) ---

export interface ServerInfo {
  slug: string
  id: string
  name: string
  players?: number
  queued?: number
  status?: boolean
}

export interface RuleDoc {
  id: string
  title: string
  ruleCount: number
}

export interface RuleBullet {
  key: string
  text: string
}

export interface RuleEntry {
  docId: string
  docTitle: string
  num: string
  title: string
  text: string
  punishment?: string
  repeat?: string
  bullets?: RuleBullet[]
}

export interface LawEntry {
  slug: string
  title: string
  collectedAt: string
  lastEdited: string
  docs: number
  articles: number
}

export interface NickRule {
  num: string
  text: string
  bullets: RuleBullet[]
  punishment?: string
  repeat?: string
}

export interface ProjectInfo {
  project: string
  rules: {
    version: number
    ruleCount: number
    fetchedAt: string
    checkedAt: string
    docs: RuleDoc[]
    servers: ServerInfo[]
  }
  laws: LawEntry[]
  nick: NickRule
}

export interface RuleHit {
  rule: RuleEntry
  doc: RuleDoc
  score: number
  matched: string[]
}

export interface SearchResponse {
  hits: RuleHit[]
  tookMs: number
  total: number
  version: number | null
  error?: { code: string; message: string }
}

export interface RuleChangeItem {
  ruleId: string
  kind: 'added' | 'edited' | 'removed'
}

export interface RuleChangeVersion {
  version: number
  at: string
  changes: RuleChangeItem[]
}

export interface ChangesResponse {
  versions: RuleChangeVersion[]
}

export interface Quota {
  limit: number
  used: number
  remaining: number
}

export interface TverskoyUser {
  id: string
  telegramId: number
  username?: string | null
  firstName?: string | null
  lastName?: string | null
  isPremium: boolean
  role: string
}

export interface AccountState {
  status: 'off' | 'signing-in' | 'signed-in' | 'signed-out'
  user?: TverskoyUser
  quota?: Quota | null
  error?: string | null
}

export interface WikiCard {
  id: string
  title: string
}

export type AiEvent =
  | { type: 'start'; id: string; model: string; query: string; contextRules: number }
  | { type: 'delta'; id: string; text: string }
  | { type: 'done'; id: string; text: string; ms: number; wiki?: WikiCard[] }
  | { type: 'error'; id: string; message: string; code?: string }

export interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  status: 'running' | 'done' | 'error'
  ms?: number
  wiki?: WikiCard[]
  error?: string
  feedback?: 'up' | 'down'
}

export interface HistoryItem {
  id: string
  question: string
  answer: string
  at: string
}

export interface NickVerdict {
  verdict: 'rp' | 'nrp' | 'doubt'
  bullet?: string | null
  reason?: string
  doubt?: string
  note?: string
  by: string
  rule: NickRule
}

export interface WikiSection {
  id: string
  title: string
}

export interface WikiListItem {
  id: string
  title: string
  section: string
  price?: number
  description?: string
}

export interface WikiEntry {
  id: string
  title: string
  section: string
  body: string[]
  image?: string | null
}

export interface Settings {
  hotkey: string
  pinned: boolean
  autostart: boolean
  confirmAi: boolean
  streamerMode: boolean
  hardwareAcceleration: boolean
  project: ProjectSlug | string
  server: Record<string, string | null>
}

export interface AppInfo {
  version: string
  hotkey: string
  platform: string
  mode: 'mock' | 'live'
}
